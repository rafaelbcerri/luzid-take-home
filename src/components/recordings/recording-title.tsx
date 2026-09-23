"use client";

import { useState, type KeyboardEvent } from "react";

import { Button } from "@/components/ui/button";
import { PencilIcon } from "@/components/ui/icons";

type RecordingTitleProps = {
  title: string;
  onRename: (title: string) => Promise<void>;
};

/** The script's name, edited where it is read rather than in a dialog. */
export function RecordingTitle({ title, onRename }: RecordingTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    setDraftTitle(title);
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEditing() {
    setDraftTitle(title);
    setSaveError(null);
    setIsEditing(false);
  }

  async function saveTitle() {
    const nextTitle = draftTitle.trim();

    if (nextTitle.length === 0) {
      setSaveError("A script needs a name so it can be found again.");
      return;
    }

    if (nextTitle === title) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onRename(nextTitle);
      setIsEditing(false);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save the new name.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      void saveTitle();
    }
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2.5">
        <input
          autoFocus
          value={draftTitle}
          aria-label="Script name"
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={handleKeyDown}
          className="h-14 w-full rounded-[var(--radius-control)] border border-accent-500 bg-white px-3.5 text-[28px] font-medium tracking-[-0.03em] text-ink-900"
        />

        {saveError ? (
          <p role="alert" className="text-sm text-danger-600">
            {saveError}
          </p>
        ) : null}

        <div className="flex items-center gap-3">
          <Button isLoading={isSaving} onClick={saveTitle}>
            Save name
          </Button>
          <Button variant="secondary" onClick={cancelEditing} disabled={isSaving}>
            Cancel
          </Button>
          <span className="text-[13px] text-ink-500">
            Enter to save · Escape to cancel
          </span>
        </div>
      </div>
    );
  }

  // The pencil is transparent until hover or focus but never `hidden`: a hidden
  // button cannot be reached by keyboard.
  return (
    <div className="group flex items-center gap-2.5">
      <h1 className="-mx-2 rounded-[var(--radius-control)] px-2 text-2xl leading-tight text-ink-900 transition-colors group-hover:bg-ink-100 sm:text-3xl">
        {title}
      </h1>
      <button
        type="button"
        aria-label="Rename this script"
        onClick={startEditing}
        className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] border border-ink-200 bg-white text-ink-700 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        <PencilIcon className="size-[18px]" />
      </button>
    </div>
  );
}
