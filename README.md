# Dental Lab System

Case management for the lab: Data Entry logs cases from doctors, Designers work
them in Exocad and submit for review, and the Lab Leader approves or sends
cases back for changes. Scans and design files are stored in the lab's own
Google Drive.

## Roles

- **Data Entry** — creates cases from the doctor's scan (WhatsApp/ZIP), optionally assigns a designer.
- **Designer** — works assigned cases, uploads the finished design, submits for review.
- **Lab Leader** — manages users, approves or requests changes on submitted cases, connects Google Drive.

## Status flow

`READY_FOR_DESIGN` → `IN_DESIGN` → `WAITING_FOR_REVIEW` → Lab Leader review →
`COMPLETED`, or `CHANGES_REQUESTED` (designer re-submits, looping back to
`WAITING_FOR_REVIEW`).

## First-time setup

```bash
npm install
npx prisma migrate dev   # creates prisma/dev.db and applies migrations
npm run db:seed          # creates one Lab Leader, Data Entry, and Designer account
npm run dev
```

Seeded accounts (change the passwords from "My Account" after first login):

| Role       | Email                  | Password       |
| ---------- | ----------------------- | -------------- |
| Lab Leader | leader@lab.local        | ChangeMe123!   |
| Data Entry | entry@lab.local         | ChangeMe123!   |
| Designer   | designer1@lab.local     | ChangeMe123!   |

Add more Designer/Lab Leader accounts from the **Users** page once signed in
as a Lab Leader.

## Connecting Google Drive

Case files are stored in a "Dental Lab Cases" folder in the lab's own Google
Drive (a personal account with enough storage works fine — this uses OAuth
against that one account, not a Workspace/service account). This part needs
a one-time setup in Google Cloud Console that only the developer/owner of the
Google account can do:

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project.
2. Enable the **Google Drive API** for it.
3. Configure the OAuth consent screen (External is fine for a single-account internal tool; add the lab's Google account as a test user if the app stays in "Testing" mode).
4. Create an **OAuth client ID** (type: Web application). Add an authorized redirect URI matching `GOOGLE_REDIRECT_URI` below (e.g. `http://localhost:3000/api/google/callback` for local dev, or `https://yourdomain.com/api/google/callback` in production).
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

Next.js 16 (App Router) + Prisma 5/SQLite + NextAuth v5 (Credentials) +
Google Drive API. SQLite is fine at this scale (8-10 users); the schema can
move to Postgres later by changing the Prisma datasource if needed.
