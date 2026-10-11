// Every patient folder in Drive has these subfolders. Files that fit none of
// them (ibar, photogrammetry, other work, upload-any-time) stay in the patient
// folder itself.
export const CASE_SUBFOLDERS = {
  SCANS: "scans (for design)",
  DESIGN: "project (designer)",
  TRYIN_SCANS: "new scans (for matching)",
  REDESIGN: "project after matching (2nd design)",
  MILLING: "milling",
} as const;
export type CaseSubfolder = keyof typeof CASE_SUBFOLDERS;

const PRODUCTION_STATUSES = ["PRINTING", "MILLING"];

// A design submitted after a try-in is the redesign.
export function designSubfolder(c: { tryInDoneAt: Date | null }): CaseSubfolder {
  return c.tryInDoneAt ? "REDESIGN" : "DESIGN";
}

// People in a Milling or Printing role, or anything uploaded while the case is
// being printed or milled.
export function isProductionRole(roleName: string | null | undefined): boolean {
  return /milling|printing/i.test(roleName ?? "");
}

export function uploadSubfolder(status: string, roleName?: string | null): CaseSubfolder | undefined {
  return PRODUCTION_STATUSES.includes(status) || isProductionRole(roleName) ? "MILLING" : undefined;
}

// Where an already-uploaded file belongs, for sorting existing case folders.
// Scans and designs uploaded after the try-in belong to the second round.
export function subfolderForExistingFile(
  file: { type: string; createdAt: Date },
  c: { tryInDoneAt: Date | null },
  workRoleName?: string | null
): CaseSubfolder | undefined {
  const afterTryIn = !!c.tryInDoneAt && file.createdAt.getTime() >= c.tryInDoneAt.getTime() - 60_000;
  switch (file.type) {
    case "SCAN":
      return afterTryIn ? "TRYIN_SCANS" : "SCANS";
    case "DESIGN":
      return afterTryIn ? "REDESIGN" : "DESIGN";
    case "WORK":
      return isProductionRole(workRoleName) ? "MILLING" : undefined;
    default:
      return undefined;
  }
}
