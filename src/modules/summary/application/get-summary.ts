import type { DashboardSummary, SummaryRepository } from "./ports.js";

export function getSummary(
  repository: SummaryRepository,
  userId: string,
  today: string,
): Promise<DashboardSummary> {
  return repository.get(userId, today);
}
