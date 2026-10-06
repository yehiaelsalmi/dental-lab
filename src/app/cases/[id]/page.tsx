import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FolderOpen,
  FileText,
  CheckCircle2,
  XCircle,
  User,
  Printer,
  Pencil,
} from "lucide-react";
import QRCode from "qrcode";
import { caseUrl } from "@/lib/email";
import { formatEGP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { can, canViewCase, requireAccess, usersWithPermission } from "@/lib/access";
import { earningsOnCase } from "@/lib/earnings";
import { DESIGN_PHASE_STATUSES, type CaseStatus } from "@/lib/constants";
import { activeDesignerId, isBeforeIbar } from "@/lib/caseFlow";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { FileDropField } from "@/components/FileDropField";
import {
  advanceProductionAction,
  assignCeramistAction,
  assignDesignerAction,
  completeIbarAction,
  completeMatchingAction,
  markDeliveredAction,
  markPhotogrammetryDoneAction,
  requestChangesAction,
  approveAction,
  startDesignAction,
  submitForReviewAction,
} from "./actions";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const access = await requireAccess();
  const userId = access.userId;

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      assignedDesigner: true,
      firstDesigner: true,
      createdBy: true,
      doctor: true,
      ceramist: true,
      photogrammetryDoneBy: true,
      ibarDesigner: true,
      material: true,
      metalType: true,
      units: { orderBy: { createdAt: "asc" } },
      files: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewedBy: true } },
    },
  });

  if (!caseRecord || !canViewCase(access, caseRecord)) notFound();

  const status = caseRecord.status as CaseStatus;
  const canAssign = can(access, "case.assign");
  const canAssignCeramist =
    canAssign &&
    (["MATCHING", "WAITING_FOR_REVIEW", "MILLING", "STAIN_AND_GLAZE", "COMPLETED"] as CaseStatus[]).includes(status);

  const [ceramists, designers] = await Promise.all([
    canAssignCeramist ? usersWithPermission("work.ceramist") : [],
    canAssign ? usersWithPermission("work.design") : [],
  ]);

  const qrDataUrl = await QRCode.toDataURL(caseUrl(caseRecord.id), { margin: 1, width: 220 });

  const hasIbar = !!caseRecord.ibarDesignerId;
  const beforeIbar = isBeforeIbar(caseRecord);
  // Only the designer whose turn it is can start or submit.
  const isAssignedDesigner = can(access, "work.design") && activeDesignerId(caseRecord) === userId;
  // Without direct Drive access, downloads go through the app instead.
  const viaApp = !can(access, "files.drive");
  const canMarkPhotogrammetry =
    caseRecord.needsPhotogrammetry &&
    !caseRecord.photogrammetryDoneAt &&
    can(access, "case.photogrammetry");
  const productionPermission = status === "MILLING" ? "case.milling" : "case.stainGlaze";
  const myEarnings =
    !can(access, "money.viewAll") && can(access, "money.viewOwn")
      ? earningsOnCase(caseRecord, userId)
      : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-10">
      <Link
        href="/cases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to cases
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold text-slate-900">{caseRecord.patientName}</h1>
          <p className="mt-1 text-sm text-slate-500">{caseRecord.doctor.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {can(access, "case.edit") && (
            <Link
              href={`/cases/${caseRecord.id}/edit`}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Pencil size={14} />
              Edit
            </Link>
          )}
          <StatusBadge status={status} />
        </div>
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="mb-6 overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
        <WorkflowStepper
          status={status}
          hasIbar={hasIbar}
          hasMatching={!!caseRecord.matchingBy}
          beforeIbar={beforeIbar}
        />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <Info label="Units (Upper / Lower)" value={`${caseRecord.unitsUpper ?? "-"} / ${caseRecord.unitsLower ?? "-"}`} />
        <Info label="Material" value={caseRecord.material?.name ?? "-"} />
        <Info label="Metal" value={caseRecord.metalType?.name ?? "-"} />
        <Info label="Ibar designer" value={caseRecord.ibarDesigner?.name ?? "-"} />
        <Info label="System" value={caseRecord.system ?? "-"} />
        <Info label="Shade" value={caseRecord.shade ?? "-"} />
        <Info label="Entry date" value={new Date(caseRecord.entryDate).toLocaleDateString()} />
        <Info label="Due date" value={caseRecord.dueDate ? new Date(caseRecord.dueDate).toLocaleDateString() : "-"} />
        <Info label="Created by" value={caseRecord.createdBy.name} />
        {hasIbar && (
          <Info
            label="Designer before ibar"
            value={caseRecord.firstDesigner?.name ?? "Unassigned"}
          />
        )}
        <Info
          label={hasIbar ? "Designer after ibar" : "Designer"}
          value={caseRecord.assignedDesigner?.name ?? "Unassigned"}
        />
        <Info label="Ceramist" value={caseRecord.ceramist?.name ?? "-"} />
        <Info label="Matching" value={caseRecord.matchingBy ?? "-"} />
        <Info
          label="Photogrammetry"
          value={
            !caseRecord.needsPhotogrammetry
              ? "Not needed"
              : caseRecord.photogrammetryDoneAt
                ? `Done ${new Date(caseRecord.photogrammetryDoneAt).toLocaleDateString()}`
                : "Pending"
          }
        />
        {caseRecord.notes && <Info label="Notes" value={caseRecord.notes} full />}
        {caseRecord.driveFolderUrl && !viaApp && (
          <div className="col-span-2 border-t border-slate-100 pt-4">
            <a
              href={caseRecord.driveFolderUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
            >
              <FolderOpen size={15} />
              Open case folder in Google Drive
            </a>
          </div>
        )}
      </section>

      {myEarnings.length > 0 && (
        <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 text-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Your earnings on this case</h2>
          <ul className="flex flex-col gap-2">
            {myEarnings.map((e) => (
              <li key={e.label} className="flex items-center justify-between gap-3">
                <span className="text-slate-700">
                  {e.label}{" "}
                  <span className={e.done ? "text-emerald-700" : "text-slate-400"}>
                    ({e.done ? "done" : "pending"})
                  </span>
                </span>
                <span className="font-semibold text-slate-900">{formatEGP(e.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {can(access, "money.viewAll") && (
        <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm sm:grid-cols-3">
          <Money label="Price to doctor" value={caseRecord.totalPrice} />
          <Money label="Extra fees (included)" value={caseRecord.extraFee} />
          <Money label="Deduction (included)" value={caseRecord.deduction} />
          <Money label="Ceramist fee" value={caseRecord.ceramistFee} />
          {hasIbar && (
            <Money label="Designer fee (before ibar)" value={caseRecord.firstDesignerFee} />
          )}
          <Money
            label={hasIbar ? "Designer fee (after ibar)" : "Designer fee"}
            value={caseRecord.designerFee}
          />
          <Money label="Ibar fee" value={caseRecord.ibarFee} />
          <Money label="Metal cost" value={caseRecord.metalCost} />
          <Money label="Milling cost" value={caseRecord.millingCost} />
          <Money label="Photogrammetry cost" value={caseRecord.photogrammetryCost} />
          <Money
            label="Profit"
            value={
              caseRecord.totalPrice == null
                ? null
                : caseRecord.totalPrice -
                  (caseRecord.ceramistFee ?? 0) -
                  (caseRecord.designerFee ?? 0) -
                  (caseRecord.firstDesignerFee ?? 0) -
                  (caseRecord.ibarFee ?? 0) -
                  (caseRecord.metalCost ?? 0) -
                  (caseRecord.millingCost ?? 0) -
                  (caseRecord.photogrammetryCost ?? 0)
            }
            emphasize
          />
        </section>
      )}

      <section className="mb-6 flex items-center gap-5 rounded-xl border border-slate-200 bg-white p-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt="Case QR code" width={96} height={96} className="rounded-md" />
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Case QR code</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Scan it to open this case. Print the label and keep it with the physical work.
          </p>
          <Link
            href={`/cases/${caseRecord.id}/label`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
          >
            <Printer size={15} />
            Print label
          </Link>
        </div>
      </section>

      {caseRecord.units.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Unit codes</h2>
          <div className="flex flex-wrap gap-2">
            {caseRecord.units.map((u) => (
              <span
                key={u.id}
                className="rounded-md bg-slate-100 px-2.5 py-1 text-sm font-medium text-slate-700"
              >
                {u.code}
              </span>
            ))}
          </div>
        </section>
      )}

      {can(access, "case.ibar") && status === "IBAR_DESIGN" && (
        <section className="mb-6 rounded-xl border border-fuchsia-200 bg-fuchsia-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Ibar design</h2>
          <p className="mb-3 text-sm text-slate-500">
            Waiting for the ibar from {caseRecord.ibarDesigner?.name ?? "the ibar designer"}. When
            it&apos;s back, attach the file if you have it and mark it done.{" "}
            {caseRecord.assignedDesigner
              ? `${caseRecord.assignedDesigner.name} is notified to start the design.`
              : "Assign the designer below so they're notified when the ibar is done."}
          </p>
          <form action={completeIbarAction} className="flex flex-col gap-4">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <FileDropField name="ibarFile" hint="Optional: the ibar file, ZIP or STL" />
            <button
              type="submit"
              className="self-start rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-fuchsia-700"
            >
              Ibar done: send to designer
            </button>
          </form>
        </section>
      )}

      {can(access, "case.matching") && status === "MATCHING" && (
        <section className="mb-6 rounded-xl border border-teal-200 bg-teal-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Matching</h2>
          <p className="mb-3 text-sm text-slate-500">
            The design is with {caseRecord.matchingBy ?? "the matching person"} for matching. When
            it&apos;s done, send the case to the Lab Leader for review.
          </p>
          <form action={completeMatchingAction}>
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              Matching done: send for review
            </button>
          </form>
        </section>
      )}

      {canMarkPhotogrammetry && (
        <section className="mb-6 rounded-xl border border-sky-200 bg-sky-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Photogrammetry</h2>
          <p className="mb-3 text-sm text-slate-500">
            Attach the photogrammetry file if there is one, then mark it done. The Lab Leader is
            notified.
          </p>
          <form action={markPhotogrammetryDoneAction} className="flex flex-col gap-4">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <FileDropField name="photogrammetryFile" hint="Optional: photogrammetry export or ZIP" />
            <button
              type="submit"
              className="self-start rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700"
            >
              Mark photogrammetry done
            </button>
          </form>
        </section>
      )}

      {(status === "MILLING" || status === "STAIN_AND_GLAZE") && can(access, productionPermission) && (
        <section className="mb-6 rounded-xl border border-orange-200 bg-orange-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            {status === "MILLING" ? "Milling" : "Stain & glaze"}
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            {status === "MILLING"
              ? "When milling is finished, send the case on to the ceramist for stain & glaze."
              : "When the ceramist has finished stain & glaze, mark the case as completed."}
          </p>
          <form action={advanceProductionAction}>
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <button
              type="submit"
              className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-700"
            >
              {status === "MILLING" ? "Milling done: send to Stain & Glaze" : "Stain & glaze done: mark Completed"}
            </button>
          </form>
        </section>
      )}

      {can(access, "case.deliver") && caseRecord.status === "COMPLETED" && (
        <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Deliver to the doctor</h2>
          <p className="mb-3 text-sm text-slate-500">
            Once the doctor has approved the work and it has been delivered, mark the case as
            delivered.
          </p>
          <form action={markDeliveredAction}>
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              Mark as Delivered
            </button>
          </form>
        </section>
      )}

      {canAssignCeramist && (
          <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
            <form action={assignCeramistAction} className="flex items-end gap-3">
              <input type="hidden" name="caseId" value={caseRecord.id} />
              <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
                Ceramist
                <select
                  name="ceramistId"
                  defaultValue={caseRecord.ceramistId ?? ""}
                  className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                >
                  <option value="">None</option>
                  {ceramists.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {ceramists.length === 0 && (
                  <span className="text-xs font-normal text-amber-600">
                    No ceramist accounts yet. Add users with a role that can be assigned as ceramist.
                  </span>
                )}
              </label>
              <button
                type="submit"
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
              >
                Save
              </button>
            </form>
          </section>
      )}

      {canAssign && DESIGN_PHASE_STATUSES.includes(status) && (
        <section className="mb-6 flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
          {hasIbar && beforeIbar && (
            <DesignerForm
              caseId={caseRecord.id}
              slot="first"
              label="Designer before ibar"
              defaultId={caseRecord.firstDesignerId}
              designers={designers}
            />
          )}
          <DesignerForm
            caseId={caseRecord.id}
            slot="second"
            label={hasIbar ? "Designer after ibar" : "Assign designer"}
            defaultId={caseRecord.assignedDesignerId}
            designers={designers}
          />
        </section>
      )}

      {isAssignedDesigner && status === "READY_FOR_DESIGN" && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <form action={startDesignAction}>
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <button
              type="submit"
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
            >
              Start Design
            </button>
          </form>
        </section>
      )}

      {isAssignedDesigner && (status === "IN_DESIGN" || status === "CHANGES_REQUESTED") && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Submit for review</h2>
          <form action={submitForReviewAction} className="flex flex-col gap-4">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <FileDropField name="designFile" required hint="Exocad export, ZIP or STL" />
            <button
              type="submit"
              className="self-start rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover"
            >
              Submit for Review
            </button>
          </form>
        </section>
      )}

      {can(access, "case.review") && status === "WAITING_FOR_REVIEW" && (
        <section className="mb-6 rounded-xl border border-violet-200 bg-violet-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            {beforeIbar ? "Review the design before the ibar" : "Review this case"}
          </h2>
          <p className="mb-3 text-sm text-slate-500">
            {beforeIbar
              ? "Approving sends the case to the ibar designer."
              : "Approving sends the case to milling."}
          </p>
          <form action={requestChangesAction} className="flex flex-col gap-3">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
              Review comment
              <textarea
                name="comment"
                rows={2}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
            </label>
            <div className="flex gap-3">
              <button
                formAction={approveAction}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <CheckCircle2 size={16} />
                Approve
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-rose-700"
              >
                <XCircle size={16} />
                Request Changes
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Files</h2>
        <ul className="flex flex-col divide-y divide-slate-100">
          {caseRecord.files.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <a
                href={viaApp ? `/api/files/${f.id}` : f.driveLink}
                {...(viaApp ? {} : { target: "_blank", rel: "noreferrer" })}
                className="flex items-center gap-2 text-slate-700 hover:text-brand"
              >
                <FileText size={15} className="shrink-0 text-slate-400" />
                {f.fileName}
              </a>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {f.type}
              </span>
            </li>
          ))}
          {caseRecord.files.length === 0 && (
            <li className="py-4 text-sm text-slate-400">No files yet.</li>
          )}
        </ul>
      </section>

      {caseRecord.reviews.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Review history</h2>
          <ul className="flex flex-col gap-4">
            {caseRecord.reviews.map((r) => (
              <li key={r.id} className="flex gap-3 text-sm">
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                    r.decision === "APPROVED" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {r.decision === "APPROVED" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                </div>
                <div>
                  <p className="text-slate-800">
                    <span className="font-medium">
                      {r.decision === "APPROVED" ? "Approved" : "Changes requested"}
                    </span>{" "}
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <User size={12} /> {r.reviewedBy.name}
                    </span>{" "}
                    <span className="text-slate-400">
                      · {new Date(r.createdAt).toLocaleString()}
                    </span>
                  </p>
                  {r.comment && <p className="mt-0.5 text-slate-500">{r.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DesignerForm({
  caseId,
  slot,
  label,
  defaultId,
  designers,
}: {
  caseId: string;
  slot: "first" | "second";
  label: string;
  defaultId: string | null;
  designers: { id: string; name: string }[];
}) {
  return (
    <form action={assignDesignerAction} className="flex items-end gap-3">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="slot" value={slot} />
      <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
        {label}
        <select
          name="designerId"
          defaultValue={defaultId ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        >
          <option value="">Unassigned</option>
          {designers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
      >
        Save
      </button>
    </form>
  );
}

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}

function Money({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: number | null | undefined;
  emphasize?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={emphasize ? "mt-0.5 font-semibold text-slate-900" : "mt-0.5 text-slate-800"}>
        {formatEGP(value)}
      </p>
    </div>
  );
}
