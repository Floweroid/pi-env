/**
 * Planning Plugin — Overlay 生命周期管理
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { Task, SectionKey } from "../types";
import { renderOverlay } from "./widget";

export interface OverlayStore {
  getTasks(): Task[];
  getCollapsed(): Set<SectionKey>;
}

/** 创建右上角 overlay 卡片，返回句柄（fire-and-forget） */
export function createOverlay(
  ctx: ExtensionContext,
  store: OverlayStore,
): { handle: any } {
  let handle: any = null;

  const p = ctx.ui.custom<never>(
    (_tui, theme, _kb, _done) => ({
      render: (width: number) =>
        renderOverlay({
          tasks: store.getTasks(),
          collapsedSections: store.getCollapsed(),
          theme,
          maxWidth: width,
          boxWidth: width,
        }),
      invalidate: () => {},
    }),
    {
      overlay: true,
      overlayOptions: {
        anchor: "top-right",
        width: 50,
        maxHeight: "50%",
        margin: 0,
      },
      onHandle: (h) => {
        handle = h;
        h.unfocus?.();
      },
    },
  );
  p.catch(() => {});

  return { handle };
}

/** 触发 overlay 重绘 */
export function refreshOverlay(handle: any): void {
  handle?.requestRender?.();
}

/** 销毁 overlay */
export function destroyOverlay(handle: any): void {
  handle?.hide?.();
}
