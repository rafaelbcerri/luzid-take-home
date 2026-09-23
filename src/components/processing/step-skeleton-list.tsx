/** Placeholder cards shown while the first steps are still being extracted. */
export function StepSkeletonList({ count = 3 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-hidden>
      {Array.from({ length: count }, (_, index) => (
        <li key={index} className="surface-card flex gap-5 p-5">
          <div className="skeleton size-7 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2.5">
            <div className="skeleton h-4 w-2/5 rounded" />
            <div className="skeleton h-3 w-4/5 rounded" />
            <div className="skeleton h-3 w-3/5 rounded" />
          </div>
          <div className="skeleton hidden h-28 w-56 rounded-[var(--radius-control)] sm:block" />
        </li>
      ))}
    </ul>
  );
}
