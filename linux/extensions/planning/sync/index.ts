/**
 * Planning Plugin — 两阶段同步
 *
 * 阶段 1（计划）：注入同步指令，仅 plan_tasks 可用
 * 阶段 2（执行）：恢复用户消息，全部工具可用
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Task } from "../types";
import { SYNC_MESSAGE, EXEC_MESSAGE } from "../prompts/sync-message";

export interface SyncStore {
  getTasks(): Task[];
  refreshUI(ctx: ExtensionContext): void;
  isTwoPhaseEnabled?: () => boolean;
}

type SyncPhase = "plan" | "exec";

let phase: SyncPhase | null = null;
let savedUserContent: string = "";

export function getPhase(): SyncPhase | null {
  return phase;
}

export function isPlanPhase(): boolean {
  return phase === "plan";
}

export function registerTwoPhaseSync(
  pi: ExtensionAPI,
  store: SyncStore,
): void {
  pi.on("before_agent_start", async (_event, ctx) => {
    if (phase === "exec") return;
    if (store.getTasks().length === 0) return;
    if (store.isTwoPhaseEnabled && !store.isTwoPhaseEnabled()) return;

    phase = "plan";

    return {
      message: {
        customType: "planning-phase-plan",
        content: SYNC_MESSAGE,
        display: true,
      },
    };
  });

  pi.on("agent_settled", async (_event, ctx) => {
    if (phase === "plan") {
      // 保存用户消息
      const entries = ctx.sessionManager.getEntries();
      for (let i = entries.length - 1; i >= 0; i--) {
        const e = entries[i] as any;
        if (e.type === "message" && e.message?.role === "user") {
          const raw = e.message?.content;
          savedUserContent = typeof raw === "string" ? raw
            : Array.isArray(raw) ? raw.filter((b: any) => b.type === "text").map((b: any) => b.text).join("")
            : "";
          break;
        }
      }

      phase = "exec";
      pi.sendMessage(
        { customType: "planning-phase-exec", content: savedUserContent + "\n\n" + EXEC_MESSAGE, display: true },
        { triggerTurn: true, deliverAs: "followUp" },
      );
      return;
    }

    if (phase === "exec") {
      phase = null;
      savedUserContent = "";
      store.refreshUI(ctx);
    }
  });
}
