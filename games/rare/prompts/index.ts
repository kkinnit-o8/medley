import type { PromptDef } from "./types";
import starter from "./starter";

/**
 * The prompt bank. To add prompts, append to one of the pack files, or add a
 * new pack file and list it here. Then run `npm run check:prompts`.
 */
export const PROMPT_BANK: PromptDef[] = [...starter];
