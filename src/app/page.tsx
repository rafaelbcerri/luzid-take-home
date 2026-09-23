import { PageShell } from "@/components/layout/page-shell";
import { RecordingList } from "@/components/recordings/recording-list";
import { Hero } from "@/components/upload/hero";
import { UploadPanel } from "@/components/upload/upload-panel";
import { listRecordings } from "@/lib/db/recordings-repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Test Scripts · Luzid",
  description:
    "Turn a screen recording into an editable test script with steps and screenshots.",
};

export default async function HomePage() {
  const recordings = await listRecordings();

  return (
    <PageShell>
      <div className="space-y-8">
        <Hero recordingCount={recordings.length} />
        <UploadPanel />
        <RecordingList recordings={recordings} />
      </div>
    </PageShell>
  );
}
