export interface SubtaskSuggester {
  suggest(input: { title: string; description: string | null }): Promise<string[]>;
}
