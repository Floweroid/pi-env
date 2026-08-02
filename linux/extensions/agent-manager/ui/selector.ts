/**
 * agent-manager ui/selector — 交互选择器
 *
 * /prompt 无参数时显示的 agent 列表选择界面。
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import * as store from "../core/store";

/**
 * 显示 agent 选择列表。
 * 第一项始终为 "(none)" — 恢复默认。
 * 当前 agent 标记为 "(active)"。
 * 返回选中的 agent name（或 null → 取消）。
 */
export async function showAgentSelector(
  ctx: ExtensionContext,
  currentName: string | null,
): Promise<string | null> {
  const agents = store.getAllAgents();

  // 构建选择项："(none)" 第一，然后是 agent 列表
  const names = ["(none)", ...agents.map((a) => a.name)];

  // 标记当前活跃
  const displayItems = names.map((name) => {
    if (name === currentName) return `${name} (active)`;
    if (name !== "(none)") {
      const agent = store.getAgent(name);
      if (agent?.description) return `${name} — ${agent.description}`;
    }
    return name;
  });

  const choice = await ctx.ui.select("Select Agent Mode", displayItems);
  if (!choice) return null;

  // 提取纯 agent name（去掉 "(active)" 和 " — description" 后缀）
  const cleanName = choice
    .replace(/\s*\(active\)$/, "")
    .replace(/\s*—\s*.*$/, "")
    .trim();

  return cleanName;
}
