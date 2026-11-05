export interface DashboardSummary {
  byStatus: { todo: number; inProgress: number; completed: number };
  byKind: { habit: number; reminder: number; task: number };
  completedLast7Days: number;
  overdueReminders: number;
}

export interface SummaryRepository {
  get(userId: string, today: string): Promise<DashboardSummary>;
}
