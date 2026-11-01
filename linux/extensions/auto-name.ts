/**
 * 自动命名扩展 (auto-name)
 *
 * 每 5 轮对话自动更新 session 名称。
 * 格式：[状态]主体:阶段进展[HH:MM:SS YYYY-MM-DD]
 *
 * 手动触发：/auto-name
 *
 * 状态由 AI 从四个标签选择：进行中 / 已完成 / 暂停 / 闲置。
 *
 * 模型：跟随 pi 的默认模型（settings.json 的 defaultProvider + defaultModel）；
 * 解析不到时回退到当前会话模型 ctx.model。
 * 需要固定命名专用模型时，把 PREFERRED_NAMING_MODEL 填成 `provider/modelId`。
 * 记录并展示 token 消耗。
 */

import { completeSimple } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";

// ============================================================================
// 配置
// ============================================================================

/** 每 N 轮对话触发一次自动更新 */
const NAME_UPDATE_INTERVAL = 5;

/** 提取多少条最近的消息用于生成名称 */
const RECENT_MESSAGE_COUNT = 8;

/** 命名请求的 maxTokens（默认模型可能带 reasoning，留一点冗余） */
const NAMING_MAX_TOKENS = 200;

/**
 * 命名专用模型（`provider/modelId` 写法）。
 * 置空 = 不启用，直接走 settings.json 的默认模型（解析链第 1 步）。
 * 如需固定为某个轻量模型，填回 `provider/modelId`（要求该 provider 已配置凭据）。
 */
const PREFERRED_NAMING_MODEL = "";

// ============================================================================
// 状态标签（AI 只能从中选择）
// ============================================================================

const STATUS_LABELS = ["进行中", "已完成", "暂停", "闲置"] as const;

// ============================================================================
// 提示词
// ============================================================================

const NAME_SYSTEM_PROMPT = `你是一个编程会话状态跟踪助手。根据对话内容，为当前会话生成结构化名称。

请严格按以下格式输出（一行，不要换行）：
状态|标题|进展

规则：
- 状态：从 [进行中, 已完成, 暂停, 闲置] 中选一个
  · 进行中 = 任务正在推进
  · 已完成 = 目标已达成
  · 暂停 = 等待外部条件、用户响应，暂时搁置
  · 闲置 = 长时间无实质进展，可能被放弃
- 标题：会话的核心主题，5-12 字，纯中文
- 进展：当前最新阶段或正在做的事，5-10 字，纯中文
- 只输出一行原始文本，不要加引号、句号或任何修饰`;

const NAME_USER_PROMPT = `以下是一段编程对话。请输出当前会话状态：

<conversation>
{conversation}
</conversation>

状态|标题|进展：`;

/** 当状态已手动指定时，AI 只需输出标题和进展 */
const NAME_USER_PROMPT_FORCED = `以下是一段编程对话。已知会话状态为「{status}」，请生成标题和进展：

<conversation>
{conversation}
</conversation>

标题|进展：`;

// ============================================================================
// 类型
// ============================================================================

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface NamingStats {
  consecutiveFails: number;
  accumulatedTokens: number;
  accumulatedCost: number;
  generationCount: number;
}

/** 从 pi 运行时上下文取到的模型（避免额外 import 具体类型） */
type ResolvedModel = NonNullable<ExtensionContext["model"]>;

// ============================================================================
// 辅助函数
// ============================================================================

