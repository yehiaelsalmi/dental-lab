import { Check } from "lucide-react";
import type { CaseStatus } from "@/lib/constants";

const STEPS: { key: CaseStatus; label: string }[] = [
  { key: "READY_FOR_DESIGN", label: "Ready for Design" },
  { key: "IN_DESIGN", label: "In Design" },
  { key: "WAITING_FOR_REVIEW", label: "Waiting for Review" },
  { key: "MILLING", label: "Milling" },
  { key: "STAIN_AND_GLAZE", label: "Stain & Glaze" },
  { key: "COMPLETED", label: "Completed" },
  { key: "DELIVERED", label: "Delivered" },
];

export function WorkflowStepper({ status }: { status: CaseStatus }) {
  const changesRequested = status === "CHANGES_REQUESTED";
  const currentIndex = changesRequested
    ? 1
    : STEPS.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const isCurrent = i === currentIndex;
        const isPast = i < currentIndex;
        const isChangesStep = isCurrent && changesRequested;

        return (
          <div key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex w-16 flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                  isChangesStep
                    ? "bg-rose-500 text-white"
                    : isPast
                      ? "bg-brand text-white"
                      : isCurrent
                        ? "bg-brand text-white ring-4 ring-brand-soft"
                        : "bg-slate-100 text-slate-400"
                }`}
              >
                {isPast ? <Check size={16} /> : i + 1}
              </div>
              <span
                className={`mt-2 text-center text-[11px] font-medium leading-tight ${
                  isChangesStep
                    ? "text-rose-600"
                    : isCurrent || isPast
                      ? "text-slate-900"
                      : "text-slate-400"
                }`}
              >
                {isChangesStep ? "Changes Requested" : step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${isPast ? "bg-brand" : "bg-slate-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
