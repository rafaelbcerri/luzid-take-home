"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createShare, revokeShare } from "@/lib/api/client";

export function ShareControls({
  recordingId,
  initialShareUrl,
  shareOrigin,
}: {
  recordingId: string;
  initialShareUrl: string | null;
  shareOrigin: string;
}) {
  const [shareUrl, setShareUrl] = useState(initialShareUrl);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [isRevokingShare, setIsRevokingShare] = useState(false);
  const [isCopyingLink, setIsCopyingLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const absoluteUrl = shareUrl ? `${shareOrigin}${shareUrl}` : null;

  async function handleCreate() {
    setIsCreatingShare(true);
    setErrorMessage(null);
    setFeedback(null);
    try {
      const result = await createShare(recordingId);
      setShareUrl(result.url);
      setFeedback("Public link is ready. Anyone with it can view this script and its screenshots.");
    } catch {
      setErrorMessage("Could not create a link. Please try again.");
    } finally {
      setIsCreatingShare(false);
    }
  }

  async function handleCopy() {
    if (!absoluteUrl) return;
    setIsCopyingLink(true);
    setErrorMessage(null);
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setFeedback("Link copied.");
    } catch {
      setErrorMessage("Could not copy automatically. Select the link below and copy it manually.");
    } finally {
      setIsCopyingLink(false);
    }
  }

  async function handleRevoke() {
    const previousUrl = shareUrl;
    setShareUrl(null);
    setIsRevokingShare(true);
    setErrorMessage(null);
    setFeedback(null);
    try {
      await revokeShare(recordingId);
      setFeedback("Link revoked. You can create a new one whenever you are ready.");
    } catch {
      setShareUrl(previousUrl);
      setErrorMessage("The link is still active. Please try revoking it again.");
    } finally {
      setIsRevokingShare(false);
    }
  }

  return (
    <section className="surface-card p-5 sm:p-6" aria-labelledby="sharing-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 id="sharing-heading" className="text-lg">Share this script</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-500">
            Anyone with the link can view the steps and screenshots. The original recording stays private.
          </p>
        </div>
        {!shareUrl ? (
          <Button onClick={handleCreate} isLoading={isCreatingShare} disabled={isRevokingShare}>
            Create public link
          </Button>
        ) : null}
      </div>

      {shareUrl && absoluteUrl ? (
        <div className="mt-5 space-y-3">
          <label htmlFor="public-share-url" className="block text-xs font-semibold text-ink-700">
            Public link
          </label>
          <input
            id="public-share-url"
            type="text"
            readOnly
            value={absoluteUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="w-full rounded-[var(--radius-control)] border border-ink-300 bg-ink-50 px-3 py-2.5 text-sm text-ink-700"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCopy} isLoading={isCopyingLink}>Copy link</Button>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-[var(--radius-control)] border border-ink-300 px-4 text-sm font-medium text-ink-700 hover:bg-ink-50">
              Preview
            </a>
            <Button variant="secondary" onClick={handleRevoke} isLoading={isRevokingShare} className="text-danger-600">
              Revoke link
            </Button>
          </div>
        </div>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm text-success-600">{feedback}</p>
      {errorMessage ? <p role="alert" className="mt-2 text-sm text-danger-600">{errorMessage}</p> : null}
    </section>
  );
}
