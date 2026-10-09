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
  Square,
  CheckSquare,
  Trash2,
  Upload,
} from "lucide-react";
import QRCode from "qrcode";
import { caseUrl } from "@/lib/email";
import { formatEGP } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { can, canViewCase, requireAccess, usersWithPermission } from "@/lib/access";
import { earningsOnCase } from "@/lib/earnings";
import { findStatus, getStatuses, isBuiltInStatus } from "@/lib/statuses";
import { formatFieldValue } from "@/lib/customFields";
import { caseChecklist } from "@/lib/checklists";
import {
  APPROVAL_ROUTES,
  CERAMIST_ASSIGNABLE_STATUSES,
  DESIGN_PHASE_STATUSES,
  type ApprovalRoute,
  type CaseStatus,
} from "@/lib/constants";
import { activeDesignerId, isBeforeIbar } from "@/lib/caseFlow";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { FileDropField } from "@/components/FileDropField";
import { PendingSubmitButton } from "@/components/PendingSubmitButton";
import {
  advanceProductionAction,
  assignCeramistAction,
  assignDesignerAction,
  completeIbarAction,
  assignRolePersonAction,
  completeMatchingAction,
  completeTryInAction,
  markDeliveredAction,
  setCaseStatusAction,
  submitWorkAction,
  approveWorkAction,
  requestWorkChangesAction,
  markPhotogrammetryDoneAction,
  requestChangesAction,
  approveAction,
  approveWithRouteAction,
  startDesignAction,
  submitForReviewAction,
  toggleChecklistItemAction,
  addCaseChecklistItemAction,
  removeCaseChecklistItemAction,
  uploadCaseFileAction,
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
      assignments: { include: { role: true, user: true } },
      fieldValues: { include: { field: true }, orderBy: { field: { position: "asc" } } },
      workSubmissions: {
        orderBy: { createdAt: "desc" },
        include: { file: true, uploadedBy: true, reviewedBy: true },
      },
      materials: { orderBy: { createdAt: "asc" }, include: { material: true, metalType: true } },
      units: { orderBy: { createdAt: "asc" } },
      files: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewedBy: true } },
    },
  });

  if (!caseRecord || !canViewCase(access, caseRecord)) notFound();

  const status = caseRecord.status as CaseStatus;
  const allStatuses = await getStatuses();
  // A case in a custom status shows it in the progress bar right after the
  // built-in status it hangs off.
  let customStep: { key: string; label: string; afterBuiltIn: string } | undefined;
  if (!isBuiltInStatus(caseRecord.status)) {
    const info = findStatus(allStatuses, caseRecord.status);
    let anchor = info.afterStatus ?? "COMPLETED";
    for (let i = 0; i < 20 && !isBuiltInStatus(anchor); i++) {
      anchor = findStatus(allStatuses, anchor).afterStatus ?? "COMPLETED";
    }
    customStep = { key: info.key, label: info.label, afterBuiltIn: anchor };
  }
  const canAssign = can(access, "case.assign");
  const canAssignCeramist =
    canAssign &&
    CERAMIST_ASSIGNABLE_STATUSES.includes(status);

  const [ceramists, designers, assignableRoles] = await Promise.all([
    canAssignCeramist ? usersWithPermission("work.ceramist") : [],
    canAssign ? usersWithPermission("work.design") : [],
    canAssign
      ? prisma.role.findMany({
          where: { assignable: true },
          orderBy: { name: "asc" },
          include: { users: { where: { active: true, deletedAt: null }, orderBy: { name: "asc" } } },
        })
      : [],
  ]);

  const checklist = await caseChecklist(caseRecord.id, caseRecord.status);
  const canEditChecklist = can(access, "page.checklists");
  const statusName = findStatus(allStatuses, caseRecord.status).label;

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
  const productionPermission =
    status === "PRINTING" ? "case.printing" : status === "MILLING" ? "case.milling" : "case.stainGlaze";
  const label = (key: string) => findStatus(allStatuses, key).label;
  // Uploading work for review is only for people working on this case.
  const canSubmitWork =
    can(access, "work.upload") &&
    ([caseRecord.assignedDesignerId, caseRecord.firstDesignerId, caseRecord.ceramistId].includes(userId) ||
      caseRecord.assignments.some((a) => a.userId === userId));
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
          caseInfo={caseRecord}
          hasIbar={hasIbar}
          beforeIbar={beforeIbar}
          customStep={customStep}
          labels={Object.fromEntries(allStatuses.map((s) => [s.key, s.label]))}
        />
      </section>

      {(checklist.length > 0 || canEditChecklist) && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{statusName} checklist</h2>
            {checklist.length > 0 && (
              <span className="text-xs text-slate-500">
                {checklist.filter((e) => e.done).length} of {checklist.length} done
                {checklist.some((e) => !e.done) && " · finish it before moving the case on"}
              </span>
            )}
          </div>
          {checklist.length === 0 ? (
            <p className="text-sm text-slate-400">No checklist for this status.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100">
              {checklist.map((e) => (
                <li key={e.key} className="flex items-center gap-3 py-2 text-sm">
                  <form action={toggleChecklistItemAction} className="flex min-w-0 flex-1">
                    <input type="hidden" name="caseId" value={caseRecord.id} />
                    <input type="hidden" name="key" value={e.key} />
                    <button
                      type="submit"
                      className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      aria-label={e.done ? `Untick ${e.text}` : `Tick ${e.text}`}
                    >
                      {e.done ? (
                        <CheckSquare size={18} className="mt-px shrink-0 text-emerald-600" />
                      ) : (
                        <Square size={18} className="mt-px shrink-0 text-slate-400" />
                      )}
                      <span className="min-w-0">
                        <span className={e.done ? "text-slate-500 line-through" : "text-slate-800"}>{e.text}</span>
                        {e.done && (e.doneBy || e.doneAt) && (
                          <span className="block text-xs text-slate-400">
                            {e.doneBy ?? "Someone"}
                            {e.doneAt && ` · ${new Date(e.doneAt).toLocaleString()}`}
                          </span>
                        )}
                      </span>
                    </button>
                  </form>
                  {e.extraId && canEditChecklist && (
                    <form action={removeCaseChecklistItemAction}>
                      <input type="hidden" name="caseId" value={caseRecord.id} />
                      <input type="hidden" name="itemId" value={e.extraId} />
                      <button type="submit" className="text-slate-400 hover:text-rose-600" aria-label={`Remove ${e.text}`}>
                        <Trash2 size={15} />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEditChecklist && (
            <form action={addCaseChecklistItemAction} className="mt-3 flex gap-2">
              <input type="hidden" name="caseId" value={caseRecord.id} />
              <input
                name="text"
                required
                maxLength={200}
                placeholder="Add an item for this case only"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Add
              </button>
            </form>
          )}
        </section>
      )}

      <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <Info label="Units (Upper / Lower)" value={`${caseRecord.unitsUpper ?? "-"} / ${caseRecord.unitsLower ?? "-"}`} />
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
        {caseRecord.assignments.map((a) => (
          <Info key={a.id} label={a.role.name} value={a.user.name} />
        ))}
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

      {caseRecord.fieldValues.length > 0 && (
        <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm">
          <h2 className="col-span-2 text-sm font-semibold text-slate-900">More details</h2>
          {caseRecord.fieldValues.map((v) => (
            <Info
              key={v.id}
              label={v.field.label}
              value={formatFieldValue(v.field.type, v.value)}
              full={v.field.type === "LONGTEXT"}
            />
          ))}
        </section>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Materials</h2>
        {caseRecord.materials.length === 0 ? (
          <p className="text-sm text-slate-400">No materials recorded.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {caseRecord.materials.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-800">
                  <span className="mr-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">
                    {l.arch === "UPPER" ? "Upper" : "Lower"}
                  </span>
                  {l.material.name}
                  {l.metalType && <span className="text-slate-500"> · {l.metalType.name}</span>}
                </span>
                <span className="font-medium text-slate-900">
                  {l.units} unit{l.units === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
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
          {caseRecord.assignments.map((a) => (
            <Money key={a.id} label={`${a.role.name} fee (${a.user.name})`} value={a.fee} />
          ))}
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
                  (caseRecord.photogrammetryCost ?? 0) -
                  caseRecord.assignments.reduce((sum, a) => sum + (a.fee ?? 0), 0)
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
            Scan it to open this case. Print the case sheet (it has this QR code) and keep it
            with the physical work.
          </p>
          <Link
            href={`/cases/${caseRecord.id}/print`}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-hover"
          >
            <Printer size={15} />
            Print case sheet
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
            <PendingSubmitButton overlay pendingText="Uploading the ibar file..." className="self-start rounded-lg bg-fuchsia-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-fuchsia-700">
              Ibar done: send to designer
            </PendingSubmitButton>
          </form>
        </section>
      )}

      {can(access, "case.matching") && status === "MATCHING" && (
        <section className="mb-6 rounded-xl border border-teal-200 bg-teal-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Matching</h2>
          <p className="mb-3 text-sm text-slate-500">
            {caseRecord.tryInDoneAt
              ? `The new scans from the try-in are with ${caseRecord.matchingBy ?? "the matching person"} for matching. When it's done, the case goes back to ${caseRecord.assignedDesigner?.name ?? "the designer"} for the redesign.`
              : `The design is with ${caseRecord.matchingBy ?? "the matching person"} for matching. When it's done, send the case for review.`}
          </p>
          <form action={completeMatchingAction}>
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              {caseRecord.tryInDoneAt ? `Matching done: send for ${label("REDESIGN").toLowerCase()}` : "Matching done: send for review"}
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
            <PendingSubmitButton overlay pendingText="Saving photogrammetry..." className="self-start rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-sky-700">
              Mark photogrammetry done
            </PendingSubmitButton>
          </form>
        </section>
      )}

      {(status === "PRINTING" || status === "MILLING" || status === "STAIN_AND_GLAZE") &&
        can(access, productionPermission) && (
          <section className="mb-6 rounded-xl border border-orange-200 bg-orange-50/50 p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">{label(status)}</h2>
            <p className="mb-3 text-sm text-slate-500">
              {status === "STAIN_AND_GLAZE"
                ? `When the ceramist has finished, move the case to ${label("COMPLETED")}.`
                : status === "PRINTING" && caseRecord.printForTryIn
                  ? "This print goes to the doctor for a try-in. When it's printed, send it out."
                  : `When it's finished, send the case on to the ceramist for ${label("STAIN_AND_GLAZE")}.`}
            </p>
            <form action={advanceProductionAction}>
              <input type="hidden" name="caseId" value={caseRecord.id} />
              <button
                type="submit"
                className="rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-orange-700"
              >
                {status === "STAIN_AND_GLAZE"
                  ? `${label(status)} done: move to ${label("COMPLETED")}`
                  : status === "PRINTING" && caseRecord.printForTryIn
                    ? `${label(status)} done: send for ${label("TRY_IN")}`
                    : `${label(status)} done: send to ${label("STAIN_AND_GLAZE")}`}
              </button>
            </form>
          </section>
        )}

      {can(access, "case.tryIn") && status === "TRY_IN" && (
        <section className="mb-6 rounded-xl border border-lime-200 bg-lime-50/50 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">{label("TRY_IN")}</h2>
          <p className="mb-3 text-sm text-slate-500">
            The print is with the doctor for the try-in. When the new scans come back, upload them:
            the case goes to {label("MATCHING")}
            {caseRecord.matchingBy ? ` (${caseRecord.matchingBy})` : ""}, then back to the designer
            for the redesign.
          </p>
          <form action={completeTryInAction} className="flex flex-col gap-4">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <FileDropField name="scanFiles" required multiple hint="The new scans (you can pick several files)" />
            <PendingSubmitButton overlay pendingText="Uploading the new scans..." className="self-start rounded-lg bg-lime-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-lime-800">
              New scans uploaded: send to {label("MATCHING")}
            </PendingSubmitButton>
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

      {isAssignedDesigner && (status === "IN_DESIGN" || status === "CHANGES_REQUESTED" || status === "REDESIGN") && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">
            {status === "REDESIGN" ? `Submit the ${label("REDESIGN").toLowerCase()} for review` : "Submit for review"}
          </h2>
          {status === "REDESIGN" && (
            <p className="text-sm text-slate-500">
              The doctor tried the print in and matching is done. The new scans are under Files.
            </p>
          )}
          <div className="mb-3" />
          <form action={submitForReviewAction} className="flex flex-col gap-4">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <FileDropField name="designFile" required hint="Exocad export, ZIP or STL" />
            <PendingSubmitButton overlay pendingText="Uploading your design..." className="self-start rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-hover">
              Submit for Review
            </PendingSubmitButton>
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
              : "Approve by picking where the case goes next, or request changes from the designer."}
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
            <div className="flex flex-wrap gap-3">
              {beforeIbar ? (
                <button
                  formAction={approveAction}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
                >
                  <CheckCircle2 size={16} />
                  Approve
                </button>
              ) : (
                (Object.keys(APPROVAL_ROUTES) as ApprovalRoute[]).map((route) => (
                  <button
                    key={route}
                    formAction={approveWithRouteAction.bind(null, route)}
                    data-route={route}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    <CheckCircle2 size={16} />
                    Approve: {APPROVAL_ROUTES[route]}
                  </button>
                ))
              )}
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

      {assignableRoles.length > 0 && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Team</h2>
          <p className="mb-4 text-xs text-slate-500">
            Assign people for other jobs at any stage. They&apos;re notified when assigned.
          </p>
          <div className="flex flex-col gap-3">
            {assignableRoles.map((role) => {
              const current = caseRecord.assignments.find((a) => a.roleId === role.id);
              return (
                <form key={role.id} action={assignRolePersonAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="caseId" value={caseRecord.id} />
                  <input type="hidden" name="roleId" value={role.id} />
                  <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
                    {role.name}
                    <select
                      name="userId"
                      defaultValue={current?.userId ?? ""}
                      className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    >
                      <option value="">Nobody</option>
                      {role.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
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
                  {role.users.length === 0 && (
                    <span className="w-full text-xs text-amber-600">
                      Nobody has the {role.name} role yet. Add them on the Users page.
                    </span>
                  )}
                </form>
              );
            })}
          </div>
        </section>
      )}

      {(canSubmitWork || caseRecord.workSubmissions.length > 0) && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900">Submitted work</h2>
          <p className="mb-4 text-xs text-slate-500">
            Files uploaded for review by the people working on this case.
          </p>

          {caseRecord.workSubmissions.length > 0 && (
            <ul className="mb-4 flex flex-col divide-y divide-slate-100 rounded-lg border border-slate-200">
              {caseRecord.workSubmissions.map((w) => (
                <li key={w.id} className="flex flex-col gap-2 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <a
                      href={viaApp ? `/api/files/${w.file.id}` : w.file.driveLink}
                      {...(viaApp ? {} : { target: "_blank", rel: "noreferrer" })}
                      className="flex items-center gap-2 font-medium text-slate-800 hover:text-brand"
                    >
                      <FileText size={15} className="shrink-0 text-slate-400" />
                      {w.file.fileName}
                    </a>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        w.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700"
                          : w.status === "CHANGES_REQUESTED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {w.status === "APPROVED" ? "Approved" : w.status === "CHANGES_REQUESTED" ? "Changes requested" : "Waiting for review"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {w.uploadedBy.name} ({w.roleName}) · {new Date(w.createdAt).toLocaleString()}
                  </p>
                  {w.note && <p className="text-slate-600">{w.note}</p>}
                  {w.reviewedBy && (
                    <p className="text-xs text-slate-500">
                      Reviewed by {w.reviewedBy.name}
                      {w.reviewComment ? `: ${w.reviewComment}` : ""}
                    </p>
                  )}
                  {w.status === "PENDING" && can(access, "case.reviewWork") && (
                    <form action={requestWorkChangesAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="submissionId" value={w.id} />
                      <input
                        name="comment"
                        placeholder="Comment (optional)"
                        className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-brand"
                      />
                      <button
                        formAction={approveWorkAction}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 size={14} />
                        Approve
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700"
                      >
                        <XCircle size={14} />
                        Request changes
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}

          {canSubmitWork && (
            <form action={submitWorkAction} className="flex flex-col gap-3">
              <input type="hidden" name="caseId" value={caseRecord.id} />
              <FileDropField name="workFile" required hint="The file to be reviewed (any type)" />
              <input
                name="note"
                placeholder="Note for the reviewer (optional)"
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <PendingSubmitButton overlay pendingText="Uploading your file..." className="self-start rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-hover">
              Submit for review
            </PendingSubmitButton>
            </form>
          )}
        </section>
      )}

      {can(access, "case.setStatus") && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <form action={setCaseStatusAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <label className="flex min-w-48 flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
              Move to status
              <select
                name="status"
                defaultValue=""
                required
                className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              >
                <option value="" disabled>
                  Pick a status
                </option>
                {allStatuses
                  .filter((s) => s.key !== caseRecord.status)
                  .map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Move
            </button>
          </form>
          <p className="mt-2 text-xs text-slate-500">
            Only changes the status. The usual automatic steps (like review emails) don&apos;t run;
            roles set to be notified for the new status are told.
          </p>
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
        {can(access, "case.upload") && caseRecord.driveFolderId && (
          <form action={uploadCaseFileAction} className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <FileDropField name="caseFile" required hint="Any file: photos, scans, ZIP, STL..." />
            <PendingSubmitButton overlay pendingText="Uploading the file..." className="flex items-center gap-1.5 self-start rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800">
              <Upload size={15} />
              Upload to the case folder
            </PendingSubmitButton>
          </form>
        )}
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
