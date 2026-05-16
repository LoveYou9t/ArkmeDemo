import type {
  ArrangementAiCapability,
  ArrangementItem,
  ArrangementSourceRef,
  ArrangementSourceType,
  ArrangementStatus,
  ArrangementTimeKind,
} from "@/types/arrangement";

export const arrangementsStorageKey = "arkme-demo.arrangements";
export const arrangementsStorageEvent = "arkme-demo:arrangements-updated";

export type ManualArrangementInput = {
  title: string;
  timePreset: ArrangementTimePreset;
  location?: string;
  people?: string;
  note?: string;
};

export type ArrangementTimePreset = "none" | "today" | "tomorrow" | "weekend";

function readJsonValue(key: string): unknown {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function writeJsonValue(key: string, value: unknown) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Keep the in-memory arrangements usable if localStorage is unavailable.
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTimestamp(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeText).filter(Boolean);
}

function isArrangementStatus(value: unknown): value is ArrangementStatus {
  return value === "active" || value === "done" || value === "later" || value === "archived";
}

function isArrangementTimeKind(value: unknown): value is ArrangementTimeKind {
  return (
    value === "none" ||
    value === "deadline" ||
    value === "timeRange" ||
    value === "reminder" ||
    value === "fuzzy"
  );
}

function isArrangementSourceType(value: unknown): value is ArrangementSourceType {
  return (
    value === "manual" ||
    value === "sendToSelf" ||
    value === "privateChat" ||
    value === "groupChat" ||
    value === "aiSuggestion"
  );
}

function isArrangementAiCapability(value: unknown): value is ArrangementAiCapability {
  return value === "userOnly" || value === "aiAssist" || value === "aiExecutable";
}

function normalizeSourceRef(value: unknown, index: number): ArrangementSourceRef | null {
  if (!value || typeof value !== "object") return null;

  const sourceRef = value as Partial<ArrangementSourceRef>;
  const title = normalizeText(sourceRef.title);
  const excerpt = normalizeText(sourceRef.excerpt);
  const type = isArrangementSourceType(sourceRef.type) ? sourceRef.type : "manual";
  if (!title && !excerpt) return null;

  return {
    id: normalizeText(sourceRef.id) || `source-${index}`,
    type,
    title: title || getSourceTypeLabel(type),
    excerpt,
    createdAt: normalizeTimestamp(sourceRef.createdAt, Date.now() + index),
    ...(normalizeText(sourceRef.conversationId)
      ? { conversationId: normalizeText(sourceRef.conversationId) }
      : {}),
    ...(normalizeText(sourceRef.messageId)
      ? { messageId: normalizeText(sourceRef.messageId) }
      : {}),
  };
}

export function normalizeArrangement(value: unknown, index: number): ArrangementItem | null {
  if (!value || typeof value !== "object") return null;

  const arrangement = value as Partial<ArrangementItem>;
  const title = normalizeText(arrangement.title);
  if (!title) return null;

  const sourceType = isArrangementSourceType(arrangement.sourceType)
    ? arrangement.sourceType
    : "manual";
  const status = isArrangementStatus(arrangement.status) ? arrangement.status : "active";
  const timeKind = isArrangementTimeKind(arrangement.timeKind)
    ? arrangement.timeKind
    : "none";
  const aiCapability = isArrangementAiCapability(arrangement.aiCapability)
    ? arrangement.aiCapability
    : "userOnly";
  const sourceRefs = Array.isArray(arrangement.sourceRefs)
    ? arrangement.sourceRefs
        .map(normalizeSourceRef)
        .filter((sourceRef): sourceRef is ArrangementSourceRef => Boolean(sourceRef))
    : [];

  return {
    id: normalizeText(arrangement.id) || `arrangement-${index}`,
    title,
    ...(normalizeText(arrangement.note) ? { note: normalizeText(arrangement.note) } : {}),
    status,
    timeKind,
    ...(typeof arrangement.startAt === "number" && Number.isFinite(arrangement.startAt)
      ? { startAt: arrangement.startAt }
      : {}),
    ...(typeof arrangement.endAt === "number" && Number.isFinite(arrangement.endAt)
      ? { endAt: arrangement.endAt }
      : {}),
    ...(normalizeText(arrangement.fuzzyTimeLabel)
      ? { fuzzyTimeLabel: normalizeText(arrangement.fuzzyTimeLabel) }
      : {}),
    ...(normalizeText(arrangement.location)
      ? { location: normalizeText(arrangement.location) }
      : {}),
    people: normalizeStringArray(arrangement.people),
    sourceType,
    sourceRefs,
    aiCapability,
    attentionScore:
      typeof arrangement.attentionScore === "number" &&
      Number.isFinite(arrangement.attentionScore)
        ? arrangement.attentionScore
        : 0,
    createdAt: normalizeTimestamp(arrangement.createdAt, Date.now() + index),
    updatedAt: normalizeTimestamp(arrangement.updatedAt, Date.now() + index),
    ...(typeof arrangement.completedAt === "number" &&
    Number.isFinite(arrangement.completedAt)
      ? { completedAt: arrangement.completedAt }
      : {}),
    ...(typeof arrangement.laterAt === "number" && Number.isFinite(arrangement.laterAt)
      ? { laterAt: arrangement.laterAt }
      : {}),
  };
}

