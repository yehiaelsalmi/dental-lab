import { cache } from "react";
import { getSetting, setSetting } from "@/lib/settings";

// AppSetting: JSON array of the status keys whose cases show the
// "Report a problem" box (set per status on the Statuses page).
export const PROBLEM_STATUSES_KEY = "status.problems";

export const problemStatuses = cache(async (): Promise<Set<string>> => {
  try {
    const parsed = JSON.parse((await getSetting(PROBLEM_STATUSES_KEY)) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
});

export async function setProblemStatus(key: string, allowed: boolean) {
  const keys = new Set(await problemStatuses());
  if (allowed) keys.add(key);
  else keys.delete(key);
  await setSetting(PROBLEM_STATUSES_KEY, JSON.stringify([...keys]));
}
