def _roi_from_center(cx: int, cy: int, r: int = 11):
    return (cx - r, cy - r, cx + r, cy + r)

OPTIONS = ["A", "B", "C", "D"]
IMG_W = 800
IMG_H = 1100

def roi_center(roi):
    x1, y1, x2, y2 = roi
    return ((x1 + x2) // 2, (y1 + y2) // 2)

_LX = [188, 219, 250, 280]
_RX = [460, 490, 520, 550]

# Q1 y=289, Q25 y=885, spacing = (885-289)/24 = 24.8 ≈ 25px
_Y = [round(289 + i * (596/24)) for i in range(25)]

BUBBLE_COORDS = {}
for i, y in enumerate(_Y):
    q_left  = i + 1
    q_right = i + 26
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
