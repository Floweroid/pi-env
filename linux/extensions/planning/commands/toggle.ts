/**
 * Planning Plugin — /plan toggle
 */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { SectionKey } from "../types";
import { SECTIONS } from "../types";

export interface ToggleStore {
  getCollapsed(): Set<SectionKey>;
  refreshOverlay(): void;
}

export function resolveSection(label: string): SectionKey | null {
  const s = SECTIONS.find((s) => s.label === label);
  return s ? s.key : null;
}

export function toggleSection(
  key: SectionKey,
  store: ToggleStore,
  ctx: ExtensionContext,
): void {
  const collapsed = store.getCollapsed();
  const label = SECTIONS.find((s) => s.key === key)?.label ?? key;
  if (collapsed.has(key)) {
    collapsed.delete(key);
    store.refreshOverlay();
    ctx.ui.notify(`展开「${label}」`, "info");
  } else {
    collapsed.add(key);
    store.refreshOverlay();
    ctx.ui.notify(`折叠「${label}」`, "info");
  }
}
