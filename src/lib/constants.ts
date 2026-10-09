export const CASE_STATUSES = [
  "READY_FOR_DESIGN",
  "IBAR_DESIGN",
  "IN_DESIGN",
  "WAITING_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "PRINTING",
  "MILLING",
  "TRY_IN",
  "MATCHING",
  "REDESIGN",
  "STAIN_AND_GLAZE",
  "COMPLETED",
  "DELIVERED",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  READY_FOR_DESIGN: "Ready for Design",
  IBAR_DESIGN: "Ibar Design",
  IN_DESIGN: "In Design",
  WAITING_FOR_REVIEW: "Waiting for Review",
  CHANGES_REQUESTED: "Changes Requested",
  PRINTING: "Printing",
  MILLING: "Milling",
  TRY_IN: "Try-in at Doctor",
  MATCHING: "Matching",
  REDESIGN: "Redesign",
  STAIN_AND_GLAZE: "Stain & Glaze",
  COMPLETED: "Completed",
  DELIVERED: "Delivered",
};

// Statuses where the case is still with (or waiting on) the designer,
// including the try-in loop that ends in a redesign.
export const DESIGN_PHASE_STATUSES: CaseStatus[] = [
  "READY_FOR_DESIGN",
  "IBAR_DESIGN",
  "IN_DESIGN",
  "WAITING_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "TRY_IN",
  "MATCHING",
  "REDESIGN",
];

// Once the first design has been submitted the ceramist can be picked.
export const CERAMIST_ASSIGNABLE_STATUSES: CaseStatus[] = [
  "WAITING_FOR_REVIEW",
  "PRINTING",
  "MILLING",
  "TRY_IN",
  "MATCHING",
  "REDESIGN",
  "STAIN_AND_GLAZE",
  "COMPLETED",
];

// What the reviewer picks when approving a design (after the ibar, if any).
export const APPROVAL_ROUTES = {
  PRINT_TRYIN: "Printing, then try-in at the doctor",
  PRINT: "Printing, then ceramist",
  MILL: "Milling, then ceramist",
} as const;
export type ApprovalRoute = keyof typeof APPROVAL_ROUTES;

export const CASE_FILE_TYPES = ["SCAN", "IBAR", "DESIGN", "PHOTOGRAMMETRY", "WORK", "OTHER"] as const;
export type CaseFileType = (typeof CASE_FILE_TYPES)[number];

export const REVIEW_DECISIONS = ["APPROVED", "CHANGES_REQUESTED"] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export const LAB_NAME = "Alexandria All on four Lab";
export const LAB_INITIALS = "A4";
