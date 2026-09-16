# Dental Lab System

Case management for the lab: Technicians log cases from doctors, Designers work
them in Exocad and submit for review, and the Lab Leader approves or sends
cases back for changes. Scans and design files are stored in the lab's own
Google Drive.

## Roles

- **Technician** — creates cases from the doctor's scan (WhatsApp/ZIP), picks the doctor and optionally a designer.
- **Designer** — works assigned cases, uploads the finished design, submits for review.
- **Lab Leader** — 1-2 people; manages users, approves or requests changes on submitted cases, connects Google Drive.

## Status flow

`READY_FOR_DESIGN` → `IN_DESIGN` → `WAITING_FOR_REVIEW` → Lab Leader review →
`COMPLETED`, or `CHANGES_REQUESTED` (designer re-submits, looping back to
`WAITING_FOR_REVIEW`).

## Notifications

In-app only (bell icon in the sidebar, and a full list at `/notifications`) —
no email/SMS setup required:

- A designer is notified when a case is assigned to them (at creation, or later via "Assign designer").
- Lab Leaders are notified when a designer submits a case for review.

## First-time setup

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db and applies migrations
npm run db:seed          # creates one Lab Leader, Technician, and Designer account
npm run dev
```

Seeded accounts (change the passwords from "My Account" after first login):

| Role       | Email                  | Password       |
| ---------- | ----------------------- | -------------- |
| Lab Leader | leader@lab.local        | ChangeMe123!   |
| Technician | entry@lab.local         | ChangeMe123!   |
| Designer   | designer1@lab.local     | ChangeMe123!   |

Add more Designer/Lab Leader/Technician accounts from the **Users** page once
signed in as a Lab Leader.

## Doctors

There's no separate "manage doctors" page — the doctor dropdown on the New
Case form grows itself. Pick an existing doctor, or choose **+ Add new
doctor** and type a name; it's saved the first time it's used and shows up in
the dropdown for every case after that.

## Signing in with Google

Users can sign in either with the email/password set when their account was
created, or with Google using that same email address — there's no
self-registration; an account must already exist (created by a Lab Leader on
the **Users** page) for Google sign-in to work. This uses the same Google
Cloud OAuth client as the Drive connection below, so it needs one more
redirect URI added to that same OAuth client:

```
http://localhost:3000/api/auth/callback/google   (add the https://yourdomain.com version too once deployed)
```

If sign-in with Google isn't showing on the login page, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` aren't set in `.env` yet — see the Drive setup below.

## Connecting Google Drive

Case files are stored in a "Dental Lab Cases" folder in the lab's own Google
Drive (a personal account with enough storage works fine — this uses OAuth
against that one account, not a Workspace/service account). This part needs
a one-time setup in Google Cloud Console that only the developer/owner of the
Google account can do:

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project.
2. Enable the **Google Drive API** for it.
3. Configure the OAuth consent screen (External is fine for a single-account internal tool; add every staff Gmail as a test user while the app stays in "Testing" mode — note that in Testing mode, Drive's connection has to be re-authorized every 7 days; moving to "In production" via Google's free verification removes that limit, see the app's in-chat notes on this).
4. Create an **OAuth client ID** (type: Web application). Add these authorized redirect URIs:
   - `http://localhost:3000/api/google/callback` (Drive connection, local dev)
   - `http://localhost:3000/api/auth/callback/google` (Google sign-in, local dev)
   - the `https://yourdomain.com/...` versions of both once deployed
5. Copy the Client ID and Client Secret into `.env`:

   ```
   GOOGLE_CLIENT_ID="..."
   GOOGLE_CLIENT_SECRET="..."
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/google/callback"
   ```

6. Restart the app, sign in as a Lab Leader, go to **Drive Settings**, and click **Connect Google Drive**. Sign in with the lab's Google account and approve access.

From then on the app creates a folder per case and uploads scans/design
files there automatically — no more manual link copy-pasting.

## Environment variables

See `.env` for the full list. `NEXTAUTH_SECRET` must be changed to a real
random value before deploying (`openssl rand -base64 32`).

## Tech stack

Next.js 16 (App Router) + Prisma 5/SQLite + NextAuth v5 (Credentials + Google) +
Google Drive API. SQLite is fine at this scale (8-10 users); the schema can
move to Postgres later by changing the Prisma datasource if needed.
