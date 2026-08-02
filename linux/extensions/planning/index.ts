/**
 * Planning Plugin — 入口
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerPlanTasksTool } from "./tools";
import { registerPlanCommand, registerPlanstageCommand } from "./commands";
import { registerTwoPhaseSync } from "./sync";
import { registerToolGate } from "./sync/gate";
import { isPlanPhase } from "./sync";
import { registerAutoSync } from "./sync/auto-sync";
import { getTasks, setTasks, getCollapsed, setCollapsed, getTwoPhaseEnabled, setTwoPhaseEnabled, persistState, restoreState } from "./store";
import { renderOverlay } from "./core/widget";
import { createOverlay } from "./core/overlay";
import { refreshOverlay } from "./core/overlay";
import { formatPlanContext } from "./core/format";
import type { PlanContext } from "./core/widget";
import type { SectionKey } from "./types";

export default function (pi: ExtensionAPI) {
  let overlay: { refresh: (content: string[]) => void; destroy: () => void } | null = null;

  function refreshUI(ctx: ExtensionContext): void {
    if (!ctx?.ui) return;
    const tasks = getTasks();
    const theme = ctx.ui.theme;
    if (!theme) return;
    if (overlay) {
      const containerWidth = (ctx.ui as any).columns ?? 80;
      const content = renderOverlay({ tasks, collapsedSections: getCollapsed(), theme, maxWidth: containerWidth - 4, boxWidth: Math.min(containerWidth, 60) });
      refreshOverlay(overlay.handle);
    }
    ctx.ui.setStatus("planning", tasks.length > 0 ? `📋 ${tasks.filter(t => t.status === "completed").length}/${tasks.length}` : undefined);
  }

  function refreshOverlay(): void { if (!overlay) return; refreshUI({ ui: (overlay as any)?.ctx?.ui } as any); }

  pi.on("session_start", async (_event, ctx) => {
    restoreState(ctx);
    if (ctx.hasUI) {
      overlay = createOverlay(ctx, { getTasks, getCollapsed });
      refreshUI(ctx);
    }
  });

  pi.on("session_shutdown", async () => {
    if (overlay) { overlay.handle?.hide?.(); overlay = null; }
  });

  pi.on("before_provider_request", async (event) => {
    const tasks = getTasks();
    if (tasks.length === 0) return;
    const context = formatPlanContext(tasks);
    if (!context) return;

    const payload = event.payload as any;
    const messages = payload.messages ?? [];
    const lastIdx = messages.length - 1;
    if (lastIdx >= 0 && messages[lastIdx]?.customType === "planning-context") {
      messages.splice(lastIdx, 1);
    }
    messages.push({
      role: "system",
      customType: "planning-context",
      content: context,
    });
    return { ...payload, messages };
  });

  pi.on("agent_end", async () => { persistState(pi); });

  registerTwoPhaseSync(pi, { getTasks, refreshUI, isTwoPhaseEnabled: getTwoPhaseEnabled });
  registerToolGate(pi, isPlanPhase);
  registerAutoSync(pi, { getTasks, refreshUI });
  registerPlanTasksTool(pi, { getTasks, setTasks, refreshUI });
  registerPlanCommand(pi, { getTasks, setTasks, getCollapsed, setCollapsed, refreshUI, refreshOverlay });
  registerPlanstageCommand(pi, { getTwoPhaseEnabled, setTwoPhaseEnabled });
}
