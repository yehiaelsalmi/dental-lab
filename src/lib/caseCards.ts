import { cache } from "react";
import { getSetting, setSetting } from "@/lib/settings";

// The "Active" and "All cases" cards on the Cases page can be hidden like
// statuses (AppSetting: JSON array of the hidden ones).
export const CASE_CARDS = { ACTIVE: "Active (not delivered)", ALL: "All cases" } as const;
export type CaseCard = keyof typeof CASE_CARDS;
const KEY = "cases.hiddenCards";

export const hiddenCaseCards = cache(async (): Promise<Set<string>> => {
  try {
    const parsed = JSON.parse((await getSetting(KEY)) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
});

export async function setCaseCardHidden(card: CaseCard, hidden: boolean) {
  const keys = new Set(await hiddenCaseCards());
  if (hidden) keys.add(card);
  else keys.delete(card);
  await setSetting(KEY, JSON.stringify([...keys]));
}
