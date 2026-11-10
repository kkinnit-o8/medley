import type { PromptDef } from "./types";
import culturePlay from "./culture-play";
import foodHome from "./food-home";
import natureScience from "./nature-science";
import places from "./places";
import starter from "./starter";

/**
 * The prompt bank. To add prompts, append to one of the pack files, or add a
 * new pack file and list it here. Then run `npm run check:prompts`.
 */
export const PROMPT_BANK: PromptDef[] = [...starter, ...foodHome, ...places, ...natureScience, ...culturePlay];
