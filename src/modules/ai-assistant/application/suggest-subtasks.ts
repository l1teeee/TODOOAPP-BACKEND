import type { SubtaskSuggester } from "./ports.js";

export function suggestSubtasks(
  suggester: SubtaskSuggester,
  input: { title: string; description: string | null },
): Promise<string[]> {
  return suggester.suggest(input);
}
