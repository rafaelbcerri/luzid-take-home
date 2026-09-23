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
    const signup = await client.auth.signUp({ email, password });
    assert.equal(signup.error, null, "signup request failed");
    assert(signup.data.user, "signup did not create a user");
    userId = signup.data.user.id;
    assert(signup.data.session, "signup should create a session immediately");

    const workspace = await fetch(new URL("/api/recordings", env.APP_ORIGIN), {
      headers: {
        Cookie: cookies.map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join("; "),
      },
    });
    assert.equal(workspace.status, 200, "new consultant could not access the workspace");

    const inboxResponse = await fetch("http://127.0.0.1:54324/api/v1/messages");
    assert.equal(inboxResponse.status, 200);
    const inbox = (await inboxResponse.json()) as {
      messages: Array<{ To: Array<{ Address: string }> }>;
    };
    const message = inbox.messages.find((item) => item.To.some((to) => to.Address === email));
    assert(!message, "signup should not send a confirmation email");

    assert.equal((await client.auth.signOut()).error, null);
    const login = await client.auth.signInWithPassword({ email, password });
    assert.equal(login.error, null, "consultant could not sign in again");
    console.log("Auth flow passed: immediate signup session, workspace access, no confirmation email, and password sign in.");
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
