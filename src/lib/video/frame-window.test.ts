import { describe, expect, it } from "vitest";

import { buildFrameWindow } from "@/lib/video/frame-window";

describe("buildFrameWindow", () => {
  it("centres the window on the given timestamp", () => {
    expect(
      buildFrameWindow({ centerSeconds: 10, durationSeconds: 60, count: 5, stepSeconds: 0.8 }),
    ).toEqual([8.4, 9.2, 10, 10.8, 11.6]);
  });

  it("includes the centre timestamp when the count is even", () => {
    const window = buildFrameWindow({
      centerSeconds: 10,
      durationSeconds: 60,
      count: 4,
      stepSeconds: 1,
    });
    expect(window).toContain(10);
    expect(window).toHaveLength(4);
  });

  it("never returns a timestamp before the start of the video", () => {
    const window = buildFrameWindow({
      centerSeconds: 0.4,
      durationSeconds: 60,
      count: 5,
      stepSeconds: 0.8,
    });
    expect(Math.min(...window)).toBeGreaterThanOrEqual(0);
    expect(window).toContain(0.4);
  });

  it("never returns a timestamp past the end of the video", () => {
    const window = buildFrameWindow({
      centerSeconds: 59.9,
      durationSeconds: 60,
      count: 5,
      stepSeconds: 0.8,
    });
    expect(Math.max(...window)).toBeLessThanOrEqual(59.8);
  });

  it("returns ascending, unique timestamps", () => {
    const window = buildFrameWindow({
      centerSeconds: 0,
      durationSeconds: 1,
      count: 6,
      stepSeconds: 0.8,
    });
    expect(window).toEqual([...window].sort((a, b) => a - b));
    expect(new Set(window).size).toBe(window.length);
  });

  it("falls back to the centre alone when the duration is unknown", () => {
    expect(
      buildFrameWindow({ centerSeconds: 5, durationSeconds: null, count: 5, stepSeconds: 0.8 }),
    ).toEqual([3.4, 4.2, 5, 5.8, 6.6]);
  });
});
