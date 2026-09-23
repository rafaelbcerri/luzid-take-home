import { classNames } from "@/components/ui/class-names";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={classNames(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
