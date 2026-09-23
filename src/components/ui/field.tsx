"use client";

import {
  useEffect,
  useRef,
  type TextareaHTMLAttributes,
} from "react";

import { classNames } from "@/components/ui/class-names";

const SHARED_FIELD_CLASS_NAMES =
  "w-full rounded-[var(--radius-control)] border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors hover:border-ink-300 focus:border-accent-500 focus:outline-none";

type AutoGrowingTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

/**
 * Textarea that grows with its content, so a long step description never hides
 * behind an inner scrollbar while being edited.
 */
export function AutoGrowingTextarea({
  label,
  hint,
  className,
  value,
  ...textareaProps
}: AutoGrowingTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  // An autofocused field starts with the caret at the end, so typing appends to
  // the existing text instead of pushing in front of it.
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !textareaProps.autoFocus) return;

    const caretPosition = textarea.value.length;
    textarea.setSelectionRange(caretPosition, caretPosition);
  }, [textareaProps.autoFocus]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">
        {label}
      </span>
      <textarea
        {...textareaProps}
        ref={textareaRef}
        value={value}
        rows={1}
        className={classNames(
          SHARED_FIELD_CLASS_NAMES,
          "resize-none leading-relaxed",
          className,
        )}
      />
      {hint ? (
        <span className="mt-1 block text-xs text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}
