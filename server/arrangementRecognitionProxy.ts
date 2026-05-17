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
  existingCandidates?: unknown;
  globalMatching?: unknown;
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
    "eventFingerprint",
    "matchedCandidateId",
    "globalMergeConfidence",
    "relatedMessageIds",
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
    eventFingerprint: { type: "string" },
    matchedCandidateId: { type: "string" },
    globalMergeConfidence: { type: "number", minimum: 0, maximum: 1 },
    relatedMessageIds: { type: "array", items: { type: "string" } },
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

function getExistingCandidatesContext(value: unknown) {
  if (!Array.isArray(value)) return "";

  const candidates = value
    .slice(0, 12)
    .map((candidate) => {
      if (!candidate || typeof candidate !== "object") return null;
      const item = candidate as Record<string, unknown>;
      const id = normalizeText(item.id);
      const title = normalizeText(item.title);
      if (!id || !title) return null;

      return {
        id,
        title,
        timeDraft: item.timeDraft ?? null,
        location: normalizeText(item.location),
        people: Array.isArray(item.people) ? item.people.map(normalizeText).filter(Boolean) : [],
        note: normalizeText(item.note),
        eventFingerprint: normalizeText(item.eventFingerprint),
        semanticKey: normalizeText(item.semanticKey),
        sourceTitles: Array.isArray(item.sourceTitles)
          ? item.sourceTitles.map(normalizeText).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean);

  return candidates.length > 0 ? JSON.stringify(candidates) : "";
}

function getSystemPrompt(languageName: string) {
  return [
    "You are an arrangement-recognition and autofill assistant for a mobile demo.",
    "Decide whether the message/context contains a concrete arrangement. Extract what the user needs to do, when, where, and with whom.",
    "The title must be an actionable arrangement summary, not just a short confirmation reply.",
    "location and people must only use information present in the provided text/context. Do not invent missing people, places, or times.",
    `note must be exactly one natural sentence in ${languageName}. It must cover when, who asked the user to do what, and what the user replied if a reply exists.`,
    "Do not put source labels, reasons, confidence, internal field names, context labels, bullet lists, or words like Source, Confirmation reply, sourceRef, draft, or context in note.",
    "For global matching, compare with existing candidates. If this is the same arrangement across chats, set matchedCandidateId to that candidate id and set globalMergeConfidence from 0 to 1.",
    "Only match across chats when confidence is high and the time/place/people/action describe the same event. Similar but different events must not match.",
    "Return eventFingerprint as a short stable key from date/time/place/people/action when enough information exists, otherwise return an empty string.",
    "Return timeDraft as the fixed object shape. Use kind none and empty fields when time is missing; use weekday -1 when no weekday applies.",
  ].join("\n");
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
    const existingCandidatesContext = getExistingCandidatesContext(
      requestBody.existingCandidates
    );
    const globalMatching = requestBody.globalMatching !== false;

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
            content: getSystemPrompt(languageName),
          },
          {
            role: "user",
            content: [
              typeof requestBody.sourceContext === "string" ? requestBody.sourceContext : "",
              `sourceType: ${sourceDraft.sourceType}`,
              `sourceTitle: ${sourceDraft.sourceRefTitle}`,
              sourceDraft.conversationId ? `conversationId: ${sourceDraft.conversationId}` : "",
              sourceDraft.messageId ? `messageId: ${sourceDraft.messageId}` : "",
              `originalMessage: ${sourceDraft.excerpt}`,
              `localCandidateTitle: ${sourceDraft.title}`,
              sourceDraft.timeDraft ? `localTimeDraft: ${JSON.stringify(sourceDraft.timeDraft)}` : "",
              sourceDraft.note ? `localContextNote: ${sourceDraft.note}` : "",
              existingCandidatesContext
                ? `existingGlobalCandidates: ${existingCandidatesContext}`
                : "",
              `globalMatchingEnabled: ${globalMatching ? "true" : "false"}`,
              "Return the JSON schema fields only.",
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
