import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createServerClient } from "@supabase/ssr";

import { env } from "../src/lib/config/env";

const email = `signup-check-${randomUUID()}@example.com`;
const password = `Test-${randomUUID()}`;
let userId: string | null = null;

async function main() {
  let cookies: { name: string; value: string }[] = [];
  const client = createServerClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => cookies,
      setAll: (items) => {
        cookies = items.map(({ name, value }) => ({ name, value }));
      },
    },
  });

  try {
    const signup = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: new URL("/auth/callback", env.APP_ORIGIN).toString() },
    });
    assert.equal(signup.error, null, "signup request failed");
    assert(signup.data.user, "signup did not create a user");
    userId = signup.data.user.id;
    assert(!signup.data.session, "signup should require email verification");

    const inboxResponse = await fetch("http://127.0.0.1:54324/api/v1/messages");
    assert.equal(inboxResponse.status, 200);
    const inbox = (await inboxResponse.json()) as {
      messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };
    const message = inbox.messages.find((item) => item.To.some((to) => to.Address === email));
    assert(message, "verification email was not delivered to local Mailpit");
    const messageResponse = await fetch(`http://127.0.0.1:54324/api/v1/message/${message.ID}`);
    assert.equal(messageResponse.status, 200);
    const content = (await messageResponse.json()) as { HTML: string; Text: string };
    const encodedUrl = (content.HTML || content.Text).match(/https?:\/\/[^\s"<>]+/)?.[0];
    assert(encodedUrl, "verification email had no link");
    const verificationUrl = encodedUrl.replaceAll("&amp;", "&");
    const verification = await fetch(verificationUrl, { redirect: "manual" });
    assert([302, 303].includes(verification.status), "verification link did not redirect");
    const callback = verification.headers.get("location");
    assert(callback, "verification did not return to the app");
    assert.equal(new URL(callback).origin, new URL(env.APP_ORIGIN).origin);

    const callbackResponse = await fetch(callback, {
      headers: {
        Cookie: cookies.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; "),
      },
      redirect: "manual",
    });
    assert.equal(callbackResponse.status, 307, "app callback did not create a session");
    assert.equal(new URL(callbackResponse.headers.get("location")!).pathname, "/");

    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null, "verified consultant could not sign in");
    console.log("Auth flow passed: signup, verification email, callback, and password sign in.");
  } finally {
    if (userId) {
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
