import { saveConfig } from "./configFile";
import { removeDraft } from "./draftFile";

/** UI-independent approval decisions; filesystem effects remain below. */
export function saveReviewDecision(action: "confirm" | "cancel", state: {
  busy: boolean; diskChanged: boolean; hasErrors: boolean;
}): "wait" | "cancel" | "conflict" | "invalid" | "save" {
  if (state.busy) return "wait";
  if (action === "cancel") return "cancel";
  if (state.diskChanged) return "conflict";
  return state.hasErrors ? "invalid" : "save";
}

/** A successful publication stays successful if recovery-draft cleanup fails. */
export async function saveReviewedDocument(options: Parameters<typeof saveConfig>[0] & { draftPath: string }) {
  const result = await saveConfig(options);
  try { await removeDraft(options.draftPath); }
  catch (error) { result.warnings.push(`Recovery draft cleanup failed: ${(error as Error).message}`); }
  return result;
}
