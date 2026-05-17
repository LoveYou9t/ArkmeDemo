import {
  getAiApiSettings,
  isAiApiConfigured,
  type AiApiSettings,
} from "@/data/aiApiSettings";
import type {
  ArrangementSourceDraft,
  ArrangementTimeDraft,
  ArrangementTimePart,
} from "@/data/arrangements";

export type AiArrangementRecognitionResult = {
  hasArrangement: boolean;
  title: string;
  timeDraft?: ArrangementTimeDraft;
  location?: string;
  people?: string[];
  note?: string;
  confidence?: number;
  reason?: string;
};

type ArrangementRecognitionProxyResponse =
  | {
      ok: true;
      result: unknown;
      targetEndpoint?: string;
    }
  | {
      ok: false;
      error: string;
      status?: number;
      bodySnippet?: string;
      targetEndpoint?: string;
    };

export type AiRecognitionErrorCode =
  | "unconfigured"
  | "network"
  | "http"
  | "parse"
  | "empty-output";

export class AiRecognitionError extends Error {
  code: AiRecognitionErrorCode;
  endpoint?: string;
  targetEndpoint?: string;
  status?: number;
  bodySnippet?: string;

  constructor(
    message: string,
    options: {
      code: AiRecognitionErrorCode;
      endpoint?: string;
      targetEndpoint?: string;
      status?: number;
      bodySnippet?: string;
    }
  ) {
    super(message);
    this.name = "AiRecognitionError";
    this.code = options.code;
    this.endpoint = options.endpoint;
    this.targetEndpoint = options.targetEndpoint;
    this.status = options.status;
    this.bodySnippet = options.bodySnippet;
  }
}

function normalizeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizePeople(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeText(item, 24))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeTimePart(value: unknown): ArrangementTimePart | undefined {
  return value === "morning" || value === "afternoon" || value === "evening"
    ? value
    : undefined;
}

function normalizeClock(value: unknown) {
  if (typeof value !== "string") return undefined;
  const clock = value.trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(clock) ? clock : undefined;
}

function normalizeTimeDraft(value: unknown): ArrangementTimeDraft | undefined {
  if (!value || typeof value !== "object") return undefined;

  const draft = value as {
    kind?: unknown;
    day?: unknown;
    weekday?: unknown;
    date?: unknown;
    part?: unknown;
    clock?: unknown;
  };
  const part = normalizeTimePart(draft.part);
  const clock = normalizeClock(draft.clock);

  if (draft.kind === "none") return undefined;

  if (draft.kind === "relativeDay" && (draft.day === "today" || draft.day === "tomorrow")) {
    return {
      kind: "relativeDay",
      day: draft.day,
      ...(part ? { part } : {}),
      ...(clock ? { clock } : {}),
    };
  }

  if (
    draft.kind === "weekday" &&
    typeof draft.weekday === "number" &&
    Number.isInteger(draft.weekday) &&
    draft.weekday >= 0 &&
    draft.weekday <= 6
  ) {
    return {
      kind: "weekday",
      weekday: draft.weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      ...(part ? { part } : {}),
      ...(clock ? { clock } : {}),
    };
  }

  if (draft.kind === "date") {
    const date = normalizeText(draft.date, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return { kind: "date", date, ...(part ? { part } : {}), ...(clock ? { clock } : {}) };
    }
  }

  return undefined;
}

function normalizeResult(value: unknown): AiArrangementRecognitionResult {
  if (!value || typeof value !== "object") {
    throw new AiRecognitionError("AI 返回格式无效", { code: "parse" });
  }

  const result = value as Partial<AiArrangementRecognitionResult>;
  const hasArrangement = result.hasArrangement === true;
  const title = normalizeText(result.title, 60);
  if (hasArrangement && !title) {
    throw new AiRecognitionError("AI 未返回安排内容", { code: "parse" });
  }

  return {
    hasArrangement,
    title: hasArrangement ? title : "",
    timeDraft: normalizeTimeDraft(result.timeDraft),
    location: normalizeText(result.location, 40),
    people: normalizePeople(result.people),
    note: normalizeText(result.note, 240),
    confidence:
      typeof result.confidence === "number" && Number.isFinite(result.confidence)
        ? Math.min(1, Math.max(0, result.confidence))
        : undefined,
    reason: normalizeText(result.reason, 160),
  };
}

