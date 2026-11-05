import type { DailyBriefInput, DailyBriefWriter } from "./ports.js";

export function writeDailyBrief(writer: DailyBriefWriter, input: DailyBriefInput): Promise<string> {
  return writer.write(input);
}
