/**
 * Subagent UI — 入口
 *
 * 重新导出 renderCall 和 renderResult，
 * 保持与旧 render.ts 完全相同的接口。
 */

import { renderCall as _renderCall } from "./call.ts";
import { renderSingleResult } from "./single.ts";
import { renderChainResult } from "./chain.ts";
import { renderParallelResult } from "./parallel.ts";
import type { SubagentDetails } from "../types.ts";
import { truncateToWidth } from "@earendil-works/pi-tui";

export const renderCall = _renderCall;

export function renderResult(result: any, { expanded, isPartial }: any, theme: any, _context: any) {
	const details = result.details as SubagentDetails | undefined;
	const cache: { key?: string; width?: number; lines?: string[] } = {};

	return {
		invalidate() { cache.width = undefined; cache.lines = undefined; cache.key = undefined; },
		render(width: number): string[] {
			const key = JSON.stringify({ expanded, isPartial, mode: details?.mode, rlen: details?.results?.length ?? 0, states: details?.results?.map((r: any) => r.exitCode) });
			if (cache.key === key && cache.width === width && cache.lines) return cache.lines;

			let out: string[];

			if (!details?.results?.length) {
				const t = result.content[0];
				out = [truncateToWidth(t?.type === "text" ? t.text : "(no output)", width, "...")];
			} else if (details.mode === "single" && details.results.length === 1) {
				out = renderSingleResult(details.results[0], expanded, width, theme);
			} else if (details.mode === "chain") {
				out = renderChainResult(details, expanded, width, theme);
			} else if (details.mode === "parallel") {
				out = renderParallelResult(details, expanded, width, theme);
			} else {
				out = [];
			}

			cache.key = key; cache.width = width; cache.lines = out;
			return out;
		},
	};
}
