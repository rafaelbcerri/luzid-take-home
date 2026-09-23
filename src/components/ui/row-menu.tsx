"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";

import { classNames } from "@/components/ui/class-names";
import { MoreIcon } from "@/components/ui/icons";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  isDisabled?: boolean;
  isDestructive?: boolean;
  /** Draws a hairline above this item, grouping what comes before it. */
  hasSeparatorAbove?: boolean;
};

type RowMenuProps = {
  label: string;
  items: RowMenuItem[];
};

/**
 * The "⋮" overflow menu at the end of a table row. Closes on Escape, on a click
 * anywhere else, and as soon as an item is chosen.
 */
export function RowMenu({ label, items }: RowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
        className={classNames(
          "grid size-11 place-items-center rounded-[var(--radius-control)] border transition-colors",
          isOpen
            ? "border-ink-300 bg-ink-100 text-ink-900"
            : "border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50",
        )}
      >
        <MoreIcon className="size-5" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-[236px] overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white p-1.5 shadow-lg"
        >
          {items.map((item) => (
            <Fragment key={item.label}>
              {item.hasSeparatorAbove ? (
                <span className="mx-1 my-1.5 block h-px bg-ink-200" />
              ) : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.isDisabled}
                onClick={() => {
                  setIsOpen(false);
                  item.onSelect();
                }}
                className={classNames(
                  "flex h-11 w-full items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  item.isDestructive
                    ? "text-danger-600 hover:bg-danger-50"
                    : "text-ink-900 hover:bg-ink-50",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </Fragment>
          ))}
        </div>
      ) : null}
    </div>
  );
}
