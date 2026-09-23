export type EvidenceAnnotation = {
  kind: "rectangle" | "square";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnnotationPoint = { x: number; y: number };
export type ResizeHandle = "nw" | "ne" | "sw" | "se";

const MIN_SIZE = 0.005;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rounded(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function createAnnotation(
  kind: EvidenceAnnotation["kind"],
  start: AnnotationPoint,
  end: AnnotationPoint,
  imageAspectRatio: number,
): EvidenceAnnotation {
  const startX = clamp(start.x, 0, 1);
  const startY = clamp(start.y, 0, 1);
  const endX = clamp(end.x, 0, 1);
  const endY = clamp(end.y, 0, 1);

  if (kind === "rectangle") {
    return {
      kind,
      x: rounded(Math.min(startX, endX)),
      y: rounded(Math.min(startY, endY)),
      width: rounded(Math.abs(endX - startX)),
      height: rounded(Math.abs(endY - startY)),
    };
  }

  const xDirection = endX < startX ? -1 : 1;
  const yDirection = endY < startY ? -1 : 1;
  const maxWidth = xDirection > 0 ? 1 - startX : startX;
  const maxHeight = yDirection > 0 ? 1 - startY : startY;
  const width = Math.min(
    Math.max(Math.abs(endX - startX), Math.abs(endY - startY) / imageAspectRatio),
    maxWidth,
    maxHeight / imageAspectRatio,
  );
  return {
    kind,
    x: rounded(xDirection > 0 ? startX : startX - width),
    y: rounded(yDirection > 0 ? startY : startY - width * imageAspectRatio),
    width: rounded(width),
    height: rounded(width * imageAspectRatio),
  };
}

export function moveAnnotation(
  annotation: EvidenceAnnotation,
  deltaX: number,
  deltaY: number,
): EvidenceAnnotation {
  return {
    ...annotation,
    x: rounded(clamp(annotation.x + deltaX, 0, 1 - annotation.width)),
    y: rounded(clamp(annotation.y + deltaY, 0, 1 - annotation.height)),
  };
}

export function resizeAnnotation(
  annotation: EvidenceAnnotation,
  handle: ResizeHandle,
  deltaX: number,
  deltaY: number,
  imageAspectRatio: number,
): EvidenceAnnotation {
  const anchorX = handle.includes("w") ? annotation.x + annotation.width : annotation.x;
  const anchorY = handle.includes("n") ? annotation.y + annotation.height : annotation.y;
  const movingX = (handle.includes("w") ? annotation.x : annotation.x + annotation.width) + deltaX;
  const movingY = (handle.includes("n") ? annotation.y : annotation.y + annotation.height) + deltaY;
  const xDirection = handle.includes("w") ? -1 : 1;
  const yDirection = handle.includes("n") ? -1 : 1;
  const maxWidth = xDirection > 0 ? 1 - anchorX : anchorX;
  const maxHeight = yDirection > 0 ? 1 - anchorY : anchorY;
  const squareWidth = Math.abs(deltaX) >= Math.abs(deltaY) / imageAspectRatio
    ? annotation.width + xDirection * deltaX
    : annotation.width + yDirection * deltaY / imageAspectRatio;
  const width = annotation.kind === "square"
    ? clamp(squareWidth, MIN_SIZE, Math.min(maxWidth, maxHeight / imageAspectRatio))
    : clamp(Math.abs(movingX - anchorX), MIN_SIZE, maxWidth);
  const height = annotation.kind === "square"
    ? width * imageAspectRatio
    : clamp(Math.abs(movingY - anchorY), MIN_SIZE, maxHeight);

  return {
    ...annotation,
    x: rounded(xDirection > 0 ? anchorX : anchorX - width),
    y: rounded(yDirection > 0 ? anchorY : anchorY - height),
    width: rounded(width),
    height: rounded(height),
  };
}
