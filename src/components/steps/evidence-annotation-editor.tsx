"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { EvidenceAnnotationOverlay } from "@/components/steps/evidence-annotation-overlay";
import { Button } from "@/components/ui/button";
import { CloseIcon, TrashIcon } from "@/components/ui/icons";
import { saveEvidenceAnnotationsRequest } from "@/lib/api/client";
import type { SerializedStep } from "@/lib/api/serialize-recording";
import {
  createAnnotation,
  moveAnnotation,
  resizeAnnotation,
  type AnnotationPoint,
  type EvidenceAnnotation,
  type ResizeHandle,
} from "@/lib/evidence/annotation-geometry";

type EvidenceAnnotationEditorProps = {
  step: SerializedStep;
  stepNumber: number;
  onClose: () => void;
  onSaved: (step: SerializedStep) => void;
};

type Drag =
  | { type: "draw"; start: AnnotationPoint; kind: EvidenceAnnotation["kind"] }
  | { type: "move"; start: AnnotationPoint; index: number; original: EvidenceAnnotation }
  | { type: "resize"; start: AnnotationPoint; index: number; original: EvidenceAnnotation; handle: ResizeHandle };

const HANDLES: ResizeHandle[] = ["nw", "ne", "sw", "se"];

export function EvidenceAnnotationEditor({
  step,
  stepNumber,
  onClose,
  onSaved,
}: EvidenceAnnotationEditorProps) {
  const [annotations, setAnnotations] = useState(step.evidenceAnnotations);
  const [draft, setDraft] = useState<EvidenceAnnotation | null>(null);
  const [tool, setTool] = useState<EvidenceAnnotation["kind"] | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1280, height: 720 });
  const [hasImageLoadError, setHasImageLoadError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const imageAspectRatio = imageSize.width / imageSize.height;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isSaving) onClose();
      if ((event.key === "Delete" || event.key === "Backspace") && selectedIndex !== null) {
        setAnnotations((current) => current.filter((_, index) => index !== selectedIndex));
        setSelectedIndex(null);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isSaving, onClose, selectedIndex]);

  function pointFromPointer(event: React.PointerEvent<SVGElement>): AnnotationPoint {
    const bounds = svgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  }

  function startDrag(event: React.PointerEvent<SVGElement>, drag: Drag) {
    dragRef.current = drag;
    svgRef.current!.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = pointFromPointer(event);
    if (drag.type === "draw") {
      setDraft(createAnnotation(drag.kind, drag.start, point, imageAspectRatio));
      return;
    }
    const deltaX = point.x - drag.start.x;
    const deltaY = point.y - drag.start.y;
    const changed = drag.type === "move"
      ? moveAnnotation(drag.original, deltaX, deltaY)
      : resizeAnnotation(drag.original, drag.handle, deltaX, deltaY, imageAspectRatio);
    setAnnotations((current) => current.map((annotation, index) => index === drag.index ? changed : annotation));
  }

  function handlePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.type === "draw") {
      const created = createAnnotation(drag.kind, drag.start, pointFromPointer(event), imageAspectRatio);
      if (created.width * imageSize.width >= 8 && created.height * imageSize.height >= 8 && annotations.length < 20) {
        setAnnotations((current) => [...current, created]);
        setSelectedIndex(annotations.length);
      }
      setDraft(null);
    }
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function addCenteredShape() {
    if (!tool || annotations.length >= 20) return;
    const annotation: EvidenceAnnotation = tool === "square"
      ? (() => {
          const width = Math.min(0.2, 0.5 / imageAspectRatio);
          const height = width * imageAspectRatio;
          return { kind: tool, x: (1 - width) / 2, y: (1 - height) / 2, width, height };
        })()
      : { kind: tool, x: 0.3, y: 0.35, width: 0.4, height: 0.3 };
    setAnnotations((current) => [...current, annotation]);
    setSelectedIndex(annotations.length);
    setTool(null);
  }

  function handleAnnotationKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      setAnnotations((current) => current.filter((_, currentIndex) => currentIndex !== index));
      setSelectedIndex(null);
      return;
    }
    const deltaX = event.key === "ArrowLeft" ? -0.01 : event.key === "ArrowRight" ? 0.01 : 0;
    const deltaY = event.key === "ArrowUp" ? -0.01 : event.key === "ArrowDown" ? 0.01 : 0;
    if (deltaX === 0 && deltaY === 0) return;
    event.preventDefault();
    setSelectedIndex(index);
    setAnnotations((current) => current.map((annotation, currentIndex) => {
      if (currentIndex !== index) return annotation;
      return event.shiftKey
        ? resizeAnnotation(annotation, "se", deltaX, deltaY, imageAspectRatio)
        : moveAnnotation(annotation, deltaX, deltaY);
    }));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      const response = await saveEvidenceAnnotationsRequest(step.id, step.evidenceTimestampSeconds, annotations);
      onSaved(response.step);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save the highlights. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`Highlight evidence for step ${stepNumber}`} className="fixed inset-0 z-50 grid place-items-center bg-ink-950/70 p-4 sm:p-6">
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[var(--radius-card)] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
          <div>
            <h2 className="text-[19px] text-ink-900">Highlight evidence for step {stepNumber}</h2>
            <p className="mt-1 text-sm text-ink-500">Choose a shape, then drag over the screenshot. Select a shape to move or resize it.</p>
          </div>
          <button type="button" aria-label="Close without saving highlights" onClick={onClose} disabled={isSaving} className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] border border-ink-200 text-ink-700 hover:bg-ink-50">
            <CloseIcon className="size-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-ink-200 px-5 py-3">
          {(["rectangle", "square"] as const).map((kind) => (
            <Button key={kind} variant={tool === kind ? "primary" : "secondary"} aria-pressed={tool === kind} onClick={() => { setTool(kind); setSelectedIndex(null); }}>
              <span aria-hidden="true" className={kind === "square" ? "inline-block size-4 border-2 border-current" : "inline-block h-3.5 w-5 border-2 border-current"} />
              {kind === "square" ? "Square" : "Rectangle"}
            </Button>
          ))}
          <Button variant="secondary" aria-pressed={tool === null} onClick={() => setTool(null)}>Select</Button>
          <Button variant="secondary" disabled={!tool || annotations.length >= 20} onClick={addCenteredShape}>Add centered shape</Button>
          <span className="flex-1" />
          <Button variant="danger" disabled={selectedIndex === null} onClick={() => { setAnnotations((current) => current.filter((_, index) => index !== selectedIndex)); setSelectedIndex(null); }}>
            <TrashIcon className="size-4" /> Remove selected
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto bg-ink-100 p-4 sm:p-6">
          <div
            className="relative shrink-0 overflow-hidden bg-white shadow-md"
            style={{ width: `min(100%, ${Math.round(60 * imageAspectRatio)}vh, ${imageSize.width}px)`, aspectRatio: imageAspectRatio }}
          >
            <Image
              src={step.screenshotUrl!}
              alt={`Evidence for step ${stepNumber}`}
              fill
              unoptimized
              sizes="(max-width: 1152px) 100vw, 1152px"
              onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
              onError={() => setHasImageLoadError(true)}
              className="object-contain"
            />
            {hasImageLoadError ? (
              <div role="alert" className="absolute inset-0 grid place-items-center bg-ink-50 p-6 text-center text-sm text-danger-600">
                The evidence image could not load. Close this editor and choose a frame again.
              </div>
            ) : null}
            {!hasImageLoadError ? <EvidenceAnnotationOverlay annotations={[...annotations, ...(draft ? [draft] : [])]} imageWidth={imageSize.width} imageHeight={imageSize.height} /> : null}
            {!hasImageLoadError ? <svg
              ref={svgRef}
              viewBox={`0 0 ${imageSize.width} ${imageSize.height}`}
              className="absolute inset-0 size-full touch-none"
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={() => { dragRef.current = null; setDraft(null); }}
            >
              <rect width={imageSize.width} height={imageSize.height} fill="transparent" className={tool ? "cursor-crosshair" : "cursor-default"} onPointerDown={(event) => {
                if (annotations.length >= 20 || !tool) { setSelectedIndex(null); return; }
                startDrag(event, { type: "draw", start: pointFromPointer(event), kind: tool });
              }} />
              {annotations.map((annotation, index) => (
                <g key={index}>
                  <rect
                    x={annotation.x * imageSize.width}
                    y={annotation.y * imageSize.height}
                    width={annotation.width * imageSize.width}
                    height={annotation.height * imageSize.height}
                    fill="transparent"
                    className="cursor-move"
                    pointerEvents={tool ? "none" : "all"}
                    onPointerDown={(event) => { setSelectedIndex(index); startDrag(event, { type: "move", start: pointFromPointer(event), index, original: annotation }); }}
                  />
                  {tool === null && selectedIndex === index ? HANDLES.map((handle) => {
                    const x = (annotation.x + (handle.includes("e") ? annotation.width : 0)) * imageSize.width;
                    const y = (annotation.y + (handle.includes("s") ? annotation.height : 0)) * imageSize.height;
                    return <circle key={handle} cx={x} cy={y} r={Math.max(5, imageSize.width / 140)} fill="white" stroke="currentColor" strokeWidth="3" className="cursor-nwse-resize text-accent-500" onPointerDown={(event) => { event.stopPropagation(); startDrag(event, { type: "resize", start: pointFromPointer(event), index, original: annotation, handle }); }} />;
                  }) : null}
                </g>
              ))}
            </svg> : null}
          </div>
          <p className="mt-3 text-center text-xs text-ink-500">{annotations.length}/20 highlights · Drag corners to resize · Delete removes the selected shape</p>
          {annotations.length > 0 ? (
            <div className="mt-3 flex max-w-full flex-wrap justify-center gap-2" aria-label="Evidence highlights">
              {annotations.map((annotation, index) => (
                <Button
                  key={index}
                  size="sm"
                  variant={selectedIndex === index ? "primary" : "secondary"}
                  aria-pressed={selectedIndex === index}
                  onClick={() => { setTool(null); setSelectedIndex(index); }}
                  onKeyDown={(event) => handleAnnotationKeyDown(event, index)}
                >
                  {annotation.kind === "square" ? "Square" : "Rectangle"} {index + 1}
                </Button>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-center text-xs text-ink-500">Keyboard: add a centered shape, then focus its label. Arrow keys move it; Shift + arrow keys resize it.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-200 px-5 py-4">
          <p role={saveError ? "alert" : undefined} className="text-sm text-danger-600">{saveError}</p>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
            <Button isLoading={isSaving} disabled={hasImageLoadError} onClick={() => void handleSave()}>Save highlights</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
