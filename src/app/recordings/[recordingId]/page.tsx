import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { RecordingDetail } from "@/components/recordings/recording-detail";
import { serializeRecording } from "@/lib/api/serialize-recording";
import { findRecordingWithSteps } from "@/lib/db/recordings-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/recordings/[recordingId]">) {
  const { recordingId } = await params;
  const recording = await findRecordingWithSteps(recordingId);

  return { title: recording ? `${recording.title} · Luzid` : "Script not found" };
}

export default async function RecordingPage({
  params,
}: PageProps<"/recordings/[recordingId]">) {
  const { recordingId } = await params;
  const recording = await findRecordingWithSteps(recordingId);

  if (!recording) notFound();

  return (
    <PageShell>
      <RecordingDetail
        initialRecording={await serializeRecording(recording)}
      />
    </PageShell>
  );
}
