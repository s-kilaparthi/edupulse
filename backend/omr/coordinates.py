def _roi_from_center(cx: int, cy: int, r: int = 15):
    return (cx - r, cy - r, cx + r, cy + r)

OPTIONS = ["A", "B", "C", "D"]
IMG_W = 800
IMG_H = 1100

def roi_center(roi):
    x1, y1, x2, y2 = roi
    return ((x1 + x2) // 2, (y1 + y2) // 2)

_LX = [205, 252, 299, 344]
_RX = [481, 529, 577, 622]
_Y  = [340 + i * 42 for i in range(15)]

BUBBLE_COORDS = {}
for i, y in enumerate(_Y):
    q_left  = i + 1
    q_right = i + 16
    BUBBLE_COORDS[q_left] = {
        "A": _roi_from_center(_LX[0], y),
        "B": _roi_from_center(_LX[1], y),
        "C": _roi_from_center(_LX[2], y),
        "D": _roi_from_center(_LX[3], y),
    }
    BUBBLE_COORDS[q_right] = {
        "A": _roi_from_center(_RX[0], y),
        "B": _roi_from_center(_RX[1], y),
        "C": _roi_from_center(_RX[2], y),
        "D": _roi_from_center(_RX[3], y),
    }
