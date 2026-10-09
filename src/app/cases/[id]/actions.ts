"use server";

import {
  advanceProduction,
  assignCeramist,
  assignDesigner,
  assignRolePerson,
  completeIbar,
  completeMatching,
  completeTryIn,
  markDelivered,
  markPhotogrammetryDone,
  setCaseStatus,
  toggleChecklistItem,
  addCaseChecklistItem,
  removeCaseChecklistItem,
  uploadCaseFile,
  submitWork,
  reviewWork,
  startDesign,
  submitForReview,
  reviewCase,
} from "../actions";
import type { ApprovalRoute } from "@/lib/constants";

export async function assignDesignerAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const designerId = formData.get("designerId") as string;
  const slot = formData.get("slot") === "first" ? "first" : "second";
  await assignDesigner(caseId, designerId || null, slot);
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

// Bound per button: approves and sends the case to printing or milling.
export async function approveWithRouteAction(route: ApprovalRoute, formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const comment = (formData.get("comment") as string) || undefined;
  await reviewCase(caseId, "APPROVED", comment, route);
}

export async function completeTryInAction(formData: FormData) {
  await completeTryIn(formData.get("caseId") as string, formData);
}

export async function requestChangesAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const comment = (formData.get("comment") as string) || undefined;
  await reviewCase(caseId, "CHANGES_REQUESTED", comment);
}

export async function assignCeramistAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const ceramistId = (formData.get("ceramistId") as string) || undefined;
  await assignCeramist(caseId, ceramistId);
}

export async function markDeliveredAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await markDelivered(caseId);
}

export async function advanceProductionAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await advanceProduction(caseId);
}

export async function completeMatchingAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await completeMatching(caseId);
}

export async function markPhotogrammetryDoneAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await markPhotogrammetryDone(caseId, formData);
}

export async function completeIbarAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await completeIbar(caseId, formData);
}

export async function setCaseStatusAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const status = String(formData.get("status") ?? "");
  await setCaseStatus(caseId, status);
}

export async function assignRolePersonAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  const roleId = formData.get("roleId") as string;
  const userId = (formData.get("userId") as string) || null;
  await assignRolePerson(caseId, roleId, userId);
}

export async function submitWorkAction(formData: FormData) {
  const caseId = formData.get("caseId") as string;
  await submitWork(caseId, formData);
}

export async function approveWorkAction(formData: FormData) {
  await reviewWork(formData.get("submissionId") as string, true, (formData.get("comment") as string) || undefined);
}

export async function requestWorkChangesAction(formData: FormData) {
  await reviewWork(formData.get("submissionId") as string, false, (formData.get("comment") as string) || undefined);
}

export async function toggleChecklistItemAction(formData: FormData) {
  await toggleChecklistItem(formData.get("caseId") as string, formData.get("key") as string);
}

export async function addCaseChecklistItemAction(formData: FormData) {
  await addCaseChecklistItem(formData.get("caseId") as string, String(formData.get("text") ?? ""));
}

export async function removeCaseChecklistItemAction(formData: FormData) {
  await removeCaseChecklistItem(formData.get("caseId") as string, formData.get("itemId") as string);
}

export async function uploadCaseFileAction(formData: FormData) {
  await uploadCaseFile(formData.get("caseId") as string, formData);
}
