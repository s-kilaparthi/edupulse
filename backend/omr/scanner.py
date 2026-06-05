import math

import cv2
import numpy as np

from omr.coordinates import (
    BUBBLE_COORDS,
    IMG_H,
    IMG_W,
    OPTIONS,
    roi_center,
)

WARPED_DEBUG_PATH = "/tmp/warped_debug.jpg"
DEBUG_BUBBLES_PATH = "/tmp/debug_bubbles.jpg"

FILL_THRESHOLD = 50
DARK_PIXEL_CUTOFF = 100


def safe_float(value: float) -> float:
    """Return 0.0 for NaN or inf so JSON serialization never fails."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(number):
        return 0.0
    return number


def safe_div(numerator: float, denominator: float, default: float = 0.0) -> float:
    if denominator == 0:
        return default
    return safe_float(numerator / denominator)


def _order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype=np.float32)
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def _find_corners_from_markers(gray: np.ndarray) -> np.ndarray | None:
    """Detect 18mm black corner squares and return outer sheet quad."""
    h, w = gray.shape[:2]
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    _, binary = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

    expected_area = (MARKER_AREA := (18 / 210 * w) * (18 / 297 * h))
    min_area = MARKER_AREA * 0.25
    max_area = MARKER_AREA * 4.0

    candidates: list[tuple[float, float, float]] = []
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.04 * peri, True)
        if len(approx) < 4 or len(approx) > 6:
            continue
        m = cv2.moments(contour)
        if m["m00"] == 0:
            continue
        cx = m["m10"] / m["m00"]
        cy = m["m01"] / m["m00"]
        candidates.append((cx, cy, area))

    if len(candidates) < 4:
        return None

    corners_img = np.array(
        [[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]],
        dtype=np.float32,
    )
    selected = []
    used = set()
    for corner in corners_img:
        best_idx = None
        best_dist = float("inf")
        for idx, (cx, cy, _) in enumerate(candidates):
            if idx in used:
                continue
            dist = np.linalg.norm(corner - np.array([cx, cy]))
            if dist < best_dist:
                best_dist = dist
                best_idx = idx
        if best_idx is None:
            return None
        used.add(best_idx)
        cx, cy, _ = candidates[best_idx]
        selected.append([cx, cy])

    return _order_points(np.array(selected, dtype=np.float32))


def _find_sheet_corners(edged: np.ndarray, gray: np.ndarray) -> np.ndarray:
    marker_corners = _find_corners_from_markers(gray)
    if marker_corners is not None:
        return marker_corners

    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    best = None
    best_area = 0

    for contour in contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) != 4:
            continue
        area = cv2.contourArea(approx)
        if area > best_area:
            best_area = area
            best = approx

    if best is not None:
        return _order_points(best.reshape(4, 2).astype(np.float32))

    h, w = gray.shape[:2]
    return np.array(
        [[0, 0], [w - 1, 0], [w - 1, h - 1], [0, h - 1]],
        dtype=np.float32,
    )


def _warp_sheet(image: np.ndarray, corners: np.ndarray) -> np.ndarray:
    dst = np.array(
        [[0, 0], [IMG_W - 1, 0], [IMG_W - 1, IMG_H - 1], [0, IMG_H - 1]],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(corners, dst)
    return cv2.warpPerspective(image, matrix, (IMG_W, IMG_H))


def _bubble_stats(gray: np.ndarray, roi: tuple[int, int, int, int]) -> dict:
    x1, y1, x2, y2 = roi
    patch = gray[y1 : y2 + 1, x1 : x2 + 1]
    if patch.size == 0:
        return {"mean": 255.0, "dark_pixels": 0, "total_pixels": 0}
    return {
        "mean": safe_float(np.mean(patch)),
        "dark_pixels": int(np.sum(patch < DARK_PIXEL_CUTOFF)),
        "total_pixels": int(patch.size),
    }


def _dark_pixel_count(gray: np.ndarray, roi: tuple[int, int, int, int]) -> int:
    return _bubble_stats(gray, roi)["dark_pixels"]


def _save_debug_images(warped_color: np.ndarray, warped_gray: np.ndarray) -> None:
    cv2.imwrite(WARPED_DEBUG_PATH, warped_color)

    debug_img = warped_color.copy()
    for q_num in range(1, 51):
        for label, roi in BUBBLE_COORDS[q_num].items():
            cx, cy = roi_center(roi)
            radius = max(8, (roi[2] - roi[0]) // 2)
            cv2.circle(debug_img, (cx, cy), radius, (0, 0, 255), 2)
            if q_num == 1:
                cv2.putText(
                    debug_img,
                    label,
                    (cx - 5, cy - radius - 4),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.35,
                    (255, 0, 0),
                    1,
                    cv2.LINE_AA,
                )

    cv2.imwrite(DEBUG_BUBBLES_PATH, debug_img)

    print("--- Q1 bubble calibration (warped 800x1100) ---")
    for label in OPTIONS:
        roi = BUBBLE_COORDS[1][label]
        stats = _bubble_stats(warped_gray, roi)
        cx, cy = roi_center(roi)
        print(
            f"  Q1 {label}: center=({cx},{cy}) roi={roi} "
            f"mean={stats['mean']:.1f} dark_pixels={stats['dark_pixels']} "
            f"(threshold={FILL_THRESHOLD})"
        )
    print(f"  Saved: {WARPED_DEBUG_PATH}, {DEBUG_BUBBLES_PATH}")


def _decode_answers(gray: np.ndarray) -> tuple[dict[str, str], list[str], float]:
    answers: dict[str, str] = {}
    ambiguous: list[str] = []
    confidences: list[float] = []

    for q_num in range(1, 51):
        key = str(q_num)
        bubbles = BUBBLE_COORDS[q_num]
        counts = {label: _dark_pixel_count(gray, roi) for label, roi in bubbles.items()}
        total_dark = sum(counts.values())

        if total_dark == 0:
            ambiguous.append(key)
            answers[key] = ""
            confidences.append(0.0)
            continue

        sorted_labels = sorted(OPTIONS, key=lambda lbl: counts[lbl], reverse=True)
        top, second = sorted_labels[0], sorted_labels[1]
        top_count = int(counts[top])
        second_count = int(counts[second])

        if top_count < FILL_THRESHOLD:
            ambiguous.append(key)
            answers[key] = ""
            confidences.append(0.0)
            continue

        dominance = safe_div(top_count, second_count, default=float(top_count))
        if second_count > 0 and dominance < 1.25:
            ambiguous.append(key)
            answers[key] = ""
            confidences.append(0.5)
            continue

        answers[key] = str(top)
        ratio = safe_div(top_count, top_count + total_dark + 1)
        question_conf = safe_float(min(0.99, 0.7 + ratio * 0.29))
        confidences.append(question_conf)

    valid_confidences = [c for c in confidences if c > 0]
    if not valid_confidences:
        overall = 0.0
    else:
        overall = safe_float(np.mean(valid_confidences))
        if not ambiguous and overall > 0:
            overall = safe_float(max(overall, 0.95))

    return answers, ambiguous, overall


def scan_omr(image_path: str, debug: bool = False) -> dict:
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"Could not load image: {image_path}")

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 75, 200)

    corners = _find_sheet_corners(edged, gray)
    warped_color = _warp_sheet(image, corners)
    warped_gray = cv2.cvtColor(warped_color, cv2.COLOR_BGR2GRAY)

    if debug:
        _save_debug_images(warped_color, warped_gray)

    answers, ambiguous, confidence = _decode_answers(warped_gray)

    result = {
        "answers": {k: str(v) for k, v in answers.items()},
        "ambiguous": [str(q) for q in ambiguous],
        "confidence": round(safe_float(confidence), 2),
    }
    if debug:
        result["debug"] = {
            "warped_image": WARPED_DEBUG_PATH,
            "bubble_overlay": DEBUG_BUBBLES_PATH,
        }
    return result
