import { Check } from "lucide-react";
import type { CaseStatus } from "@/lib/constants";

type Step = { key: string; label: string };

// Ibar cases go through design + review twice: once before the ibar, once
// after. Matching only appears on cases that use it (or are in it).
function stepsFor(hasIbar: boolean, hasMatching: boolean, status: CaseStatus): Step[] {
  return [
    ...(hasIbar
      ? [
          { key: "FIRST_DESIGN", label: "Design (before ibar)" },
          { key: "FIRST_REVIEW", label: "Review (before ibar)" },
          { key: "IBAR_DESIGN", label: "Ibar Design" },
        ]
      : []),
    { key: "READY_FOR_DESIGN", label: "Ready for Design" },
    { key: "IN_DESIGN", label: "In Design" },
    ...(hasMatching || status === "MATCHING" ? [{ key: "MATCHING", label: "Matching" }] : []),
    { key: "WAITING_FOR_REVIEW", label: "Waiting for Review" },
    { key: "MILLING", label: "Milling" },
    { key: "STAIN_AND_GLAZE", label: "Stain & Glaze" },
    { key: "COMPLETED", label: "Completed" },
    { key: "DELIVERED", label: "Delivered" },
  ];
}

function currentKey(status: CaseStatus, beforeIbar: boolean, isCustom: boolean): string {
  if (isCustom) return status;
  if (beforeIbar) {
    if (status === "WAITING_FOR_REVIEW") return "FIRST_REVIEW";
    if (status === "IBAR_DESIGN") return "IBAR_DESIGN";
    return "FIRST_DESIGN";
  }
  return status === "CHANGES_REQUESTED" ? "IN_DESIGN" : status;
}

export function WorkflowStepper({
  status,
  hasIbar,
  hasMatching,
  beforeIbar,
  customStep,
}: {
  status: CaseStatus;
  hasIbar: boolean;
  hasMatching: boolean;
  beforeIbar: boolean;
  customStep?: { key: string; label: string; afterBuiltIn: string };
}) {
  const steps = stepsFor(hasIbar, hasMatching, status);
  if (customStep) {
    const anchor = steps.findIndex((s) => s.key === customStep.afterBuiltIn);
    steps.splice(anchor === -1 ? steps.length : anchor + 1, 0, {
      key: customStep.key,
      label: customStep.label,
    });
  }
  const currentIndex = steps.findIndex(
    (s) => s.key === currentKey(status, beforeIbar, !!customStep)
  );
  const changesRequested = status === "CHANGES_REQUESTED";

  return (
    <div className="flex items-center" style={{ minWidth: `${steps.length * 72}px` }}>
      {steps.map((step, i) => {
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
            {i < steps.length - 1 && (
              <div className={`mx-1 h-0.5 flex-1 ${isPast ? "bg-brand" : "bg-slate-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
