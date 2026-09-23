"use client";

import { useEffect, useRef, useState } from "react";

import { classNames } from "@/components/ui/class-names";
import { MoreIcon } from "@/components/ui/icons";

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  isDisabled?: boolean;
  isDestructive?: boolean;
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
          "grid size-8 place-items-center rounded-[var(--radius-control)] text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-900",
          isOpen && "bg-ink-100 text-ink-900",
        )}
      >
        <MoreIcon className="size-4" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-1 w-44 overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.isDisabled}
              onClick={() => {
                setIsOpen(false);
                item.onSelect();
              }}
              className={classNames(
                "block w-full px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                item.isDestructive
                  ? "text-danger-600 hover:bg-danger-50"
                  : "text-ink-700 hover:bg-ink-50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