export function getResponsesEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  return normalizedBaseUrl.endsWith("/responses")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/responses`;
}

const arrangementRecognitionProxyEndpoint = "/api/arrangement-recognition";

export function getAiRecognitionConnectionSnapshot(settings: AiApiSettings) {
  const apiKey = settings.apiKey.trim();
  const baseUrl = settings.baseUrl.trim();
  return {
    enabled: settings.enabled,
    configured: isAiApiConfigured(settings),
    hasApiKey: Boolean(apiKey),
    apiKeyTail: apiKey ? apiKey.slice(-4) : undefined,
    baseUrl,
    endpoint: arrangementRecognitionProxyEndpoint,
    targetEndpoint: baseUrl ? getResponsesEndpoint(baseUrl) : undefined,
    model: settings.model.trim(),
  };
}

function getSourceContext(sourceDraft: ArrangementSourceDraft) {
  return [
    `当前日期：${new Date().toLocaleDateString("zh-CN")}`,
    `来源类型：${sourceDraft.sourceType}`,
    `来源标题：${sourceDraft.sourceRef.title}`,
    sourceDraft.sourceRef.conversationId
      ? `会话 ID：${sourceDraft.sourceRef.conversationId}`
      : "",
    `原始消息：${sourceDraft.sourceRef.excerpt}`,
    `本地候选标题：${sourceDraft.title}`,
    sourceDraft.timeDraft
      ? `本地时间草稿：${JSON.stringify(sourceDraft.timeDraft)}`
      : "",
    sourceDraft.note ? `上下文备注：${sourceDraft.note}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function recognizeArrangementCandidate(
  sourceDraft: ArrangementSourceDraft,
  options: { locale?: string; languageName?: string } = {}
): Promise<AiArrangementRecognitionResult> {
  const settings = getAiApiSettings();
  const endpoint = arrangementRecognitionProxyEndpoint;
  const targetEndpoint = getResponsesEndpoint(settings.baseUrl);
  if (!isAiApiConfigured(settings)) {
    throw new AiRecognitionError("请先在设置中启用 AI 识别并补全 API 配置", {
      code: "unconfigured",
      endpoint,
      targetEndpoint,
    });
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceDraft,
        sourceContext: getSourceContext(sourceDraft),
        baseUrl: settings.baseUrl.trim(),
        apiKey: settings.apiKey.trim(),
        model: settings.model.trim(),
        locale: options.locale,
        languageName: options.languageName,
      }),
    });
  } catch (error) {
    throw new AiRecognitionError(
      error instanceof TypeError
        ? "AI 代理连接失败：浏览器无法访问同源代理，请确认本地开发服务正在运行"
        : "AI 代理连接失败，请检查本地开发服务状态",
      {
        code: "network",
        endpoint,
        targetEndpoint,
        bodySnippet: error instanceof Error ? error.message : undefined,
      }
    );
  }

  try {
    const data = (await response.json()) as ArrangementRecognitionProxyResponse;
    if (!response.ok || !data.ok) {
      throw new AiRecognitionError(data.ok ? "AI 代理请求失败" : data.error, {
        code: "http",
        endpoint,
        targetEndpoint: data.targetEndpoint ?? targetEndpoint,
        status: data.ok ? response.status : (data.status ?? response.status),
        bodySnippet: data.ok ? undefined : data.bodySnippet,
      });
    }

    return normalizeResult(data.result);
  } catch (error) {
    if (error instanceof AiRecognitionError) {
      error.endpoint = error.endpoint ?? endpoint;
      error.targetEndpoint = error.targetEndpoint ?? targetEndpoint;
      throw error;
    }

    throw new AiRecognitionError("AI 代理返回内容解析失败", {
      code: "parse",
      endpoint,
      targetEndpoint,
      bodySnippet: error instanceof Error ? error.message : undefined,
    });
  }
}
