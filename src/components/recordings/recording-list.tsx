import Link from "next/link";

import { FilmIcon } from "@/components/ui/icons";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatRelativeDate, formatTimestamp } from "@/lib/format/timestamp";
import type { Recording } from "@/lib/types/process-step";

export function RecordingList({ recordings }: { recordings: Recording[] }) {
  if (recordings.length === 0) {
    return <EmptyRecordingList />;
  }

  return (
    <section>
      <h2 className="mb-4 text-lg text-ink-900">Your scripts</h2>
      <ul className="space-y-2">
        {recordings.map((recording) => (
          <li key={recording.id}>
            <Link
              href={`/recordings/${recording.id}`}
              className="surface-card flex items-center gap-4 px-4 py-3.5 transition-colors hover:border-ink-300 hover:bg-ink-50"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-control)] bg-ink-100 text-ink-500">
                <FilmIcon className="size-4" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink-900">
                  {recording.title}
                </span>
                <span className="block truncate text-xs text-ink-400">
                  {formatRelativeDate(recording.createdAt)}
                  {recording.durationSeconds
                    ? ` · ${formatTimestamp(recording.durationSeconds)}`
                    : ""}
                  {` · ${recording.originalFileName}`}
                </span>
              </span>

              <StatusBadge status={recording.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function EmptyRecordingList() {
  return (
    <section className="surface-card border-dashed px-6 py-10 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-full bg-ink-100 text-ink-400">
        <FilmIcon className="size-5" />
      </span>
      <h2 className="mt-4 text-base text-ink-900">No scripts yet</h2>
      <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">
        Record a process with QuickTime (File → New Screen Recording), upload it
        above, and your first test script will appear here.
      </p>
    </section>
  );
}
