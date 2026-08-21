export const SWIPE_ACTION_WIDTH = 80
export const SWIPE_AXIS_THRESHOLD = 8
export const SWIPE_REVEAL_THRESHOLD = 36

export type SwipeAxis = "horizontal" | "vertical" | null

export function resolveSwipeAxis(
  deltaX: number,
  deltaY: number,
  threshold = SWIPE_AXIS_THRESHOLD
): SwipeAxis {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) return null
  return Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical"
}

export function clampSwipeOffset(
  deltaX: number,
  initiallyRevealed: boolean,
  width = SWIPE_ACTION_WIDTH
) {
  const start = initiallyRevealed ? -width : 0
  return Math.max(-width, Math.min(0, start + deltaX))
}

export function shouldRevealSwipe(
  offset: number,
  threshold = SWIPE_REVEAL_THRESHOLD
) {
  return offset <= -threshold
}
