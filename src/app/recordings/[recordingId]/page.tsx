import { notFound } from "next/navigation";

import { PageShell } from "@/components/layout/page-shell";
import { RecordingDetail } from "@/components/recordings/recording-detail";
import { serializeRecording } from "@/lib/api/serialize-recording";
import { getAuthenticatedUserId, requirePageUserId } from "@/lib/auth/session";
import { env } from "@/lib/config/env";
import { findRecordingWithSteps, findShareForOwner } from "@/lib/db/recordings-repository";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/recordings/[recordingId]">) {
  const { recordingId } = await params;
  const ownerUserId = await getAuthenticatedUserId();
  const recording = ownerUserId
    ? await findRecordingWithSteps(recordingId, ownerUserId)
    : null;

  return { title: recording ? `${recording.title} · Luzid` : "Script not found" };
}

export default async function RecordingPage({
  params,
}: PageProps<"/recordings/[recordingId]">) {
  const { recordingId } = await params;
  const ownerUserId = await requirePageUserId(`/recordings/${recordingId}`);
  const recording = await findRecordingWithSteps(recordingId, ownerUserId);

  if (!recording) notFound();
  const share = await findShareForOwner(recordingId, ownerUserId);

  return (
    <PageShell isWide>
      <RecordingDetail
        initialRecording={await serializeRecording(recording)}
        initialShareUrl={share ? `/share/${share.token}` : null}
        shareOrigin={new URL(env.APP_ORIGIN).origin}
      />
    </PageShell>
  );
}
