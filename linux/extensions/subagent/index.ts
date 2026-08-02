/**
 * Subagent — 入口
 *
 * 为每个子代理调用启动独立 `pi` 进程，
 * 拥有隔离的上下文窗口。所有模式均为异步（发起即返回，
 * 结果自动注入）；chain 为顺序执行。
 *
 * 工具注册在 tools.ts，UI 渲染在 ui/，执行逻辑在 handlers/。
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerTools } from "./tools.ts";

export default function (pi: ExtensionAPI) {
	let sessionUi: ExtensionContext["ui"] | null = null;
	let sessionCwd: string | null = null;

	pi.on("session_start", async (_event, ctx) => {
		sessionUi = ctx.ui;
		sessionCwd = ctx.cwd;
	});

	registerTools(pi, () => ({ sessionUi, sessionCwd }));
}
