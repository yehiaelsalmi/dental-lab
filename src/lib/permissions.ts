import type { CaseStatus } from "@/lib/constants";

// Everything a role can be allowed to do. Roles are managed by the Lab Leader
// on the Roles page; the Lab Leader role itself always has every permission.
export const PERMISSIONS = [
  { key: "case.create", group: "Cases", label: "Create cases" },
  { key: "case.edit", group: "Cases", label: "Edit case details" },
  { key: "case.delete", group: "Cases", label: "Delete cases" },
  { key: "case.assign", group: "Cases", label: "Assign people to cases (designers, ceramists and other roles)" },
  { key: "files.drive", group: "Cases", label: "Open files directly in Google Drive" },

  { key: "work.design", group: "Work", label: "Can be assigned as a designer (designs and submits their cases)" },
  { key: "work.ceramist", group: "Work", label: "Can be assigned as a ceramist" },

  { key: "case.review", group: "Workflow steps", label: "Approve or request changes on designs" },
  { key: "case.ibar", group: "Workflow steps", label: "Mark ibar done" },
  { key: "case.matching", group: "Workflow steps", label: "Mark matching done" },
  { key: "case.milling", group: "Workflow steps", label: "Mark milling done" },
  { key: "case.stainGlaze", group: "Workflow steps", label: "Mark stain & glaze done" },
  { key: "case.deliver", group: "Workflow steps", label: "Mark cases delivered" },
  { key: "case.photogrammetry", group: "Workflow steps", label: "Mark photogrammetry done" },
  { key: "case.setStatus", group: "Workflow steps", label: "Move a case to any status" },
  { key: "work.upload", group: "Workflow steps", label: "Upload work for review (on cases they're assigned to)" },
  { key: "case.reviewWork", group: "Workflow steps", label: "Review uploaded work (approve or request changes)" },
  { key: "case.upload", group: "Cases", label: "Upload files to a case at any time" },

  { key: "money.viewAll", group: "Money", label: "See all prices, fees and profit" },
  { key: "money.viewOwn", group: "Money", label: "See their own earnings" },

  { key: "page.designers", group: "Pages", label: "Designers page" },
  { key: "page.ceramists", group: "Pages", label: "Ceramists page" },
  { key: "page.team", group: "Pages", label: "Team pages for other roles (e.g. Milling, Technician)" },
  { key: "page.reports", group: "Pages", label: "Reports" },
  { key: "page.invoices", group: "Pages", label: "Invoices" },
  { key: "page.users", group: "Pages", label: "Users" },
  { key: "page.roles", group: "Pages", label: "Roles" },
  { key: "page.pricing", group: "Pages", label: "Pricing" },
  { key: "page.doctors", group: "Pages", label: "Doctors (rename and delete)" },
  { key: "page.statuses", group: "Pages", label: "Statuses (add custom statuses, rename statuses)" },
  { key: "page.checklists", group: "Pages", label: "Checklists (items to tick per status, and extra items on a case)" },
  { key: "page.expenses", group: "Pages", label: "Expenses" },
  { key: "page.fields", group: "Pages", label: "Custom fields (add fields to the case form)" },
  { key: "page.settings", group: "Pages", label: "Lab settings (name, logo, invoice details, alerts)" },
  { key: "page.drive", group: "Pages", label: "Drive Settings" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as Permission[];

// "Can be assigned as..." marks the people who do that work; it isn't an
// ability. The Lab Leader gets everything else, so leaders don't show up in
// the designer and ceramist lists.
const WORK_KEYS: Permission[] = ["work.design", "work.ceramist"];
export const LAB_LEADER_PERMISSIONS = PERMISSION_KEYS.filter((p) => !WORK_KEYS.includes(p));

// Which cases a role sees (before narrowing by status).
export const CASE_SCOPES = [
  { key: "ALL", label: "All cases" },
  { key: "OWN", label: "Only cases they're assigned to (as designer or ceramist)" },
  { key: "PHOTOGRAMMETRY", label: "Only cases that need photogrammetry" },
] as const;
export type CaseScope = (typeof CASE_SCOPES)[number]["key"];

// Besides status changes, a role can be notified when a new case needs
// photogrammetry.
export const PHOTOGRAMMETRY_NEEDED = "PHOTOGRAMMETRY_NEEDED";

export const LAB_LEADER_KEY = "LAB_LEADER";

export type RolePreset = {
  id: string;
  key: string | null;
  name: string;
  permissions: Permission[];
  caseScope: CaseScope;
  visibleStatuses: CaseStatus[]; // empty = every status
  notifyOn: string[]; // statuses and/or PHOTOGRAMMETRY_NEEDED
};

// The roles every new installation starts with (also created by the
// migration that introduced roles). All but the Lab Leader can be edited.
export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "role_lab_leader",
    key: LAB_LEADER_KEY,
    name: "Lab Leader",
    permissions: LAB_LEADER_PERMISSIONS,
    caseScope: "ALL",
    visibleStatuses: [],
    notifyOn: [],
  },
  {
    id: "role_technician",
    key: "TECHNICIAN",
    name: "Technician",
    permissions: [
      "case.create",
      "case.edit",
      "case.assign",
      "files.drive",
      "case.ibar",
      "case.matching",
      "case.milling",
      "case.stainGlaze",
      "case.deliver",
      "case.photogrammetry",
      "case.setStatus",
      "page.statuses",
    ],
    caseScope: "ALL",
    visibleStatuses: [],
    notifyOn: [],
  },
  {
    id: "role_designer",
    key: "DESIGNER",
    name: "Designer",
    permissions: ["work.design", "money.viewOwn"],
    caseScope: "OWN",
    visibleStatuses: [],
    notifyOn: [],
  },
  {
    id: "role_photogrammetry",
    key: "PHOTOGRAMMETRY",
    name: "Photogrammetry",
    permissions: ["case.photogrammetry", "money.viewOwn"],
    caseScope: "PHOTOGRAMMETRY",
    visibleStatuses: [],
    notifyOn: [PHOTOGRAMMETRY_NEEDED],
  },
  {
    id: "role_ceramist",
    key: null,
    name: "Ceramist",
    permissions: ["work.ceramist", "case.stainGlaze", "money.viewOwn"],
    caseScope: "OWN",
    visibleStatuses: [],
    notifyOn: ["STAIN_AND_GLAZE"],
  },
];
