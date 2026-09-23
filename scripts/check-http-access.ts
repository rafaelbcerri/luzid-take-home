import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createServerClient } from "@supabase/ssr";

import { env, STORAGE_BUCKETS } from "../src/lib/config/env";
import {
  appendStep,
  createRecording,
  deleteRecording,
  setStepEvidence,
} from "../src/lib/db/recordings-repository";
import { storage } from "../src/lib/storage/supabase-storage";

type FixtureUser = { id: string; cookie: string; accessToken: string };

async function createFixtureUser(): Promise<FixtureUser> {
  const email = `http-check-${randomUUID()}@example.com`;
  const password = `Test-${randomUUID()}`;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  assert.equal(response.status, 200, "fixture user creation failed");
  const { id } = (await response.json()) as { id: string };

  let cookies: { name: string; value: string }[] = [];
  const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (items) => {
        cookies = items.map(({ name, value }) => ({ name, value }));
      },
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  assert.equal(error, null, "fixture sign in failed");
  assert(data.session);
  return {
    id,
    accessToken: data.session.access_token,
    cookie: cookies.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; "),
  };
}

async function deleteFixtureUser(userId: string) {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  assert(response.ok, "fixture user deletion failed");
}

async function appFetch(path: string, cookie?: string, init: RequestInit = {}) {
  return fetch(new URL(path, env.APP_ORIGIN), {
    ...init,
    headers: { ...init.headers, ...(cookie ? { Cookie: cookie } : {}) },
    redirect: "manual",
  });
}

async function main() {
  const owner = await createFixtureUser();
  const other = await createFixtureUser();
  let recordingId: string | null = null;
  let screenshotPath: string | null = null;

  try {
    assert.equal((await appFetch("/api/recordings")).status, 401);
    assert.equal((await appFetch("/api/recordings", owner.cookie)).status, 200);

    const badUpload = new FormData();
    badUpload.set("video", new Blob(["not a video"], { type: "text/plain" }), "bad.txt");
    assert.equal((await appFetch("/api/recordings", owner.cookie, {
      method: "POST",
      body: badUpload,
    })).status, 415);

    const recording = await createRecording({
      ownerUserId: owner.id,
      title: "Client approval walkthrough",
      originalFileName: "private-source.mp4",
      videoPath: "private/source.mp4",
      durationSeconds: 10,
    });
    recordingId = recording.id;
    const step = await appendStep({ recordingId, ownerUserId: owner.id });
    assert(step);
    screenshotPath = `${recordingId}/${step.id}.png`;
    await storage.upload({
      bucket: STORAGE_BUCKETS.screenshots,
      path: screenshotPath,
      body: Buffer.from("89504e470d0a1a0a", "hex"),
      contentType: "image/png",
    });
    await setStepEvidence({ stepId: step.id, screenshotPath, evidenceTimestampSeconds: 1 });

    const detailPath = `/api/recordings/${recordingId}`;
    assert.equal((await appFetch(detailPath, other.cookie)).status, 404);
    assert.equal((await appFetch(detailPath)).status, 401);
    assert.equal((await appFetch(`${detailPath}/steps`, other.cookie, {
      method: "POST",
    })).status, 404);
    assert.equal((await appFetch(`/api/steps/${step.id}`, other.cookie, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "Wrong owner" }),
    })).status, 404);
    assert.equal((await appFetch(`/api/steps/${step.id}/frames`, other.cookie)).status, 404);
    assert.equal((await appFetch(`/api/steps/${step.id}/evidence`, other.cookie, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timestampSeconds: 1 }),
    })).status, 404);

    const sharePath = `${detailPath}/share`;
    assert.equal((await appFetch(sharePath, other.cookie)).status, 404);
    assert.equal((await appFetch(sharePath, other.cookie, { method: "POST" })).status, 404);
    const created = await appFetch(sharePath, owner.cookie, { method: "POST" });
    assert.equal(created.status, 200);
    const { url } = (await created.json()) as { url: string };
    assert.match(url, /^\/share\/[A-Za-z0-9_-]{43}$/);
    assert.equal((await appFetch(sharePath, owner.cookie, { method: "POST" }).then((r) => r.json()) as { url: string }).url, url);
    const publicPage = await appFetch(url);
    assert.equal(publicPage.status, 200);
    const html = await publicPage.text();
    assert(html.includes("Client approval walkthrough"));
    assert(!html.includes("private-source.mp4"));
    assert(!html.includes("private/source.mp4"));
    assert(!html.includes(owner.id));
    assert(!html.includes(screenshotPath));

    const screenshotUrl = `${url}/screenshots/${step.id}`;
    const screenshot = await appFetch(screenshotUrl);
    assert.equal(screenshot.status, 200);
    assert.equal(screenshot.headers.get("content-type"), "image/png");
    assert.match(screenshot.headers.get("cache-control") ?? "", /no-store/);
    assert.equal((await appFetch(`${url}/screenshots/${randomUUID()}`)).status, 404);

    const revoked = await appFetch(sharePath, owner.cookie, { method: "DELETE" });
    assert.equal(revoked.status, 200);
    const unavailablePage = await appFetch(url);
    assert.equal(unavailablePage.status, 200);
    const unavailableHtml = await unavailablePage.text();
    assert(unavailableHtml.includes("This link is no longer available."));
    assert(!unavailableHtml.includes("Client approval walkthrough"));
    assert.equal((await appFetch(screenshotUrl)).status, 404);
    const replacement = await appFetch(sharePath, owner.cookie, { method: "POST" });
    assert.equal(replacement.status, 200);
    assert.notEqual(((await replacement.json()) as { url: string }).url, url);

    for (const table of ["recordings", "process_steps", "recording_public_shares"]) {
      const direct = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?select=*`, {
        headers: {
          apikey: env.SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${owner.accessToken}`,
        },
      });
      assert.equal(direct.status, 403, `${table} was exposed through the Data API`);
    }

    console.log("HTTP access check passed: two owners, bad file, sharing, screenshot revoke, and Data API grants.");
  } finally {
    if (screenshotPath) await storage.remove({ bucket: STORAGE_BUCKETS.screenshots, paths: [screenshotPath] });
    if (recordingId) await deleteRecording(recordingId, owner.id);
    await deleteFixtureUser(owner.id);
    await deleteFixtureUser(other.id);
  }
}

void main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
