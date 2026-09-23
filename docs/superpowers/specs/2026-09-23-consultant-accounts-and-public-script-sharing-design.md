# Consultant Accounts and Public Script Sharing

## Purpose

Give each consultant a private workspace for recordings and editable test scripts. Let the owner publish a read-only link to a script and its screenshots. Keep the product visually aligned with [Luzid](https://www.luzid.io/) and make the next action clear on every screen.

## Decisions

- Use Supabase Auth with email and password for signup, login, email verification, password reset, and logout. Do not add social login, magic-link login, or company SSO.
- Keep all recording and step data access in the existing Next.js server and Drizzle repository. Do not use Row Level Security.
- A recording belongs to exactly one Supabase Auth user. It is private unless its owner creates a public link.
- A public link shows the generated test script and screenshots only. It never exposes the original video, editing controls, or private workspace.
- Public links are read-only, unlisted, and revocable. One recording has at most one active link; the owner can view, copy, or revoke it.
- All existing recordings and their videos and screenshots are disposable test data and may be deleted as part of the migration.

## Consultant experience

### Accounts

Signed-out visitors reaching the workspace go to a focused login screen. Signup asks for email and password. Supabase email verification is enabled, and the post-signup screen tells the consultant to check their inbox. Login gives a clear path to password reset. Account actions show progress and actionable errors; successful login returns the consultant to the workspace or the private page they originally requested. Signed-in consultants can log out from the header.

### Workspace

The home page shows only the current consultant's scripts and a prominent **New script** action. The existing upload and editing flow stays familiar. The list has useful empty, loading, and failure states. Script status remains persistent in the database, and the UI continues to poll while processing.

### Sharing

The script detail page has a **Share** action. Before a link exists, it explains that anyone with the link can view the script and screenshots. After creation, it offers **Copy link** and **Revoke link**, with loading, success, and error feedback. Revocation removes public access to the page and screenshot endpoints immediately. A newly created link after revocation uses a new token, so an old link does not work again.

The public page is clean and read-only, with the script title, ordered steps, and screenshots. It needs no login. It excludes edit, delete, retry, upload, and video controls. It uses `noindex` and no-store responses; “public” means accessible to anyone who possesses the link, not listed on the site.

### Visual language

Reuse the current design tokens in `src/app/globals.css`: dark ink surfaces, one orange accent, light content surfaces, compact radii, and a consistent focus ring. Account pages use the Luzid logo and dark hero treatment. Workspace pages prioritize the consultant's scripts and next task over marketing copy. Forms use plain labels, concise help, and clear recovery text. Layouts work on desktop and mobile.

## System design

### Identity and sessions

Use Supabase Auth with cookie-based server sessions for Next.js. Server pages and API handlers verify the current user from Supabase on each private request; client-supplied user IDs are never trusted. The Auth client uses the public Supabase key. The existing service-role storage adapter remains server-only. Authentication configuration is added through `src/lib/config/env.ts` and `.env.example`, the sole supported environment-variable path.

Private pages redirect signed-out visitors to login. Private APIs return 401 for no valid session. Requests for a recording or step owned by another user return 404, so they do not reveal that the resource exists. The public share page and its screenshot endpoint are the only anonymous data routes.

### Ownership and repository boundary

Add a required `ownerUserId` UUID to recordings, referencing the Supabase Auth user. Every new upload records the verified current user as owner. The repository's externally callable read and write methods take the verified owner ID and scope queries to it. Step operations resolve ownership through their parent recording, including update and delete requests that contain only a step ID. Reorder requests also ensure every supplied step belongs to that recording. Background processing receives a recording already created for an owner and can update its status and steps internally without a browser session.

Route handlers remain thin: validate input, resolve the verified user or public share, call a library function, and map the result to a response. Components and routes do not build Drizzle queries. Storage access remains behind `StorageAdapter`.

### Public links and images

Store one active share record per recording with a cryptographically random 256-bit URL token. The owner can retrieve the current link and delete the share record to revoke it. Public reads resolve the token on the server, then serialize only title, status, steps, and screenshot access. They never serialize `videoPath`, `originalFileName`, owner identity, or edit endpoints.

Public screenshot requests validate the share token and step-to-recording relationship every time, then stream the image through Next.js and the storage adapter with no-store headers. This makes revocation effective for subsequent image requests. Private script pages may continue to receive fresh, short-lived signed screenshot URLs from the server; those URLs are never cached in the client.

### Data transition

Before making ownership required, remove the existing test recording rows and their files in both storage buckets. Preserve the Supabase Auth schema and accounts. Apply a migration that adds the owner column, its foreign key and listing index, and the share table. New recordings cannot be inserted without an owner. The cleanup and migration are explicit operations, so there is no implicit assignment of old recordings to the first new account.

## Error handling

- Signup and login distinguish invalid credentials, unverified email, expired reset link, and temporary service failure with instructions the consultant can act on. Avoid exposing whether an unrelated email address has an account in password-reset feedback.
- A failed share creation or revocation leaves the last confirmed sharing state visible and offers retry. Copy-link failure lets the consultant select the URL manually.
- Invalid, expired, or revoked public tokens show a neutral unavailable-link page. A missing screenshot shows a placeholder without failing the whole script.
- Pipeline failures continue to be recorded as `status: "failed"` with consultant-facing text; technical details go to server logs.

## Verification and acceptance

1. Signup, verification, login, logout, and password reset work through Supabase Auth.
2. Two consultants can upload and edit their own scripts. Neither can list, open, alter, retry, delete, reorder, or obtain screenshot access to the other's private scripts or steps.
3. A valid public link opens without login and shows only the script and screenshots. It cannot edit or access the source video. Revocation blocks the page and new screenshot requests; replacement produces a different link.
4. Upload progress survives page reload, step editing works, and an invalid video produces an actionable message.
5. Account and share screens match the app's Luzid-derived tokens, support keyboard focus and mobile layouts, and provide loading, empty, and failure states.
6. `npm run check` is clean. The real flow is exercised with two accounts, a good video, a bad file, editing, sharing, and revocation.
