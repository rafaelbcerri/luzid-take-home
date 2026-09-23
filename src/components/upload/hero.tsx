/** Dark hero with the orange glow, matching the luzid.io landing page. */
export function Hero({ recordingCount }: { recordingCount: number }) {
  return (
    <section className="ink-gradient relative overflow-hidden rounded-[var(--radius-card)] px-8 py-12 text-white">
      <h1 className="mt-5 max-w-2xl text-4xl leading-[1.1] sm:text-5xl">
        Turn a screen recording
        <br />
        into a test script.
      </h1>

      {recordingCount > 0 ? (
        <p className="mt-6 text-sm text-ink-400">
          {recordingCount} {recordingCount === 1 ? "script" : "scripts"} in this
          workspace
        </p>
      ) : null}
    </section>
  );
}
