import React from "react";

export const aiApiSettingsStorageKey = "arkme-demo.aiApiSettings";
export const aiApiSettingsStorageEvent = "arkme-demo:ai-api-settings-updated";

export type AiApiSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export const defaultAiApiSettings: AiApiSettings = {
  enabled: true,
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeAiApiSettings(value: unknown): AiApiSettings {
  if (!value || typeof value !== "object") return defaultAiApiSettings;

  const settings = value as Partial<AiApiSettings>;
  return {
    enabled:
      typeof settings.enabled === "boolean"
        ? settings.enabled
        : defaultAiApiSettings.enabled,
    baseUrl: normalizeText(settings.baseUrl) || defaultAiApiSettings.baseUrl,
    apiKey: normalizeText(settings.apiKey),
    model: normalizeText(settings.model) || defaultAiApiSettings.model,
  };
}

export function getAiApiSettings(): AiApiSettings {
  if (typeof window === "undefined") return defaultAiApiSettings;

  try {
    return normalizeAiApiSettings(
      JSON.parse(window.localStorage.getItem(aiApiSettingsStorageKey) || "null")
    );
  } catch {
    return defaultAiApiSettings;
  }
}

export function persistAiApiSettings(settings: AiApiSettings) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    aiApiSettingsStorageKey,
    JSON.stringify(normalizeAiApiSettings(settings))
  );
  window.dispatchEvent(new Event(aiApiSettingsStorageEvent));
}

export function isAiApiConfigured(settings = getAiApiSettings()) {
  return Boolean(
    settings.enabled &&
      settings.baseUrl.trim() &&
      settings.apiKey.trim() &&
      settings.model.trim()
  );
}

export function useAiApiSettings() {
  const [settings, setSettings] = React.useState(getAiApiSettings);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshSettings = () => setSettings(getAiApiSettings());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === aiApiSettingsStorageKey) {
        refreshSettings();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(aiApiSettingsStorageEvent, refreshSettings);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(aiApiSettingsStorageEvent, refreshSettings);
    };
  }, []);

  return settings;
}