function extractRecentMessages(entries: SessionEntry[], count: number): Message[] {
  const messages: Message[] = [];

  for (let i = entries.length - 1; i >= 0 && messages.length < count; i--) {
    const entry = entries[i];
    if (!entry || entry.type !== "message") continue;

    const msg = entry.message as { role?: string; content?: unknown };
    if (!msg || !msg.role) continue;
    if (msg.role !== "user" && msg.role !== "assistant") continue;

    const content = msg.content;
    let text = "";

    if (typeof content === "string") {
      text = content;
    } else if (Array.isArray(content)) {
      text = (content as Array<{ type?: string; text?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.text ?? "")
        .join(" ");
    }

    if (!text.trim()) continue;

    messages.unshift({
      role: msg.role as "user" | "assistant",
      text: text.trim(),
    });
  }

  return messages;
}

function formatMessagesForPrompt(messages: Message[]): string {
  return messages
    .map((m) => {
      const label = m.role === "user" ? "用户" : "助手";
      const truncated = m.text.length > 300 ? m.text.slice(0, 300) + "…" : m.text;
      return `[${label}]: ${truncated}`;
    })
    .join("\n\n");
}

function nowTimestamp(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${hh}:${mm}:${ss} ${yyyy}-${MM}-${dd}`;
}

function parseAiOutput(raw: string): { status: string; title: string; progress: string } | null {
  const parts = raw.split("|");
  if (parts.length < 3) return null;

  const status = parts[0].trim();
  const title = parts[1].trim();
  const progress = parts.slice(2).join("|").trim();

  if (!STATUS_LABELS.includes(status as typeof STATUS_LABELS[number])) return null;
  if (!title || !progress) return null;

  const clean = (s: string) =>
    s.replace(/["""'']/g, "").replace(/[。！？、；：]/g, "").trim();

  return {
    status,
    title: clean(title).slice(0, 39),
    progress: clean(progress).slice(0, 14),
  };
}

/** 解析强制指定状态时的 AI 输出 "标题|进展" */
function parseForcedOutput(raw: string, forcedStatus: string): { status: string; title: string; progress: string } | null {
  const parts = raw.split("|");
  if (parts.length < 2) return null;

  const title = parts[0].trim();
  const progress = parts.slice(1).join("|").trim();

  if (!title || !progress) return null;

  const clean = (s: string) =>
    s.replace(/["""'']/g, "").replace(/[。！？、；：]/g, "").trim();

  return {
    status: forcedStatus,
    title: clean(title).slice(0, 39),
    progress: clean(progress).slice(0, 14),
  };
}

function buildName(status: string, title: string, progress: string): string {
  return `[${status}]${title}:${progress}[${nowTimestamp()}]`;
}

// ============================================================================
// 模型解析：自动读取 pi 的默认模型
// ============================================================================

/**
 * 解析用于命名的模型，优先级：
 *   0. 固定命名专用模型 PREFERRED_NAMING_MODEL（当前为空 = 跳过此步）
 *   1. settings.json 的 defaultProvider + defaultModel（pi 的默认模型）
 *   2. defaultModel 里写成 `provider/modelId` 的完整引用
 *   3. defaultModel 为裸 id 时，在全量模型表中唯一匹配（多义则优先有凭据的）
 *   4. 回退到当前会话模型 ctx.model
 */
function resolveNamingModel(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): { model?: ResolvedModel; description: string } {
  // 0. 命名专用模型（预留开关）：PREFERRED_NAMING_MODEL 为空时整段跳过
  if (PREFERRED_NAMING_MODEL) {
    const [prefProvider, ...prefRest] = PREFERRED_NAMING_MODEL.split("/");
    const prefId = prefRest.join("/");
    if (prefProvider && prefId) {
      const preferred = ctx.modelRegistry.find(prefProvider, prefId);
      if (preferred && ctx.modelRegistry.hasConfiguredAuth(preferred)) {
        return {
          model: preferred,
          description: `${prefProvider}/${prefId}（命名专用）`,
        };
      }
    }
  }

  const settings = pi.getSettings() as {
    defaultProvider?: string;
    defaultModel?: string;
  };

  let provider = settings.defaultProvider?.trim() || undefined;
  let modelId = settings.defaultModel?.trim() || undefined;

  // defaultModel 支持 "provider/modelId" 写法
  if (modelId && modelId.includes("/")) {
    const [p, ...rest] = modelId.split("/");
    if (p && rest.length > 0) {
      provider = p;
      modelId = rest.join("/");
    }
  }

  if (modelId) {
    if (provider) {
      const m = ctx.modelRegistry.find(provider, modelId);
      if (m) return { model: m, description: `${provider}/${modelId}` };
    }

    const matches = ctx.modelRegistry.getAll().filter((m) => m.id === modelId);
    const inProvider = provider
      ? matches.filter((m) => m.provider === provider)
      : [];
    const candidates = inProvider.length > 0 ? inProvider : matches;

    if (candidates.length === 1) {
      const c = candidates[0]!;
      return { model: c, description: `${c.provider}/${c.id}` };
    }
    if (candidates.length > 1) {
      const withAuth = candidates.find((m) => ctx.modelRegistry.hasConfiguredAuth(m));
      const c = withAuth ?? candidates[0]!;
      return { model: c, description: `${c.provider}/${c.id}` };
    }
  }

  // 回退：当前会话模型
  if (ctx.model) {
    return {
      model: ctx.model,
      description: `${ctx.model.provider}/${ctx.model.id}（会话当前模型）`,
    };
  }

  return { description: "" };
}

// ============================================================================
// AI 命名核心逻辑
// ============================================================================

async function runAiNaming(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  stats: NamingStats,
  forcedStatus?: string,
  skipContentCheck?: boolean,
): Promise<boolean> {
  const entries = ctx.sessionManager.getEntries();
  const messages = extractRecentMessages(entries, RECENT_MESSAGE_COUNT);

  if (!skipContentCheck) {
    const hasUser = messages.some((m) => m.role === "user");
    const hasAssistant = messages.some((m) => m.role === "assistant");
    if (!hasUser || !hasAssistant) {
      ctx.ui.notify("自动命名：对话内容不足", "warning");
      return false;
    }
  }

  // 模型：自动读取 pi 的默认模型
  const resolved = resolveNamingModel(pi, ctx);
  const model = resolved.model;
  if (!model) {
    ctx.ui.notify(
      "自动命名：未找到可用模型（settings.json 未配置 defaultModel，且无会话模型）",
      "error",
    );
    return false;
  }

  const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
  if (!auth.ok || !auth.apiKey) {
    ctx.ui.notify(
      `自动命名：模型 ${resolved.description} 的 API key 不可用${auth.ok ? "" : `: ${auth.error}`}`,
      "error",
    );
    return false;
  }

  const oldName = pi.getSessionName();
  const conversationText = formatMessagesForPrompt(messages);
  const prompt = forcedStatus
    ? NAME_USER_PROMPT_FORCED
        .replace("{status}", forcedStatus)
        .replace("{conversation}", conversationText)
    : NAME_USER_PROMPT.replace("{conversation}", conversationText);

  const headers: Record<string, string> = { ...(auth.headers ?? {}) };

  try {
    const response = await completeSimple(
      model,
      {
        systemPrompt: NAME_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [{ type: "text" as const, text: prompt }],
            timestamp: Date.now(),
          },
        ],
      },
      { maxTokens: NAMING_MAX_TOKENS, apiKey: auth.apiKey, headers },
    );

    if (response.stopReason === "error") {
      stats.consecutiveFails++;
      if (stats.consecutiveFails >= 3) {
        ctx.ui.notify(
          `自动命名连续失败 ${stats.consecutiveFails} 次: ${response.errorMessage || "未知错误"}`,
          "warning",
        );
      }
      return false;
    }

    // Token 统计
    const usage = response.usage;
    stats.accumulatedTokens += usage.totalTokens;
    stats.accumulatedCost += usage.cost?.total ?? 0;
    stats.generationCount++;

    const raw = response.content
      .filter((c): c is { type: "text"; text: string } => c.type === "text")
      .map((c) => c.text)
      .join("")
      .trim();

    const parsed = forcedStatus
      ? parseForcedOutput(raw, forcedStatus)
      : parseAiOutput(raw);
    if (!parsed) {
      stats.consecutiveFails++;
      if (stats.consecutiveFails >= 3) {
        ctx.ui.notify(
          `自动命名解析失败 ${stats.consecutiveFails} 次: "${raw.slice(0, 60)}"`,
          "warning",
        );
      }
      return false;
    }

    const name = buildName(parsed.status, parsed.title, parsed.progress);
    const changed = name !== oldName;

    pi.setSessionName(name);
    stats.consecutiveFails = 0;

    // 通知
    const tokenInfo = `${resolved.description} · 本次${usage.totalTokens}t · 累计${stats.accumulatedTokens}t/${stats.generationCount}次`;
    const costInfo = stats.accumulatedCost > 0 ? ` · ¥${stats.accumulatedCost.toFixed(4)}` : "";

    if (changed) {
      ctx.ui.notify(`📝 ${name}  |  ${tokenInfo}${costInfo}`, "info");
    } else {
      ctx.ui.notify(`📝 (未变化)  |  ${tokenInfo}${costInfo}`, "info");
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stats.consecutiveFails++;
    if (stats.consecutiveFails >= 3) {
      ctx.ui.notify(`自动命名异常 ${stats.consecutiveFails} 次: ${message}`, "warning");
    }
    return false;
  }
}

// ============================================================================
// 扩展入口
// ============================================================================

export default function (pi: ExtensionAPI) {
  let turnCount = 0;
  const stats: NamingStats = {
    consecutiveFails: 0,
    accumulatedTokens: 0,
    accumulatedCost: 0,
    generationCount: 0,
  };

  // ============================
  // 注册手动命令 /auto-name
  // ============================
  pi.registerCommand("auto-name", {
    description: "手动触发 AI 生成并更新 session 名称",
    getArgumentCompletions(_prefix) {
      return [
        ...STATUS_LABELS.map((s) => ({ value: s, label: s })),
      ];
    },
    async handler(args, ctx) {
      await ctx.waitForIdle();
      const arg = args.trim();

      // /auto-name <状态> — 手动指定状态
      if (arg && STATUS_LABELS.includes(arg as typeof STATUS_LABELS[number])) {
        await runAiNaming(pi, ctx, stats, arg, true);
      } else if (arg) {
        ctx.ui.notify(`无效参数: ${arg}（可用: ${STATUS_LABELS.join("/")}）`, "warning");
      } else {
        await runAiNaming(pi, ctx, stats, undefined, true);
      }
    },
  });

  // ============================
  // session 切换时重置
  // ============================
  pi.on("session_start", () => {
    turnCount = 0;
    stats.consecutiveFails = 0;
    stats.accumulatedTokens = 0;
    stats.accumulatedCost = 0;
    stats.generationCount = 0;
  });

  // ============================
  // 自动触发：每 N 轮
  // ============================
  pi.on("turn_end", async (_event, ctx) => {
    turnCount++;

    if (turnCount % NAME_UPDATE_INTERVAL !== 0) return;

    // ---- AI 命名 ----
    await runAiNaming(pi, ctx, stats);


  });
}
