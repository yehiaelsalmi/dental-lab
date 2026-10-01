# Alexandria All on four Lab — Case Management

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
`MILLING` → `STAIN_AND_GLAZE` → `COMPLETED` → `DELIVERED`, or
`CHANGES_REQUESTED` (designer re-submits, looping back to `WAITING_FOR_REVIEW`).

Approving a design sends the case to **Milling**. A Technician or Lab Leader
then moves it on to **Stain & Glaze** (the ceramist's step) and from there to
**Completed**.

A Technician or Lab Leader marks a completed case **Delivered** once the doctor
has approved the work. The **ceramist** is optional when creating a case and can
be assigned (or changed) by a Technician or Lab Leader once the design has been
submitted, up to and including Completed. Each case can also list **unit codes**.

On the Cases screen the status counters are clickable: each one filters the
list to the cases in that status. The **Designers** page (Lab Leader only)
shows every designer's open and total case counts and lists their cases. The
**Ceramists** page does the same per ceramist, with the fee each case earned.

Amounts are shown everywhere (screens, PDFs, Excel) as whole Egyptian pounds,
for example `30,000 EGP`; the formatter is `formatEGP` in `src/lib/money.ts`.

Every case has a **QR code** on its page that opens the case when scanned, with
a printable label (`/cases/<id>/label`). The code encodes `APP_URL` (falling
back to `NEXTAUTH_URL`), so it only works from a phone once the app is served
from a real address rather than `localhost`.

## Pricing

Lab Leaders set fixed rates on the **Pricing** page: each **Material** has a
price-per-unit (billed to the doctor) plus a ceramist/designer/ibar fee-per-unit,
and each **Metal type** has a cost-per-unit. Technicians pick Material (required),
Metal (optional), and Ibar Designer (optional, grows like Doctor/Ceramist) on
the New Case form — Material and Metal must already exist in Pricing, they're
not created on the fly.

The price and each fee are calculated automatically and locked onto the case
the moment they're actually incurred: price, ibar fee, and (if assigned then)
designer fee at creation; designer/ceramist fee whenever that person actually
gets assigned, using the case's material rate at that time. Changing a
material's rate later never changes already-locked cases. A material can also
carry optional **extra fees** and a **deduction**, both flat amounts per case:
case price = price per unit x units + extra fees - deduction. A material's ibar
fee-per-unit is optional — leave it blank for materials that never need an
ibar designer. All figures are visible only to the Lab Leader, on the case
page and on **Reports** — a sheet-style table of every case with a totals
row, replacing the old Excel sheet, plus a per-person breakdown (total
revenue per doctor, total fees per ceramist/designer/ibar designer).

**Reports** can be downloaded as Excel (one sheet per breakdown, plus the
full case table) or PDF from the Reports page.

## Invoices

The **Invoices** page generates a monthly invoice per doctor: pick a doctor
and a month, and it pulls every priced case (Material set) with an entry
date in that month into an invoice, downloadable as PDF. Line amounts are
snapshotted at generation time, so editing a case afterward doesn't change
an already-generated invoice. Only one invoice per doctor per month is
allowed — delete the existing one first to regenerate it.

This isn't automatic yet — a Lab Leader has to visit the page and click
Generate each month, rather than it happening on its own on the 1st. True
automation (a scheduled task that generates and/or emails every doctor's
invoice on a fixed date) is a reasonable next step if wanted, but needs a
scheduler wired up outside of Next.js itself (e.g. Windows Task Scheduler
hitting a protected route), plus a decision on whether invoices should be
emailed automatically or just prepared for the Lab Leader to review first.

## Notifications

In-app only (bell icon in the sidebar, and a full list at `/notifications`) —
no email/SMS setup required:

- A designer is notified when a case is assigned to them (at creation, or later via "Assign designer").
- Lab Leaders are notified when a designer submits a case for review.

### Email notifications

Every notification above is also emailed, once SMTP is configured in `.env`
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM` and
`APP_URL`). With `SMTP_HOST` empty, email is simply off and the in-app bell
still works. For Gmail use `smtp.gmail.com`, port `587`, and an app password
(Google Account → Security → 2-Step Verification → App passwords). Emails go to
each user's account email, and a failed send never blocks the action itself.

Recipients: the designer when a case is assigned to them; Lab Leaders when a case
is assigned (except the person who assigned it) and when a designer submits it.

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

Case files are stored in a folder named after the lab in the lab's own Google
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

From then on the app uploads scans/design files to Drive automatically — no more
manual link copy-pasting.

### Folder layout

Files are filed as **main folder → doctor folder → patient folder**. Existing
folders are matched by name (case-insensitive) and reused; missing ones are
created. On **Drive Settings**, paste the link to the client's existing main
folder (the one holding the doctor folders), then click **Import doctors from
Drive** so the doctor dropdown matches the folder names exactly. If no main
folder is set, the app creates a folder named after the lab.

This needs the full `drive` permission (the narrower `drive.file` scope can't
see folders the app didn't create). A connection made under the old scope shows
"Reconnect needed" on Drive Settings.

## Environment variables

See `.env` for the full list. `NEXTAUTH_SECRET` must be changed to a real
random value before deploying (`openssl rand -base64 32`).

## Tech stack

Next.js 16 (App Router) + Prisma 5/SQLite + NextAuth v5 (Credentials + Google) +
Google Drive API. SQLite is fine at this scale (8-10 users); the schema can
move to Postgres later by changing the Prisma datasource if needed.
