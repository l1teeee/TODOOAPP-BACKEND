export interface BackgroundJob {
  name: string;
  intervalMs: number;
  run(): Promise<void>;
}
