export function PublicScriptField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold tracking-[0.08em] text-ink-500 uppercase">{label}</p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-800">{value}</p>
    </div>
  );
}
