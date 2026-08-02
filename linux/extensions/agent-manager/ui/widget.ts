/**
 * agent-manager ui/widget — 状态栏组件
 *
 * 管理 TUI 右上角的 [Agent: ops] 状态指示器。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { WIDGET_ID } from "../core/types";

/** 更新 widget 显示 */
export function updateWidget(ctx: ExtensionContext, name: string | null): void {
  const theme = ctx.ui.theme;

  if (!name) {
    ctx.ui.setWidget(WIDGET_ID, [theme.fg("dim", "[Agent: none]")]);
  } else {
    ctx.ui.setWidget(WIDGET_ID, [theme.fg("accent", `[Agent: ${name}]`)]);
  }
}

/** 清除 widget（session_shutdown 时调用） */
export function clearWidget(ctx: ExtensionContext): void {
  ctx.ui.setWidget(WIDGET_ID, undefined);
}
