/** Dark hero with the orange glow, matching the luzid.io landing page. */
export function Hero({ recordingCount }: { recordingCount: number }) {
  return (
    <section className="ink-gradient relative overflow-hidden rounded-[var(--radius-card)] px-8 py-12 text-white">
      <span className="inline-flex items-center rounded-[var(--radius-control)] bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
        Gemini video understanding
      </span>

      <h1 className="mt-5 max-w-2xl text-4xl leading-[1.1] sm:text-5xl">
        Turn a screen recording
        <br />
        into a test script.
      </h1>

      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-300">
        Upload a two-minute recording and get an editable list of steps — each
        with an action, description, expected result and screenshot. What used
        to take 45 minutes by hand now takes one.
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
