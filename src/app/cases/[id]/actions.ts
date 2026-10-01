"use server";

import {
  advanceProduction,
  assignCeramist,
  assignDesigner,
  markDelivered,
  startDesign,
  submitForReview,
  reviewCase,
} from "../actions";

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

export async function assignCeramistAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const ceramistId = (formData.get("ceramistId") as string) || undefined;
  const newName = (formData.get("newCeramistName") as string) || undefined;
  await assignCeramist(caseId, ceramistId, newName);
}

export async function markDeliveredAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await markDelivered(caseId);
}

export async function advanceProductionAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await advanceProduction(caseId);
}
