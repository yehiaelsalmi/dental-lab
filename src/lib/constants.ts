export const CASE_STATUSES = [
  "READY_FOR_DESIGN",
  "IBAR_DESIGN",
  "IN_DESIGN",
  "MATCHING",
  "WAITING_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "MILLING",
  "STAIN_AND_GLAZE",
  "COMPLETED",
  "DELIVERED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  READY_FOR_DESIGN: "Ready for Design",
  IBAR_DESIGN: "Ibar Design",
  IN_DESIGN: "In Design",
  MATCHING: "Matching",
  WAITING_FOR_REVIEW: "Waiting for Review",
  CHANGES_REQUESTED: "Changes Requested",
  MILLING: "Milling",
  STAIN_AND_GLAZE: "Stain & Glaze",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
};

// Statuses where the case is still with (or waiting on) the designer.
export const DESIGN_PHASE_STATUSES: CaseStatus[] = [
  "READY_FOR_DESIGN",
  "IBAR_DESIGN",
  "IN_DESIGN",
  "MATCHING",
  "WAITING_FOR_REVIEW",
  "CHANGES_REQUESTED",
];

export const CASE_FILE_TYPES = ["SCAN", "IBAR", "DESIGN", "PHOTOGRAMMETRY", "WORK", "OTHER"] as const;
export type CaseFileType = (typeof CASE_FILE_TYPES)[number];

export const REVIEW_DECISIONS = ["APPROVED", "CHANGES_REQUESTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const LAB_NAME = "Alexandria All on four Lab";
export const LAB_INITIALS = "A4";
