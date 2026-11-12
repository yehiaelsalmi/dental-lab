"use server";

import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getURLFromRedirectError } from "next/dist/client/components/redirect";
import {
  attachNewCaseScan,
  completeIbar,
  completeMatching,
  completeTryIn,
  markPhotogrammetryDone,
  submitForReview,
  submitWork,
  uploadCaseFile,
} from "./actions";

export type UploadStepResult = { ok: true; caseId: string | null } | { ok: false; error: string };

// Runs the step a form was for, after its files were uploaded to Drive in the
// background (see UploadManager). The steps redirect on errors; that's turned
// into a message here so the person isn't pulled off the page they're on.
export async function runUploadStep(step: string, formData: FormData): Promise<UploadStepResult> {
  const caseId = String(formData.get("caseId") ?? "") || null;
  try {
    switch (step) {
      case "newCaseScan":
        return { ok: true, caseId: await attachNewCaseScan(formData) };
      case "design":
        await submitForReview(caseId!, formData);
        break;
      case "tryInScans":
        await completeTryIn(caseId!, formData);
        break;
      case "ibar":
        await completeIbar(caseId!, formData);
        break;
      case "matching":
        await completeMatching(caseId!, formData);
        break;
      case "photogrammetry":
        await markPhotogrammetryDone(caseId!, formData);
        break;
      case "work":
        await submitWork(caseId!, formData);
        break;
      case "upload":
        await uploadCaseFile(caseId!, formData);
        break;
      default:
        return { ok: false, error: "Unknown upload." };
    }
    return { ok: true, caseId };
  } catch (error) {
    if (isRedirectError(error)) {
      const message = new URL(getURLFromRedirectError(error), "http://x").searchParams.get("error");
      return message ? { ok: false, error: message } : { ok: true, caseId };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong." };
  }
}
