import { PublicScript } from "@/components/sharing/public-script";
import { SharedScriptUnavailable } from "@/components/sharing/shared-script-unavailable";
import { findPublicRecordingByToken } from "@/lib/db/recordings-repository";
import { toPublicRecording } from "@/lib/sharing/public-recording";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shared test script · Luzid",
  robots: { index: false, follow: false },
};

export default async function SharedScriptPage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const recording = await findPublicRecordingByToken(token);
  if (!recording) return <SharedScriptUnavailable />;
  return <PublicScript recording={toPublicRecording(recording, token)} />;
}
