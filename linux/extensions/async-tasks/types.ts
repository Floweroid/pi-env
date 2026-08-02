/**
 * Async Tasks — shared types
 */

import type { ChildProcess } from "node:child_process";

export interface TaskInfo {
  id: string;
  command: string;
  cwd: string;
  status: "running" | "done" | "failed" | "killed";
  child?: ChildProcess;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  createdAt: number;
  finishedAt: number | null;
  resultInjected: boolean;
}
