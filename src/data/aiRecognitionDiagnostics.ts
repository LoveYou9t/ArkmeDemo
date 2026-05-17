import React from "react";

export const aiRecognitionDiagnosticsStorageKey =
  "arkme-demo.aiRecognitionDiagnostics";
export const aiRecognitionDiagnosticsStorageEvent =
  "arkme-demo:ai-recognition-diagnostics-updated";

export type AiRecognitionDiagnosticStage =
  | "configured"
  | "request"
  | "success"
  | "empty"
  | "http-error"
  | "network-error"
  | "parse-error"
  | "unconfigured"
  | "fallback";

export type AiRecognitionDiagnosticAction = "single" | "quick-scan" | "auto";

export type AiRecognitionDiagnosticEntry = {
  id: string;
  timestamp: number;
  action: AiRecognitionDiagnosticAction;
  stage: AiRecognitionDiagnosticStage;
  enabled: boolean;
  configured: boolean;
  hasApiKey: boolean;
  apiKeyTail?: string;
  baseUrl?: string;
  endpoint?: string;
  targetEndpoint?: string;
  model?: string;
  durationMs?: number;
  httpStatus?: number;
  errorName?: string;
  errorMessage?: string;
  responseBodySnippet?: string;
  sourceTitle?: string;
  sourceExcerpt?: string;
  semanticKey?: string;
  conversationId?: string;
  recordUid?: string;
  resultTitle?: string;
  candidateId?: string;
  fallbackUsed?: boolean;
};

const maxDiagnosticEntries = 50;

function readEntries(): AiRecognitionDiagnosticEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(aiRecognitionDiagnosticsStorageKey) || "[]"
    );
    return Array.isArray(parsed)
      ? parsed.filter(isAiRecognitionDiagnosticEntry).slice(0, maxDiagnosticEntries)
      : [];
  } catch {
    return [];
  }
}

function isAiRecognitionDiagnosticEntry(
  value: unknown
): value is AiRecognitionDiagnosticEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<AiRecognitionDiagnosticEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.timestamp === "number" &&
    (entry.action === "single" || entry.action === "quick-scan" || entry.action === "auto") &&
    typeof entry.stage === "string"
  );
}

function truncateText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : undefined;
}

export function getAiRecognitionDiagnostics() {
  return readEntries();
}

export function appendAiRecognitionDiagnostic(
  entry: Omit<AiRecognitionDiagnosticEntry, "id" | "timestamp">
) {
  if (typeof window === "undefined") return;

  const nextEntry: AiRecognitionDiagnosticEntry = {
    ...entry,
    id: `ai-diagnostic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    baseUrl: truncateText(entry.baseUrl, 120),
    endpoint: truncateText(entry.endpoint, 160),
    targetEndpoint: truncateText(entry.targetEndpoint, 160),
    model: truncateText(entry.model, 60),
    errorName: truncateText(entry.errorName, 60),
    errorMessage: truncateText(entry.errorMessage, 220),
    responseBodySnippet: truncateText(entry.responseBodySnippet, 500),
    sourceTitle: truncateText(entry.sourceTitle, 80),
    sourceExcerpt: truncateText(entry.sourceExcerpt, 120),
    semanticKey: truncateText(entry.semanticKey, 120),
    conversationId: truncateText(entry.conversationId, 80),
    recordUid: truncateText(entry.recordUid, 80),
    resultTitle: truncateText(entry.resultTitle, 80),
    candidateId: truncateText(entry.candidateId, 120),
  };
  const entries = [nextEntry, ...readEntries()].slice(0, maxDiagnosticEntries);
  window.localStorage.setItem(
    aiRecognitionDiagnosticsStorageKey,
    JSON.stringify(entries)
  );
  window.dispatchEvent(new Event(aiRecognitionDiagnosticsStorageEvent));
}

export function clearAiRecognitionDiagnostics() {
  if (typeof window === "undefined") return;

  window.localStorage.removeItem(aiRecognitionDiagnosticsStorageKey);
  window.dispatchEvent(new Event(aiRecognitionDiagnosticsStorageEvent));
}

export function useAiRecognitionDiagnostics() {
  const [entries, setEntries] = React.useState(getAiRecognitionDiagnostics);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshEntries = () => setEntries(getAiRecognitionDiagnostics());
    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === aiRecognitionDiagnosticsStorageKey
      ) {
        refreshEntries();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(aiRecognitionDiagnosticsStorageEvent, refreshEntries);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(
        aiRecognitionDiagnosticsStorageEvent,
        refreshEntries
      );
    };
  }, []);

  return entries;
}
