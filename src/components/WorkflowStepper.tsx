import { Check } from "lucide-react";

type Step = { key: string; label: string };

export type StepperCase = {
  status: string;
  productionMethod: string | null;
  printForTryIn: boolean;
  tryInDoneAt: Date | null;
};

const PRODUCTION_LABEL: Record<string, string> = { PRINTING: "Printing", MILLING: "Milling" };

// A case on the try-in route has a second round after the doctor's try-in:
// Printing -> Try-in -> Matching -> Redesign -> Review -> Printing/Milling.
function onTryInRoute(c: StepperCase): boolean {
  return (
    !!c.tryInDoneAt ||
    (c.status === "PRINTING" && c.printForTryIn) ||
    c.status === "TRY_IN" ||
    c.status === "REDESIGN"
  );
}

// Ibar cases go through design + review twice: once before the ibar, once
// after.
function stepsFor(hasIbar: boolean, c: StepperCase, labels: Record<string, string>): Step[] {
  const name = (key: string, fallback: string) => labels[key] ?? fallback;
  // Printing or Milling once the reviewer has picked; both until then.
  const production = (method: string | null) =>
    method ? name(method, PRODUCTION_LABEL[method]) : `${name("PRINTING", "Printing")} / ${name("MILLING", "Milling")}`;
  const tryIn = onTryInRoute(c);
  // In the second round the earlier choice (printing for the try-in) doesn't
  // count until the second review has picked again.
  const secondDecided =
    !!c.tryInDoneAt && !["TRY_IN", "MATCHING", "REDESIGN", "WAITING_FOR_REVIEW", "CHANGES_REQUESTED"].includes(c.status);

  return [
    ...(hasIbar
      ? [
          { key: "FIRST_DESIGN", label: "Design (before ibar)" },
          { key: "FIRST_REVIEW", label: "Review (before ibar)" },
          { key: "IBAR_DESIGN", label: name("IBAR_DESIGN", "Ibar Design") },
        ]
      : []),
    { key: "READY_FOR_DESIGN", label: name("READY_FOR_DESIGN", "Ready for Design") },
    { key: "IN_DESIGN", label: name("IN_DESIGN", "In Design") },
    { key: "WAITING_FOR_REVIEW", label: name("WAITING_FOR_REVIEW", "Waiting for Review") },
    ...(tryIn
      ? [
          { key: "PRODUCTION", label: name("PRINTING", "Printing") },
          { key: "TRY_IN", label: name("TRY_IN", "Try-in at Doctor") },
          { key: "MATCHING", label: name("MATCHING", "Matching") },
          { key: "REDESIGN", label: name("REDESIGN", "Redesign") },
          { key: "REVIEW_2", label: `${name("WAITING_FOR_REVIEW", "Review")} (2)` },
          { key: "PRODUCTION_2", label: production(secondDecided ? c.productionMethod : null) },
        ]
      : [{ key: "PRODUCTION", label: production(c.productionMethod) }]),
    // Legacy cases that reached matching before the try-in flow existed.
    ...(!tryIn && c.status === "MATCHING" ? [{ key: "MATCHING", label: name("MATCHING", "Matching") }] : []),
    { key: "STAIN_AND_GLAZE", label: name("STAIN_AND_GLAZE", "Stain & Glaze") },
    { key: "COMPLETED", label: name("COMPLETED", "Completed") },
    { key: "DELIVERED", label: name("DELIVERED", "Delivered") },
  ];
}

function currentKey(c: StepperCase, beforeIbar: boolean, isCustom: boolean): string {
  const status = c.status;
  if (isCustom) return status;
  if (beforeIbar) {
    if (status === "WAITING_FOR_REVIEW") return "FIRST_REVIEW";
    if (status === "IBAR_DESIGN") return "IBAR_DESIGN";
    return "FIRST_DESIGN";
  }
  const secondRound = !!c.tryInDoneAt;
  switch (status) {
    case "CHANGES_REQUESTED":
      return secondRound ? "REDESIGN" : "IN_DESIGN";
    case "WAITING_FOR_REVIEW":
      return secondRound ? "REVIEW_2" : "WAITING_FOR_REVIEW";
    case "PRINTING":
    case "MILLING":
      return secondRound ? "PRODUCTION_2" : "PRODUCTION";
    default:
      return status;
  }
}

export function WorkflowStepper({
  caseInfo,
  hasIbar,
  beforeIbar,
  customStep,
  labels = {},
}: {
  // Renamed built-in statuses (e.g. Completed -> Revision) keep their place.
  labels?: Record<string, string>;
  caseInfo: StepperCase;
  hasIbar: boolean;
  beforeIbar: boolean;
  customStep?: { key: string; label: string; afterBuiltIn: string };
}) {
  const status = caseInfo.status;
  const steps = stepsFor(hasIbar, caseInfo, labels);
  if (customStep) {
    // Steps that merge several statuses: production (printing or milling,
    // the later round if there is one) and the design step (changes requested).
    const after = customStep.afterBuiltIn;
    const keys =
      after === "PRINTING" || after === "MILLING"
        ? ["PRODUCTION_2", "PRODUCTION"]
        : [after === "CHANGES_REQUESTED" ? "IN_DESIGN" : after];
    const anchor = steps.findIndex((s) => s.key === keys.find((k) => steps.some((x) => x.key === k)));
    steps.splice(anchor === -1 ? steps.length : anchor + 1, 0, {
      key: customStep.key,
      label: customStep.label,
    });
  }
  const currentIndex = steps.findIndex(
    (s) => s.key === currentKey(caseInfo, beforeIbar, !!customStep)
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