export function getInitialArrangements() {
  const parsedValue = readJsonValue(arrangementsStorageKey);
  if (Array.isArray(parsedValue)) {
    const arrangements = parsedValue
      .map(normalizeArrangement)
      .filter((arrangement): arrangement is ArrangementItem => Boolean(arrangement));
    if (arrangements.length > 0) return arrangements;
  }

  return getDemoArrangements();
}

export function persistArrangements(arrangements: ArrangementItem[]) {
  writeJsonValue(arrangementsStorageKey, arrangements);
  notifyArrangementsChange();
}

export function notifyArrangementsChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(arrangementsStorageEvent));
}

export function createManualArrangement(input: ManualArrangementInput): ArrangementItem {
  const timestamp = Date.now();
  const timeFields = getArrangementTimeFieldsForPreset(input.timePreset, timestamp);
  const title = input.title.trim();

  return {
    id: `arrangement-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    status: "active",
    ...timeFields,
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    people: splitPeople(input.people),
    sourceType: "manual",
    sourceRefs: [
      {
        id: `manual-source-${timestamp}`,
        type: "manual",
        title: "手动创建",
        excerpt: title,
        createdAt: timestamp,
      },
    ],
    aiCapability: "userOnly",
    attentionScore: input.timePreset === "none" ? 20 : 50,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getArrangementTimeFieldsForPreset(
  preset: ArrangementTimePreset,
  now = Date.now()
): Pick<ArrangementItem, "timeKind" | "startAt" | "fuzzyTimeLabel"> {
  if (preset === "today") {
    return { timeKind: "deadline", startAt: now, fuzzyTimeLabel: "今天" };
  }

  if (preset === "tomorrow") {
    return {
      timeKind: "deadline",
      startAt: now + 24 * 60 * 60 * 1000,
      fuzzyTimeLabel: "明天",
    };
  }

  if (preset === "weekend") {
    return {
      timeKind: "fuzzy",
      startAt: getNextWeekendTime(now),
      fuzzyTimeLabel: "周末",
    };
  }

  return { timeKind: "none", fuzzyTimeLabel: "还没有时间" };
}

export function getSourceTypeLabel(type: ArrangementSourceType) {
  if (type === "privateChat") return "来自私聊";
  if (type === "groupChat") return "来自群聊";
  if (type === "sendToSelf") return "发给自己";
  if (type === "aiSuggestion") return "AI 建议";
  return "手动创建";
}

function splitPeople(value?: string) {
  if (!value) return [];
  return value
    .split(/[、,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getNextWeekendTime(now: number) {
  const date = new Date(now);
  const day = date.getDay();
  const daysUntilSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
  const nextSaturday = new Date(date);
  nextSaturday.setDate(date.getDate() + daysUntilSaturday);
  nextSaturday.setHours(10, 0, 0, 0);
  return nextSaturday.getTime();
}

function getDemoArrangements(): ArrangementItem[] {
  const now = Date.now();
  const tomorrowMorning = now + 24 * 60 * 60 * 1000;
  const dayAfterTomorrow = now + 2 * 24 * 60 * 60 * 1000;
  const weekend = getNextWeekendTime(now);

  return [
    {
      id: "demo-hospital-check",
      title: "后天去医院复查",
      note: "把家人的提醒和自己已经挂号的信息放在同一条安排里。",
      status: "active",
      timeKind: "deadline",
      startAt: dayAfterTomorrow,
      fuzzyTimeLabel: "后天",
      location: "医院",
      people: ["爸爸", "姐姐"],
      sourceType: "aiSuggestion",
      sourceRefs: [
        {
          id: "hospital-self",
          type: "sendToSelf",
          title: "发给自己",
          excerpt: "后天去一趟医院",
          createdAt: now - 1000 * 60 * 60 * 6,
        },
        {
          id: "hospital-father",
          type: "privateChat",
          title: "爸爸",
          excerpt: "一定记得去医院，知道吗？",
          createdAt: now - 1000 * 60 * 60 * 4,
        },
        {
          id: "hospital-sister",
          type: "privateChat",
          title: "姐姐",
          excerpt: "你这个身体情况怎么办的？",
          createdAt: now - 1000 * 60 * 60 * 2,
        },
      ],
      aiCapability: "userOnly",
      attentionScore: 96,
      createdAt: now - 1000 * 60 * 60 * 6,
      updatedAt: now - 1000 * 60 * 30,
    },
    {
      id: "demo-breakfast",
      title: "明天到公司帮小李带早餐",
      status: "active",
      timeKind: "fuzzy",
      startAt: tomorrowMorning,
      fuzzyTimeLabel: "明天上午",
      location: "公司",
      people: ["小李"],
      sourceType: "privateChat",
      sourceRefs: [
        {
          id: "breakfast-request",
          type: "privateChat",
          title: "小李",
          excerpt: "明天来公司帮我带个早餐",
          createdAt: now - 1000 * 60 * 50,
        },
        {
          id: "breakfast-accept",
          type: "privateChat",
          title: "我",
          excerpt: "好的",
          createdAt: now - 1000 * 60 * 48,
        },
      ],
      aiCapability: "userOnly",
      attentionScore: 82,
      createdAt: now - 1000 * 60 * 50,
      updatedAt: now - 1000 * 60 * 48,
    },
    {
      id: "demo-product-plan",
      title: "整理安排模块第一版交互",
      note: "先把页面框架、创建、完成和以后再说打磨顺。",
      status: "active",
      timeKind: "none",
      fuzzyTimeLabel: "还没有时间",
      people: [],
      sourceType: "manual",
      sourceRefs: [
        {
          id: "product-plan-manual",
          type: "manual",
          title: "手动创建",
          excerpt: "整理安排模块第一版交互",
          createdAt: now - 1000 * 60 * 30,
        },
      ],
      aiCapability: "aiAssist",
      attentionScore: 58,
      createdAt: now - 1000 * 60 * 30,
      updatedAt: now - 1000 * 60 * 30,
    },
    {
      id: "demo-swim-later",
      title: "给自己设置周末游泳提醒",
      note: "这类私人习惯或隐喻，AI 不一定能识别，所以需要手动创建入口。",
      status: "later",
      timeKind: "fuzzy",
      startAt: weekend,
      fuzzyTimeLabel: "周末",
      people: [],
      sourceType: "manual",
      sourceRefs: [
        {
          id: "swim-manual",
          type: "manual",
          title: "手动创建",
          excerpt: "～～ 对我来说是游泳",
          createdAt: now - 1000 * 60 * 20,
        },
      ],
      aiCapability: "userOnly",
      attentionScore: 24,
      createdAt: now - 1000 * 60 * 20,
      updatedAt: now - 1000 * 60 * 12,
      laterAt: now - 1000 * 60 * 12,
    },
  ];
}
