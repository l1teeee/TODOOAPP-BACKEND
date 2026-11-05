export interface SubtaskSuggester {
  suggest(input: { title: string; description: string | null }): Promise<string[]>;
}

export interface DailyBriefInput {
  firstName: string | null;
  localTime: string;
  locale: string;
  items: readonly {
    kind: "habit" | "reminder" | "task";
    title: string;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    status: "todo" | "in_progress" | "completed";
  }[];
}

export interface DailyBriefWriter {
  write(input: DailyBriefInput): Promise<string>;
}
