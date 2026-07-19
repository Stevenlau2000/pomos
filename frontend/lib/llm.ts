// lib/llm.ts
// 云端 LLM 接入（OpenAI 兼容 /chat/completions）。唯一联网出口。
// 默认混元兼容端点 https://api.hunyuan.cloud.tencent.com/v1，支持任意 OpenAI 兼容 base_url。
// 降级触发（共享约定 §7）：!isConfigured() / navigator.onLine===false / fetch 非 2xx /
// 超时（AbortController 8s）/ 抛错 → 调用方立即回退离线引擎（offlineGen / generateLectureOffline）。
import { loadLlmKeyPlain, loadSettings } from "./studentStore";

export interface LlmOpts {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamHandlers {
  onDelta?: (text: string) => void;
  onError?: (detail: string) => void;
  onDone?: () => void;
}

const DEFAULT_BASE = "https://api.hunyuan.cloud.tencent.com/v1";
const DEFAULT_MODEL = "hunyuan-pro";
const TIMEOUT_MS = 8000; // 8s 超时（架构 §7）

/** 是否已配置可用的密钥（不抛错，纯判空）。 */
export async function isConfigured(): Promise<boolean> {
  try {
    const key = await loadLlmKeyPlain();
    return !!key && key.trim().length > 0;
  } catch {
    return false;
  }
}

/** 从学生隔离层读取配置（密钥解密）。未配置返回 null。 */
export async function getLlmConfig(): Promise<LlmOpts | null> {
  try {
    const s = await loadSettings();
    const key = await loadLlmKeyPlain();
    if (!key || !key.trim()) return null;
    return {
      baseUrl: s.llm_base_url?.trim() || DEFAULT_BASE,
      apiKey: key.trim(),
      model: s.llm_model?.trim() || DEFAULT_MODEL,
      temperature: typeof s.llm_temperature === "number" ? s.llm_temperature : 0.7,
      maxTokens: typeof s.llm_max_tokens === "number" ? s.llm_max_tokens : 1200,
    };
  } catch {
    return null;
  }
}

/**
 * 非流式单次补全。失败时抛错，由调用方降级。
 * 超时 / 非 2xx / 网络错误均抛出，便于 streamChat / lecture 统一 catch。
 */
export async function chatCompletion(
  messages: { role: string; content: string }[],
  opts: LlmOpts,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw new Error("当前离线，无法调用云端 LLM");
    }
    const res = await fetch(`${opts.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model: opts.model,
        messages,
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 1200,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`LLM 返回 ${res.status}`);
    }
    const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return j.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 流式补全（OpenAI SSE 格式）：逐块回调 onDelta。
 * 在 signal 取消 / 超时 / 非 2xx / 抛错时通过 onError 通知，不向上抛（保持 StreamHandlers 契约不变）。
 */
export async function streamCompletion(
  messages: { role: string; content: string }[],
  handlers: StreamHandlers,
  signal?: AbortSignal,
  opts?: LlmOpts,
): Promise<void> {
  const cfg = opts ?? (await getLlmConfig());
  if (!cfg) {
    handlers.onError?.("未配置 LLM（请在设置中填写密钥）");
    return;
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      handlers.onError?.("当前离线，已回退本地生成");
      return;
    }
    const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: cfg.temperature ?? 0.7,
        max_tokens: cfg.maxTokens ?? 1200,
        stream: true,
      }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) {
      handlers.onError?.(`LLM 返回 ${res.status}，已回退本地生成`);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) !== -1) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          handlers.onDone?.();
          return;
        }
        let j: { choices?: { delta?: { content?: string } }[] };
        try {
          j = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
        } catch {
          continue;
        }
        const delta = j.choices?.[0]?.delta?.content;
        if (delta) handlers.onDelta?.(delta);
      }
    }
    handlers.onDone?.();
  } catch (e) {
    handlers.onError?.(String(e instanceof Error ? e.message : e));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
