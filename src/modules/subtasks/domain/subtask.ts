export const SUBTASK_TITLE_MAX = 120;

export interface Subtask {
  id: string;
  activityId: string;
  title: string;
  isDone: boolean;
  position: number;
}
