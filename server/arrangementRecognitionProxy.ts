import type { IncomingMessage, ServerResponse } from "node:http";

type ArrangementRecognitionRequest = {
  sourceDraft?: {
    title?: unknown;
    note?: unknown;
    timeDraft?: unknown;
    sourceType?: unknown;
    sourceRef?: {
      title?: unknown;
      excerpt?: unknown;
      conversationId?: unknown;
      messageId?: unknown;
    };
  };
  sourceContext?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
  model?: unknown;
  locale?: unknown;
  languageName?: unknown;
};

type ResponsesApiOutput = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const arrangementRecognitionSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "hasArrangement",
    "title",
    "timeDraft",
    "location",
    "people",
    "note",
    "confidence",
    "reason",
  ],
  properties: {
    hasArrangement: { type: "boolean" },
    title: { type: "string" },
    timeDraft: {
      type: "object",
      additionalProperties: false,
      required: ["kind", "day", "weekday", "date", "part", "clock"],
      properties: {
        kind: { enum: ["none", "relativeDay", "weekday", "date"] },
        day: { enum: ["", "today", "tomorrow"] },
        weekday: { type: "number", minimum: -1, maximum: 6 },
        date: { type: "string" },
        part: { enum: ["", "morning", "afternoon", "evening"] },
        clock: { type: "string" },
      },
    },
    location: { type: "string" },
    people: { type: "array", items: { type: "string" } },
    note: { type: "string" },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" },
  },
};

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getLanguageName(value: unknown, locale: unknown) {
  const languageName = normalizeText(value);
  if (languageName) return languageName;

  const localeText = normalizeText(locale).toLowerCase();
  if (localeText.startsWith("zh-tw")) return "Traditional Chinese";
  if (localeText.startsWith("zh")) return "Simplified Chinese";
  if (localeText.startsWith("ar")) return "Arabic";
  return "English";
}

function getResponsesEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  return normalizedBaseUrl.endsWith("/responses")
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/responses`;
}

function extractOutputText(value: ResponsesApiOutput) {
  if (typeof value.output_text === "string") return value.output_text;

  return (
    value.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .find((text): text is string => Boolean(text)) ?? ""
  );
}

function getSourceDraft(requestBody: ArrangementRecognitionRequest) {
  const sourceDraft = requestBody.sourceDraft;
  if (!sourceDraft || typeof sourceDraft !== "object") {
    throw new Error("Missing sourceDraft.");
  }

  const title = normalizeText(sourceDraft.title);
  const sourceRefTitle = normalizeText(sourceDraft.sourceRef?.title);
  const excerpt = normalizeText(sourceDraft.sourceRef?.excerpt);
  if (!title || !excerpt) {
    throw new Error("sourceDraft is missing required content.");
  }

  return {
    title,
    note: normalizeText(sourceDraft.note),
    timeDraft: sourceDraft.timeDraft,
    sourceType: normalizeText(sourceDraft.sourceType) || "manual",
    sourceRefTitle,
    conversationId: normalizeText(sourceDraft.sourceRef?.conversationId),
    messageId: normalizeText(sourceDraft.sourceRef?.messageId),
    excerpt,
  };
}

export async function arrangementRecognitionProxy(
  request: IncomingMessage,
  response: ServerResponse
) {
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, error: "Only POST is supported." });
    return;
  }

  try {
    const requestBody = JSON.parse(await readRequestBody(request)) as ArrangementRecognitionRequest;
    const sourceDraft = getSourceDraft(requestBody);
    const baseUrl =
      normalizeText(requestBody.baseUrl) ||
      normalizeText(process.env.OPENAI_BASE_URL) ||
      "https://api.openai.com/v1";
    const apiKey = normalizeText(requestBody.apiKey) || normalizeText(process.env.OPENAI_API_KEY);
    const model =
      normalizeText(requestBody.model) || normalizeText(process.env.OPENAI_MODEL) || "gpt-4.1-mini";
    const languageName = getLanguageName(requestBody.languageName, requestBody.locale);
    const targetEndpoint = getResponsesEndpoint(baseUrl);

    if (!apiKey) {
      sendJson(response, 500, {
        ok: false,
        error: "AI proxy is missing API Key.",
        targetEndpoint,
      });
      return;
    }

    const openAiResponse = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              `你是即我 Demo 的安排自动填充助手。请根据同一会话上下文判断是否有明确安排，并提取谁、什么时间、在哪里、做什么和备注。title 要总结成可执行安排，不要只复述短确认回复。timeDraft 必须返回固定对象；kind 可为 none、relativeDay、weekday、date；无值字段用空字符串，weekday 无值用 -1。part 使用 morning/afternoon/evening 或空字符串；clock 使用 HH:mm 或空字符串。location 和 people 只能从原文或上下文中提取，缺失时返回空字符串或空数组。note 必须使用 ${languageName}，且只能是一句话，结构必须覆盖“什么时候、谁要用户做什么、用户回复了什么”。不要在 note 中写来源、理由、可信度、内部字段、上下文标签或多条清单，也不要输出 Source、Confirmation reply、sourceRef、draft、context 等内部术语。不要替用户创建正式安排，不要编造文本中没有的人名、地点或时间。`,
          },
          {
            role: "user",
            content: [
              typeof requestBody.sourceContext === "string"
                ? requestBody.sourceContext
                : "",
              `来源类型：${sourceDraft.sourceType}`,
              `来源标题：${sourceDraft.sourceRefTitle}`,
              sourceDraft.conversationId ? `会话 ID：${sourceDraft.conversationId}` : "",
              sourceDraft.messageId ? `消息 ID：${sourceDraft.messageId}` : "",
              `原始消息：${sourceDraft.excerpt}`,
              `本地候选标题：${sourceDraft.title}`,
              sourceDraft.timeDraft
                ? `本地时间草稿：${JSON.stringify(sourceDraft.timeDraft)}`
                : "",
              sourceDraft.note ? `上下文备注：${sourceDraft.note}` : "",
              `请输出候选安排。优先填充 title、timeDraft、location、people、note。note 使用 ${languageName}，只写一句自然语言摘要：什么时候，谁要用户做什么，用户回复什么。若上下文不足以判断为安排，返回 hasArrangement=false。`,
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "arrangement_recognition",
            strict: true,
            schema: arrangementRecognitionSchema,
          },
        },
      }),
    });

    if (!openAiResponse.ok) {
      const bodySnippet = (await openAiResponse.text()).trim().slice(0, 500);
      sendJson(response, 502, {
        ok: false,
        error: `AI proxy request failed: ${openAiResponse.status}`,
        status: openAiResponse.status,
        bodySnippet,
        targetEndpoint,
      });
      return;
    }

    const data = (await openAiResponse.json()) as ResponsesApiOutput;
    const outputText = extractOutputText(data);
    if (!outputText) {
      sendJson(response, 502, {
        ok: false,
        error: "AI returned no recognition result.",
        targetEndpoint,
      });
      return;
    }

    sendJson(response, 200, { ok: true, result: JSON.parse(outputText), targetEndpoint });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      error: error instanceof Error ? error.message : "Invalid AI recognition request.",
    });
  }
}
