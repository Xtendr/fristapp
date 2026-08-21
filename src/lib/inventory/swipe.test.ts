import assert from "node:assert/strict"
import test from "node:test"

import {
  clampSwipeOffset,
  resolveSwipeAxis,
  shouldRevealSwipe,
} from "./swipe.ts"

test("horizontal movement wins only after the gesture threshold", () => {
  assert.equal(resolveSwipeAxis(-4, 1), null)
  assert.equal(resolveSwipeAxis(-12, 3), "horizontal")
  assert.equal(resolveSwipeAxis(-5, 14), "vertical")
})

test("swipe offset stays inside the remove-action width", () => {
  assert.equal(clampSwipeOffset(-20, false), -20)
  assert.equal(clampSwipeOffset(-200, false), -80)
  assert.equal(clampSwipeOffset(30, false), 0)
  assert.equal(clampSwipeOffset(30, true), -50)
})

test("a deliberate left swipe reveals the remove action", () => {
  assert.equal(shouldRevealSwipe(-35), false)
  assert.equal(shouldRevealSwipe(-36), true)
})
