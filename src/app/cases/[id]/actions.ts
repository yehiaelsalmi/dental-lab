"use server";

import { assignDesigner, startDesign, submitForReview, reviewCase } from "../actions";

export async function assignDesignerAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const designerId = formData.get("designerId") as string;
  await assignDesigner(caseId, designerId || null);
}

export async function startDesignAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await startDesign(caseId);
}

export async function submitForReviewAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await submitForReview(caseId, formData);
}

export async function approveAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const comment = (formData.get("comment") as string) || undefined;
  await reviewCase(caseId, "APPROVED", comment);
}

export async function requestChangesAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const comment = (formData.get("comment") as string) || undefined;
  await reviewCase(caseId, "CHANGES_REQUESTED", comment);
}
