export const ROLES = ["TECHNICIAN", "DESIGNER", "LAB_LEADER"] as const;
export type Role = (typeof ROLES)[number];

export const CASE_STATUSES = [
  "READY_FOR_DESIGN",
  "IN_DESIGN",
  "WAITING_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "COMPLETED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  READY_FOR_DESIGN: "Ready for Design",
  IN_DESIGN: "In Design",
  WAITING_FOR_REVIEW: "Waiting for Review",
  CHANGES_REQUESTED: "Changes Requested",
  COMPLETED: "Completed",
};

export const CASE_FILE_TYPES = ["SCAN", "DESIGN"] as const;
export type CaseFileType = (typeof CASE_FILE_TYPES)[number];

export const REVIEW_DECISIONS = ["APPROVED", "CHANGES_REQUESTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
