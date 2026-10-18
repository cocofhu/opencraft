import assert from "node:assert/strict";
import test from "node:test";
import { mobileSidebarWidth, sidebarGestureAxis, sidebarGestureProgress, sidebarGestureTarget } from "../apps/workbench-web/src/components/mobile-sidebar-gesture";

test("small movement and vertical scrolling do not acquire a sidebar gesture", () => {
  assert.equal(sidebarGestureAxis(-4, 3), "pending");
  assert.equal(sidebarGestureAxis(-20, 60), "vertical");
  assert.equal(sidebarGestureAxis(-60, 15), "horizontal");
});
test("right swipe reveals and left swipe closes proportionally to actual width", () => {
  assert.equal(sidebarGestureProgress(0, 100, 400), .25);
  assert.equal(sidebarGestureProgress(1, -100, 400), .75);
  assert.equal(sidebarGestureProgress(0, 100, 200), .5);
  assert.equal(sidebarGestureProgress(0, -100, 400), 0);
  assert.equal(sidebarGestureProgress(1, 100, 400), 1);
});
test("short slow drags return to their initial state; distance or deliberate flick commits", () => {
  assert.equal(sidebarGestureTarget(.2, 0, -80, false), false);
  assert.equal(sidebarGestureTarget(.8, 0, 80, true), true);
  assert.equal(sidebarGestureTarget(.6, 0, -180, false), true);
  assert.equal(sidebarGestureTarget(.4, 0, 180, true), false);
  assert.equal(sidebarGestureTarget(.2, .8, -60, false), true);
  assert.equal(sidebarGestureTarget(.8, -.8, 60, true), false);
  assert.equal(sidebarGestureTarget(.01, 1, -4, false), false);
  assert.equal(sidebarGestureTarget(.9, -.8, 60, false), false, "a reversed flick changes the completion direction");
});

test("mobile drawer fits small screens, retains a dismissal gutter and does not mutate saved width", () => {
  for (const width of [320, 390, 430]) {
    assert.ok(mobileSidebarWidth(width, 275) <= width - 64);
    assert.ok(mobileSidebarWidth(width, 520) <= width - 64);
  }
  assert.equal(mobileSidebarWidth(390, 275), 275, "mobile no longer expands a narrow sidebar to a viewport percentage");
  assert.equal(mobileSidebarWidth(430, 335), 335, "normal unified width remains stable on a larger phone");
  assert.equal(mobileSidebarWidth(320, 335), 256, "small screens still retain their dismissal gutter");
});
