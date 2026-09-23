/** Formats seconds as `M:SS`, the notation consultants use in test scripts. */
export function formatTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatRelativeDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
