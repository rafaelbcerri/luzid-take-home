import { describe, expect, it } from "vitest";

import {
  createAnnotation,
  moveAnnotation,
  resizeAnnotation,
} from "@/lib/evidence/annotation-geometry";

describe("evidence annotation geometry", () => {
  it("draws a rectangle in either drag direction", () => {
    expect(createAnnotation("rectangle", { x: 0.8, y: 0.7 }, { x: 0.2, y: 0.1 }, 2)).toEqual({
      kind: "rectangle", x: 0.2, y: 0.1, width: 0.6, height: 0.6,
    });
  });

  it("keeps a square square in image pixels", () => {
    expect(createAnnotation("square", { x: 0.1, y: 0.1 }, { x: 0.3, y: 0.3 }, 2)).toEqual({
      kind: "square", x: 0.1, y: 0.1, width: 0.2, height: 0.4,
    });
  });

  it("keeps moved shapes inside the image", () => {
    expect(moveAnnotation({ kind: "rectangle", x: 0.2, y: 0.2, width: 0.3, height: 0.4 }, 0.8, -0.4)).toEqual({
      kind: "rectangle", x: 0.7, y: 0, width: 0.3, height: 0.4,
    });
  });

  it("resizes a square from its bottom right handle without leaving the image", () => {
    expect(resizeAnnotation({ kind: "square", x: 0.7, y: 0.7, width: 0.1, height: 0.2 }, "se", 0.3, 0.4, 2)).toEqual({
      kind: "square", x: 0.7, y: 0.7, width: 0.15, height: 0.3,
    });
  });

  it("shrinks a square when just one corner axis moves inward", () => {
    expect(resizeAnnotation({ kind: "square", x: 0.2, y: 0.2, width: 0.2, height: 0.4 }, "se", -0.1, 0, 2)).toEqual({
      kind: "square", x: 0.2, y: 0.2, width: 0.1, height: 0.2,
    });
  });
});
