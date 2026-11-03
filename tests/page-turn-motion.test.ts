import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { pageTurnEase } from "../src/components/pageTurnMotion";

const motion = readFileSync(new URL("../src/components/useInvitationMotion.ts", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/components/invitation.css", import.meta.url), "utf8");

describe("smooth page-turn motion", () => {
  test("button turns start and stop at rest, with no initial velocity jump", () => {
    expect(pageTurnEase(0, true)).toBe(0);
    expect(pageTurnEase(1, true)).toBe(1);
    expect(pageTurnEase(0.5, true)).toBe(0.5);
    expect(pageTurnEase(0.01, true)).toBeLessThan(0.001);
    expect(1 - pageTurnEase(0.99, true)).toBeLessThan(0.001);
    expect(pageTurnEase(-1, true)).toBe(0);
    expect(pageTurnEase(2, true)).toBe(1);
    let previous = 0;
    for (let i = 0; i <= 100; i++) {
      const p = i / 100;
      const value = pageTurnEase(p, true);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value + pageTurnEase(1 - p, true)).toBeCloseTo(1, 12);
      previous = value;
    }
  });

  test("swipe settling retains immediate ease-out response", () => {
    expect(pageTurnEase(0)).toBe(0);
    expect(pageTurnEase(1)).toBe(1);
    expect(pageTurnEase(0.5)).toBe(0.875);
    expect(pageTurnEase(0.1)).toBeGreaterThan(pageTurnEase(0.1, true));
  });

  test("initializes the mesh before attaching it and clocks from its first frame", () => {
    const initialize = motion.indexOf("renderDrag({ direction, tilt: 0");
    const attach = motion.indexOf("(leaf || host).append(mesh)");
    expect(initialize).toBeGreaterThan(-1);
    expect(initialize).toBeLessThan(attach);
    expect(motion).toContain("start ??= now");
    expect(motion).toContain("rafs.delete(id)");
    expect(motion).toContain("animateLeaf(g, 0, 1, 760, true)");
    expect(motion).not.toContain("s.front.style.filter");
    expect(motion).toContain("s.shade.style.opacity");
  });

  test("prepares bounded invisible meshes and clears them on resize, rewrap and unmount", () => {
    expect(motion).toContain("([1, -1] as const)");
    expect(motion).toContain("version !== preparationVersion");
    expect(motion).toContain('mesh.classList.add("turn-prepared")');
    expect(motion).toContain('mesh.classList.remove("turn-prepared")');
    expect(motion).toContain("preparedTurns.forEach(({ mesh }) => mesh.remove())");
    expect(motion).toContain("preparationTimers.clear()");
    expect(motion).toContain("window.clearTimeout(id)");
    expect(motion).toMatch(/const rewrap = async[^]*?clearPreparedTurns\(\)/);
    expect(motion).toMatch(/on\(window, "resize",[^]*?clearPreparedTurns\(\)/);
    expect(motion).toMatch(/controller.abort\(\);\s*clearPreparedTurns\(\)/);
    expect(motion).toContain('mesh.setAttribute("aria-hidden", "true")');
    expect(motion).toContain("mesh.inert = true");
    expect(css).toContain(".turn-mesh.turn-prepared{visibility:hidden}");
  });

  test("retains seven-strip curl, reverse direction, touch gestures and reduced motion", () => {
    expect(motion).toContain("count = reduced ? 1 : 7");
    expect(motion).toContain("g.direction === 1 ? progress : 1 - progress");
    expect(motion).toContain("fold * 0.8");
    expect(motion).toContain("g.progress > 0.3");
    expect(motion).toContain('on(leaf, "pointercancel", () => settleGesture(true))');
    expect(motion).toContain('on(leaf, "lostpointercapture", () => settleGesture(true))');
    expect(css).toContain("perspective:1500px;touch-action:pan-y pinch-zoom");
    expect(css).toContain(".turn-mesh:not(.turn-prepared) .paper-strip{will-change:transform}");
    expect(css).toContain(".strip-shade");
    for (const design of ["noir", "rose"]) {
      expect(css).toContain(`invite-design-${design}`);
    }
    // Thazin is the unqualified base paper-theatre design.
    expect(css).toContain(".invite .popup-raised .popup-stand");
  });
});
