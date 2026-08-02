/**
 * Planning Plugin — 状态持有
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Task, SectionKey } from "./types";
import type { PlanningState } from "./types";

let tasks: Task[] = [];
let collapsedSections = new Set<SectionKey>(["done", "cancelled"]);
let twoPhaseEnabled = false;

export function getTasks(): Task[] { return tasks; }
export function setTasks(t: Task[]): void { tasks = t; }
export function getCollapsed(): Set<SectionKey> { return collapsedSections; }
export function setCollapsed(s: Set<SectionKey>): void { collapsedSections = s; }
export function getTwoPhaseEnabled(): boolean { return twoPhaseEnabled; }
export function setTwoPhaseEnabled(v: boolean): void { twoPhaseEnabled = v; }

export function persistState(pi: { appendEntry: (type: string, data: PlanningState) => void }): void {
  pi.appendEntry("planning-state", {
    tasks,
    collapsedSections: [...collapsedSections],
    twoPhaseEnabled,
  });
}

export function restoreState(ctx: ExtensionContext): void {
  const entries = ctx.sessionManager.getEntries();
  const stateEntry = entries
    .filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "planning-state")
    .pop() as { data?: PlanningState } | undefined;

  if (stateEntry?.data) {
    tasks = stateEntry.data.tasks ?? [];
    collapsedSections = new Set(stateEntry.data.collapsedSections ?? ["done", "cancelled"]);
    twoPhaseEnabled = stateEntry.data.twoPhaseEnabled ?? false;
  }
}
