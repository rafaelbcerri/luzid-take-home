import type { EvidenceAnnotation } from "@/lib/evidence/annotation-geometry";

type EvidenceAnnotationOverlayProps = {
  annotations: EvidenceAnnotation[];
  imageWidth: number;
  imageHeight: number;
};

export function EvidenceAnnotationOverlay({
  annotations,
  imageWidth,
  imageHeight,
}: EvidenceAnnotationOverlayProps) {
  if (annotations.length === 0) return null;

  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${imageWidth} ${imageHeight}`}
      preserveAspectRatio="xMidYMid meet"
      className="pointer-events-none absolute inset-0 size-full text-accent-500"
    >
      {annotations.map((annotation, index) => (
        <g key={index}>
          <rect
            x={annotation.x * imageWidth}
            y={annotation.y * imageHeight}
            width={annotation.width * imageWidth}
            height={annotation.height * imageHeight}
            fill="none"
            stroke="white"
            strokeWidth="6"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            x={annotation.x * imageWidth}
            y={annotation.y * imageHeight}
            width={annotation.width * imageWidth}
            height={annotation.height * imageHeight}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}
