# Alexandria All on four Lab — Case Management

Case management for the lab: Technicians log cases from doctors, Designers work
them in Exocad and submit for review, and the Lab Leader approves or sends
cases back for changes. Scans and design files are stored in the lab's own
Google Drive.

## Roles

Roles are managed by the Lab Leader on the **Roles** page (`/settings/roles`). Each
role has:

- **Permissions**: create/edit/delete cases, assign designers and ceramists, each
  workflow step (approve designs, ibar done, matching done, milling done, stain &
  glaze done, delivered, photogrammetry done), see all money or only their own
  earnings, open each admin page, and whether people with the role can be
  assigned as a designer or as a ceramist.
- **Which cases it sees**: all cases, only cases they're assigned to (as designer
  or ceramist), or only cases that need photogrammetry; optionally narrowed to
  chosen statuses (e.g. a Milling role that only sees cases in Milling).
- **Notifications** (app + email): when a case reaches chosen statuses, and/or
  when a case needs photogrammetry. Designers and ceramists are always notified
  when a case is assigned to them.

Built-in presets: **Lab Leader** (always full access; can't be edited or deleted,
and the last active Lab Leader can't be disabled or demoted), **Technician**,
**Designer**, **Photogrammetry** and **Ceramist** (all editable). Assign roles on the
**Users** page. Permissions are read fresh on every request (`src/lib/access.ts`,
list in `src/lib/permissions.ts`), so changes apply immediately.

Ceramists are user accounts (a role with "can be assigned as a ceramist"); the
ceramist picked on a case is notified. Roles with "see their own earnings" get a
**My earnings** page and a "Your earnings" box on their cases: designer fees,
ceramist fee, and the photogrammetry cost for whoever marked photogrammetry done,
each shown as done or pending.

## Status flow

(`IBAR_DESIGN`) → `READY_FOR_DESIGN` → `IN_DESIGN` → (`MATCHING`) → `WAITING_FOR_REVIEW` → Lab Leader review →
`MILLING` → `STAIN_AND_GLAZE` → `COMPLETED` → `DELIVERED`, or
`CHANGES_REQUESTED` (designer re-submits, looping back to `WAITING_FOR_REVIEW`).

**Ibar cases have two designers.** When an ibar designer (an outside person,
picked by name) is set, the New Case form's **Designer before ibar** designs first;
the Lab Leader reviews that design, and approving it moves the case to **Ibar
Design**. When the ibar comes back, a Technician or Lab Leader clicks **Ibar done**
(optionally attaching the ibar file): the case moves to Ready for Design and the
**designer after the ibar** (the normal "Assign designer" field) is notified and
takes over through matching, review and production. Only the designer whose turn it
is can start or submit; the other can still open the case. Both earn the full
designer fee (`firstDesignerFee` and `designerFee`), and Reports credit each one.
The turn logic is in `src/lib/caseFlow.ts`. Adding an ibar designer on the Edit page
before design starts makes the case wait for the first designer; adding it later
only records it.

**Matching** is optional per case: the New Case form has a **Matching** field for the
name of whoever does it. When the designer submits a case that has a matching name,
it goes to **Matching** instead of straight to review, and Technicians and Lab Leaders
are notified. A Technician or Lab Leader clicks **Matching done** to send it to review.

**Photogrammetry** runs alongside the flow and doesn't change the status: tick
**Needs photogrammetry** on the New Case (or Edit) form and the photogrammetry users
are notified.

Approving a design sends the case to **Milling**. A Technician or Lab Leader
then moves it on to **Stain & Glaze** (the ceramist's step) and from there to
**Completed**.

A Technician or Lab Leader marks a completed case **Delivered** once the doctor
has approved the work. The **ceramist** is optional when creating a case and can
be assigned (or changed) by a Technician or Lab Leader once the design has been
submitted, up to and including Completed. Each case can also list **unit codes**.

On the Cases screen the status counters are clickable: each one filters the
list to the cases in that status. A search box above them finds cases by patient or doctor
name (any part of the name, upper or lower case) and works together with the
status filter. A **Sort by** dropdown orders the list by newest, oldest, due date
(soonest first, cases without one last), patient name or doctor name; the choice is
kept while searching and switching statuses.

Cases that need attention are shown **in red at the top** of the list, with the
reason: due tomorrow, due today or overdue (until Completed), or assigned to a
designer and still in a design step with no update for 2+ days. The rules live in
`src/lib/caseAlerts.ts` (`STALE_DAYS` sets the 2 days; dates use Cairo time).

The **Designers** page (Lab Leader only)
shows every designer's open and total case counts and lists their cases. The
**Ceramists** page does the same per ceramist, with the fee each case earned.

Amounts are shown everywhere (screens, PDFs, Excel) as whole Egyptian pounds,
for example `30,000 EGP`; the formatter is `formatEGP` in `src/lib/money.ts`.

Every case has a **QR code** on its page that opens the case when scanned, with
a printable label (`/cases/<id>/label`). The code encodes `APP_URL` (falling
back to `NEXTAUTH_URL`), so it only works from a phone once the app is served
from a real address rather than `localhost`.

## Custom statuses

On **Statuses** (`/settings/statuses`, permission "Statuses") the lab adds its own
statuses (name, colour, and which status it comes after). People with "Move a case
to any status" get a **Move to status** box on the case page that puts a case into
any built-in or custom status. A manual move only changes the status: no automatic
steps run, but roles set to be notified for that status are told. Statuses with
cases in them can't be deleted. Technicians have both permissions by default.

## Expenses and salaries

**Expenses** (`/expenses`) are lab costs not tied to a case (rent, supplies). Each
has a month and can repeat every month (until "Stop after this month"). A **base
salary** can be set per person on the Users page. **Reports** shows one month at a
time (or "All time"): case profit minus that month's expenses and salaries gives
**net profit**, and the Excel/PDF exports include a net profit sheet/page. People
who can see their own earnings also see their salary on My earnings. Salaries use
each person's current salary for every month.

## Pricing

A case's materials are entered as **material lines**: each line is an arch (Upper
or Lower), a material, a number of units and an optional metal, and a case can have
several lines per arch (e.g. Upper Zirconia 10 + Upper PMMA 2 + Lower Zirconia 12).
Prices, fees and costs are summed over the lines; a material's flat extra fee and
deduction count once per case however many lines use it. Lines live in the
`CaseMaterial` model; `unitsUpper`/`unitsLower` on the case are their totals.

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
ibar designer. Optional **milling cost** and **photogrammetry cost** per unit are
costs to the lab: they're locked onto the case like the metal cost and taken off
profit, not billed to the doctor (photogrammetry only on cases that need it). All
figures are visible only to the Lab Leader, on the case
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

## Editing

Technicians and Lab Leaders can **edit a case** from the Edit button on its page.
Changing the material, units, metal or ibar designer recalculates the price and
fees from the current rates; other edits (names, notes, dates, unit codes) leave
the locked-in amounts alone. Already-generated invoices never change. Only a
Lab Leader can **delete a case** (Drive files are kept).

Lab Leaders can edit **materials** and **metal types** from the Pricing page.
New rates apply to cases created afterwards. A material or metal type can only
be deleted while no case uses it.

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
3. Configure the OAuth consent screen (External). Add the `.../auth/drive.file` scope.
   While it's in "Testing" mode, add every staff Gmail as a test user, and note that
   the Drive connection has to be reconnected every 7 days. Once everything works,
   click **Publish app** to move it to "In production": the app only uses
   non-sensitive scopes (sign-in plus `drive.file`), so this is free, needs no paid
   security review, and removes the 7-day limit.
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

Files are filed as **main folder → doctor folder → patient folder**. The app
creates its own main folder ("Alexandria All on four Lab Cases") with the first
case, or from **Create main folder** on Drive Settings. Doctor and patient
folders it already made are matched by name (case-insensitive) and reused.

The app uses the `drive.file` permission, which only reaches files and folders
the app itself created. That's what keeps the Drive connection free and
permanent (see step 3 above), with two consequences:

- Folders made by hand in Drive, including the lab's older case folders, are
  invisible to the app. Old cases stay where they are; new cases go into the
  app's folder.
- Files dropped into the app's folders straight from the Drive website don't
  show up in the app. Upload through the app instead.

If the saved main folder can't be reached (deleted, or saved under the old
full-Drive permission), the app creates a new one automatically.

## Environment variables

See `.env` for the full list. `NEXTAUTH_SECRET` must be changed to a real
random value before deploying (`openssl rand -base64 32`).

## Tech stack

Next.js 16 (App Router) + Prisma 5/SQLite + NextAuth v5 (Credentials + Google) +
Google Drive API. SQLite is fine at this scale (8-10 users); the schema can
move to Postgres later by changing the Prisma datasource if needed.
