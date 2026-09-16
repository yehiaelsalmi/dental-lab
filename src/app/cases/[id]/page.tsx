import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  FolderOpen,
  FileText,
  CheckCircle2,
  XCircle,
  User,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import type { CaseStatus } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { FileDropField } from "@/components/FileDropField";
import {
  assignDesignerAction,
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
  const session = await requireSession();
  const { role, id: userId } = session.user;

  const caseRecord = await prisma.case.findUnique({
    where: { id },
    include: {
      assignedDesigner: true,
      createdBy: true,
      files: { orderBy: { createdAt: "asc" } },
      reviews: { orderBy: { createdAt: "desc" }, include: { reviewedBy: true } },
    },
  });

  if (!caseRecord) notFound();

  const designers =
    role === "LAB_LEADER" || role === "DATA_ENTRY"
      ? await prisma.user.findMany({ where: { role: "DESIGNER", active: true } })
      : [];

  const status = caseRecord.status as CaseStatus;
  const isAssignedDesigner = role === "DESIGNER" && caseRecord.assignedDesignerId === userId;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <Link
        href="/cases"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={15} />
        Back to cases
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{caseRecord.patientName}</h1>
          <p className="mt-1 text-sm text-slate-500">{caseRecord.doctorName}</p>
        </div>
        <StatusBadge status={status} />
      </div>

      {error && (
        <p className="mb-6 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <WorkflowStepper status={status} />
      </section>

      <section className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-slate-200 bg-white p-6 text-sm">
        <Info label="Units (Upper / Lower)" value={`${caseRecord.unitsUpper ?? "-"} / ${caseRecord.unitsLower ?? "-"}`} />
        <Info label="Material" value={caseRecord.material ?? "-"} />
        <Info label="System" value={caseRecord.system ?? "-"} />
        <Info label="Shade" value={caseRecord.shade ?? "-"} />
        <Info label="Entry date" value={new Date(caseRecord.entryDate).toLocaleDateString()} />
        <Info label="Due date" value={caseRecord.dueDate ? new Date(caseRecord.dueDate).toLocaleDateString() : "-"} />
        <Info label="Created by" value={caseRecord.createdBy.name} />
        <Info label="Designer" value={caseRecord.assignedDesigner?.name ?? "Unassigned"} />
        {caseRecord.notes && <Info label="Notes" value={caseRecord.notes} full />}
        {caseRecord.driveFolderUrl && (
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

      {(role === "LAB_LEADER" || role === "DATA_ENTRY") && status !== "COMPLETED" && (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <form action={assignDesignerAction} className="flex items-end gap-3">
            <input type="hidden" name="caseId" value={caseRecord.id} />
            <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-slate-700">
              Assign designer
              <select
                name="designerId"
                defaultValue={caseRecord.assignedDesignerId ?? ""}
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

      {role === "LAB_LEADER" && status === "WAITING_FOR_REVIEW" && (
        <section className="mb-6 rounded-xl border border-violet-200 bg-violet-50/50 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Review this case</h2>
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
                href={f.driveLink}
                target="_blank"
                rel="noreferrer"
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

function Info({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-slate-800">{value}</p>
    </div>
  );
}
