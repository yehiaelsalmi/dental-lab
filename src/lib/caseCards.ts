import { cache } from "react";
import { getSetting, setSetting } from "@/lib/settings";

// The "Active" and "All cases" cards on the Cases page can be hidden and
// renamed like statuses (AppSettings: JSON array of the hidden ones; one name
// per card).
export const CASE_CARDS = { ACTIVE: "Active", ALL: "All cases" } as const;
const LABEL_PREFIX = "cases.cardLabel.";
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

export const caseCardLabels = cache(async (): Promise<Record<CaseCard, string>> => {
  const entries = await Promise.all(
    (Object.keys(CASE_CARDS) as CaseCard[]).map(
      async (card) => [card, (await getSetting(LABEL_PREFIX + card))?.trim() || CASE_CARDS[card]] as const
    )
  );
  return Object.fromEntries(entries) as Record<CaseCard, string>;
});

export async function setCaseCardLabel(card: CaseCard, label: string) {
  await setSetting(LABEL_PREFIX + card, label);
}
