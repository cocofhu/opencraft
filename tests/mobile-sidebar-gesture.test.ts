import assert from "node:assert/strict";
import test from "node:test";
import { arbitrateMobileGesture, mobileGestureVelocity, mobileSidebarWidth, sidebarReleaseVelocity, sidebarGestureAxis, sidebarGestureProgress, sidebarGestureTarget } from "../apps/workbench-web/src/components/mobile-sidebar-gesture";

test("small movement and vertical scrolling do not acquire a sidebar gesture", () => {
  assert.equal(sidebarGestureAxis(-4, 3), "pending");
  assert.equal(sidebarGestureAxis(-20, 60), "vertical");
  assert.equal(sidebarGestureAxis(-60, 15), "horizontal");
  assert.equal(sidebarGestureAxis(10, 9), "pending", "a diagonal start does not prematurely lock vertical");
});

const competingContact = {
  owner: "pending" as const, dx: 32, dy: 4, elapsed: 40, velocity: 0.8,
  sidebarAllowed: true, initiallyOpen: false, horizontalContent: true, contentCanScroll: true,
};

test("a deliberate fast horizontal drag wins before rich content starts scrolling", () => {
  assert.equal(arbitrateMobileGesture(competingContact), "sidebar");
  assert.equal(arbitrateMobileGesture({ ...competingContact, dx: 27 }), "pending");
  assert.equal(arbitrateMobileGesture({ ...competingContact, velocity: 0.64 }), "content");
  assert.equal(arbitrateMobileGesture({ ...competingContact, dy: 20 }), "content");
});

test("slow or late intent commits to content and cannot become navigation later", () => {
  const slow = { ...competingContact, dx: 18, elapsed: 110, velocity: 0.15 };
  const owner = arbitrateMobileGesture(slow);
  assert.equal(owner, "content");
  assert.equal(arbitrateMobileGesture({ ...competingContact, owner }), "content");
  assert.equal(arbitrateMobileGesture({ ...competingContact, owner: "sidebar", dx: -90 }), "sidebar");
});

test("vertical reading, reserved edges and closed drawer direction retain their owners", () => {
  assert.equal(arbitrateMobileGesture({ ...competingContact, dx: 4, dy: -32 }), "native");
  assert.equal(arbitrateMobileGesture({ ...competingContact, sidebarAllowed: false }), "content");
  assert.equal(arbitrateMobileGesture({ ...competingContact, dx: -32, velocity: -0.8 }), "content");
  assert.equal(arbitrateMobileGesture({ ...competingContact, dx: -32, velocity: -0.8, initiallyOpen: true }), "sidebar");
});

test("plain content and an exhausted scroll direction do not need a competing flick", () => {
  assert.equal(arbitrateMobileGesture({ ...competingContact, dx: 12, velocity: 0.1, horizontalContent: false }), "sidebar");
  assert.equal(arbitrateMobileGesture({ ...competingContact, dx: 12, velocity: 0.1, contentCanScroll: false }), "sidebar");
});

test("speed uses the recent window, retains pauses and rejects opposite motion", () => {
  assert.equal(mobileGestureVelocity([{ x: 0, time: 0 }], 32, 40), 0.8);
  assert.equal(mobileGestureVelocity([{ x: 0, time: 0 }, { x: 80, time: 80 }], 80, 200), 0);
  assert.equal(mobileGestureVelocity([{ x: 0, time: 0 }, { x: 20, time: 100 }], 100, 180), 1);
  assert.equal(arbitrateMobileGesture({ ...competingContact, velocity: -0.8 }), "content");
});

test("sidebar release retains its established sampling and stationary release behavior", () => {
  const samples = [{ x: 0, time: 0 }, { x: 30, time: 40 }, { x: 70, time: 100 }];
  assert.equal(sidebarReleaseVelocity(samples, 80, 120), 80 / 120);
  assert.equal(sidebarReleaseVelocity([{ x: 0, time: 0 }, { x: 50, time: 150 }], 50, 180), 0);
  assert.equal(sidebarReleaseVelocity(samples, 70, 300), 70 / 300);
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
