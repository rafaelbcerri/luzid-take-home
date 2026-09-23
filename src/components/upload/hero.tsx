/** Dark hero with the orange glow, matching the luzid.io landing page. */
export function Hero({ recordingCount }: { recordingCount: number }) {
  return (
    <section className="ink-gradient relative overflow-hidden rounded-[var(--radius-card)] px-8 py-12 text-white">
      <span className="inline-flex items-center rounded-[var(--radius-control)] bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
        Your consultant workspace
      </span>

      <h1 className="mt-5 max-w-2xl text-4xl leading-[1.1] sm:text-5xl">
        Build a test script
        <br />
        from a recording.
      </h1>

      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-300">
        Upload a screen recording, review the generated steps and screenshots,
        then share the finished script with your client. Only you can edit it.
      </p>

      {recordingCount > 0 ? (
        <p className="mt-6 text-sm text-ink-400">
          {recordingCount} {recordingCount === 1 ? "script" : "scripts"} in this
          workspace
        </p>
      ) : null}
    </section>
  );
}
