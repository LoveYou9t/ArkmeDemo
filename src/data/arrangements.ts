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
export const arrangementCandidatesStorageKey = "arkme-demo.arrangementCandidates";
export const arrangementCandidatesStorageEvent =
  "arkme-demo:arrangement-candidates-updated";

export type ManualArrangementInput = {
  title: string;
  timeDraft: ArrangementTimeDraft;
  location?: string;
  people?: string;
  note?: string;
};

export type ArrangementTimePreset = "none" | "today" | "tomorrow" | "weekend";
export type ArrangementTimePart = "morning" | "afternoon" | "evening";
export type ArrangementTimeDraft =
  | { kind: "none" }
  | {
      kind: "relativeDay";
      day: "today" | "tomorrow";
      part?: ArrangementTimePart;
      clock?: string;
    }
  | {
      kind: "weekday";
      weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
      part?: ArrangementTimePart;
      clock?: string;
    }
  | {
      kind: "date";
      date: string;
      part?: ArrangementTimePart;
      clock?: string;
    };
export type ArrangementCandidateStatus = "pending" | "confirmed" | "ignored";

export type ArrangementCandidate = {
  id: string;
  title: string;
  note?: string;
  timeDraft?: ArrangementTimeDraft;
  location?: string;
  people?: string[];
  semanticKey?: string;
  eventFingerprint?: string;
  matchedCandidateId?: string;
  linkedCandidateIds?: string[];
  globalMergeConfidence?: number;
  sourceType: ArrangementSourceType;
  sourceRef: ArrangementSourceRef;
  sourceRefs?: ArrangementSourceRef[];
  status: ArrangementCandidateStatus;
  confidence?: number;
  reason?: string;
  createdBy: "validation" | "ai";
  createdAt: number;
  updatedAt: number;
};

export type ArrangementSourceDraft = {
  title: string;
  note?: string;
  timeDraft?: ArrangementTimeDraft;
  semanticKey?: string;
  eventFingerprint?: string;
  sourceType: ArrangementSourceType;
  sourceRef: ArrangementSourceRef;
  sourceRefs?: ArrangementSourceRef[];
};

export type AiArrangementCandidateDraft = {
  title: string;
  note?: string;
  timeDraft?: ArrangementTimeDraft;
  location?: string;
  people?: string[];
  eventFingerprint?: string;
  matchedCandidateId?: string;
  globalMergeConfidence?: number;
  relatedMessageIds?: string[];
  confidence?: number;
  reason?: string;
};

export type ArrangementNoteLocale = "zh-CN" | "zh-TW" | "en-US" | "ar-SA";

export type ArrangementNoteParts = {
  sourceLabel?: string;
  confirmationText?: string;
  modifierText?: string;
  arrangementText?: string;
  timeDraft?: ArrangementTimeDraft;
};

const supportedArrangementNoteLocales = ["zh-CN", "zh-TW", "en-US", "ar-SA"] as const;

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

function normalizeNumberRatio(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : undefined;
}

export function getArrangementNoteLocale(locale: string): ArrangementNoteLocale {
  const normalizedLocale = locale.trim();
  const exactLocale = supportedArrangementNoteLocales.find(
    (item) => item.toLowerCase() === normalizedLocale.toLowerCase()
  );
  if (exactLocale) return exactLocale;

  if (normalizedLocale.toLowerCase().startsWith("zh-tw")) return "zh-TW";
  if (normalizedLocale.toLowerCase().startsWith("zh")) return "zh-CN";
  if (normalizedLocale.toLowerCase().startsWith("ar")) return "ar-SA";
  return "en-US";
}

export function getArrangementNoteLanguageName(locale: string) {
  const noteLocale = getArrangementNoteLocale(locale);
  if (noteLocale === "zh-CN") return "Simplified Chinese";
  if (noteLocale === "zh-TW") return "Traditional Chinese";
  if (noteLocale === "ar-SA") return "Arabic";
  return "English";
}

export function formatArrangementCandidateNote(
  parts: ArrangementNoteParts,
  locale: string
) {
  const noteLocale = getArrangementNoteLocale(locale);
  const sourceLabel = normalizeText(parts.sourceLabel);
  const confirmationText = normalizeText(parts.confirmationText);
  const modifierText = normalizeText(parts.modifierText);
  const arrangementText = normalizeArrangementActionText(
    modifierText || parts.arrangementText || ""
  );
  const timeLabel = formatArrangementNoteTime(parts.timeDraft, noteLocale);
  const actorLabel = sourceLabel || getDefaultArrangementActor(noteLocale);
  const replyLabel = confirmationText || getDefaultArrangementReply(noteLocale);
  const actionLabel =
    arrangementText || getDefaultArrangementAction(Boolean(modifierText), noteLocale);

  if (locale === "zh-CN") {
    const prefix = timeLabel ? `${timeLabel}，` : "";
    return `${prefix}${actorLabel}让你${actionLabel}，你回复“${replyLabel}”。`;
  }

  if (locale === "zh-TW") {
    const prefix = timeLabel ? `${timeLabel}，` : "";
    return `${prefix}${actorLabel}讓你${actionLabel}，你回覆「${replyLabel}」。`;
  }

  if (locale === "ar-SA") {
    const prefix = timeLabel ? `${timeLabel}، ` : "";
    return `${prefix}${actorLabel} طلب منك ${actionLabel}، ورددت "${replyLabel}".`;
  }

  const prefix = timeLabel ? `${timeLabel}, ` : "";
  return `${prefix}${actorLabel} asked you to ${actionLabel}, and you replied "${replyLabel}."`;
}

export function sanitizeArrangementCandidateNote(note: string | undefined, locale = "zh-CN") {
  const text = normalizeText(note);
  if (!text) return "";

  const noteLocale = getArrangementNoteLocale(locale);
  const labels = getArrangementNoteLabels(noteLocale);
  const cleanedText = text
    .replace(/\r?\n/g, " ")
    .split(/[；;]+/)
    .map((line) =>
      line
        .trim()
        .replace(/^Source\s*[:：]\s*/i, labels.source)
        .replace(/^Confirmation\s+reply\s*[:：]\s*/i, labels.confirmation)
        .replace(/^Confirmed\s*[:：]\s*/i, labels.confirmation)
        .replace(/^Reschedule\s+request\s*[:：]\s*/i, labels.modifier)
        .replace(/^Context\s*[:：]\s*/i, "")
        .replace(/^Draft\s*[:：]\s*/i, "")
        .replace(/\b(sourceRef|source draft|draft|context)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean);

  const firstLine = Array.from(new Set(cleanedText))[0] ?? "";
  return normalizeSingleSentenceNote(firstLine, noteLocale);
}

function normalizeArrangementActionText(value: string) {
  return value
    .trim()
    .replace(/^(你|您)/, "")
    .replace(/^(能不能|能否|可以|可否|是否|要不要|要不|请|麻烦)/, "")
    .replace(/[吗嘛么？?。！!]+$/g, "")
    .trim();
}

function formatArrangementNoteTime(
  timeDraft: ArrangementTimeDraft | undefined,
  locale: ArrangementNoteLocale
) {
  if (!timeDraft || timeDraft.kind === "none") return "";

  const part = "part" in timeDraft ? timeDraft.part : undefined;
  const clock = "clock" in timeDraft ? timeDraft.clock : undefined;
  const partLabel = getArrangementNoteTimePartLabel(part, locale);
  const timeSuffix = clock || partLabel;

  if (timeDraft.kind === "relativeDay") {
    const dayLabel = getArrangementNoteRelativeDayLabel(timeDraft.day, locale);
    return timeSuffix ? `${dayLabel}${locale === "en-US" ? " " : ""}${timeSuffix}` : dayLabel;
  }

  if (timeDraft.kind === "weekday") {
    const weekdayLabel = getArrangementNoteWeekdayLabel(timeDraft.weekday, locale);
    return timeSuffix
      ? `${weekdayLabel}${locale === "en-US" ? " " : ""}${timeSuffix}`
      : weekdayLabel;
  }

  return timeSuffix ? `${timeDraft.date} ${timeSuffix}` : timeDraft.date;
}

function getArrangementNoteRelativeDayLabel(day: "today" | "tomorrow", locale: ArrangementNoteLocale) {
  if (locale === "zh-CN") return day === "today" ? "今天" : "明天";
  if (locale === "zh-TW") return day === "today" ? "今天" : "明天";
  if (locale === "ar-SA") return day === "today" ? "اليوم" : "غدا";
  return day === "today" ? "today" : "tomorrow";
}

function getArrangementNoteTimePartLabel(
  part: ArrangementTimePart | undefined,
  locale: ArrangementNoteLocale
) {
  if (!part) return "";
  if (locale === "zh-CN" || locale === "zh-TW") {
    if (part === "morning") return "上午";
    if (part === "afternoon") return "下午";
    return "晚上";
  }
  if (locale === "ar-SA") {
    if (part === "morning") return "صباحا";
    if (part === "afternoon") return "بعد الظهر";
    return "مساء";
  }
  if (part === "morning") return "morning";
  if (part === "afternoon") return "afternoon";
  return "evening";
}

function getArrangementNoteWeekdayLabel(weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6, locale: ArrangementNoteLocale) {
  if (locale === "zh-CN") return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][weekday];
  if (locale === "zh-TW") return ["週日", "週一", "週二", "週三", "週四", "週五", "週六"][weekday];
  if (locale === "ar-SA") {
    return ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][weekday];
  }
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][weekday];
}

function getDefaultArrangementActor(locale: ArrangementNoteLocale) {
  if (locale === "zh-CN") return "对方";
  if (locale === "zh-TW") return "對方";
  if (locale === "ar-SA") return "الطرف الآخر";
  return "The other person";
}

function getDefaultArrangementAction(isModifier: boolean, locale: ArrangementNoteLocale) {
  if (locale === "zh-CN") return isModifier ? "调整这项安排" : "确认这项安排";
  if (locale === "zh-TW") return isModifier ? "調整這項安排" : "確認這項安排";
  if (locale === "ar-SA") return isModifier ? "تعديل هذا الموعد" : "تأكيد هذا الموعد";
  return isModifier ? "adjust this plan" : "confirm this plan";
}

function getDefaultArrangementReply(locale: ArrangementNoteLocale) {
  if (locale === "zh-CN" || locale === "zh-TW") return "已确认";
  if (locale === "ar-SA") return "تم";
  return "confirmed";
}

function normalizeSingleSentenceNote(value: string, locale: ArrangementNoteLocale) {
  const text = value.trim().replace(/\s+/g, " ");
  if (!text) return "";
  const firstSentence =
    text.match(/^.*?[。！？.!?](?=\s|$)/)?.[0] ?? text.split(/[。！？.!?]/)[0] ?? text;
  const sentence = firstSentence.trim();
  if (!sentence) return "";
  if (/[。！？.!?]$/.test(sentence)) return sentence;
  if (locale === "zh-CN" || locale === "zh-TW") return `${sentence}。`;
  return `${sentence}.`;
}

function getArrangementNoteLabels(locale: ArrangementNoteLocale) {
  if (locale === "zh-CN") {
    return { source: "来自", confirmation: "已确认：", modifier: "改期：" };
  }
  if (locale === "zh-TW") {
    return { source: "來自", confirmation: "已確認：", modifier: "改期：" };
  }
  if (locale === "ar-SA") {
    return { source: "من ", confirmation: "تم التأكيد: ", modifier: "تغيير الموعد: " };
  }
  return { source: "From ", confirmation: "Confirmed: ", modifier: "Rescheduled: " };
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

function isArrangementCandidateStatus(value: unknown): value is ArrangementCandidateStatus {
  return value === "pending" || value === "confirmed" || value === "ignored";
}

function isArrangementTimePart(value: unknown): value is ArrangementTimePart {
  return value === "morning" || value === "afternoon" || value === "evening";
}

function normalizeArrangementTimeDraft(value: unknown): ArrangementTimeDraft | undefined {
  if (!value || typeof value !== "object") return undefined;

  const draft = value as {
    kind?: unknown;
    day?: unknown;
    weekday?: unknown;
    date?: unknown;
    part?: unknown;
    clock?: unknown;
  };
  if (draft.kind === "none") return { kind: "none" };

  const part = isArrangementTimePart(draft.part) ? draft.part : undefined;
  const clock = normalizeText(draft.clock) || undefined;

  if (draft.kind === "relativeDay" && (draft.day === "today" || draft.day === "tomorrow")) {
    return { kind: "relativeDay", day: draft.day, ...(part ? { part } : {}), ...(clock ? { clock } : {}) };
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
    const date = normalizeText(draft.date);
    if (!date) return undefined;
    return { kind: "date", date, ...(part ? { part } : {}), ...(clock ? { clock } : {}) };
  }

  return undefined;
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

function normalizeSourceRefs(value: unknown, fallback: ArrangementSourceRef) {
  const sourceRefs = Array.isArray(value)
    ? value
        .map(normalizeSourceRef)
        .filter((sourceRef): sourceRef is ArrangementSourceRef => Boolean(sourceRef))
    : [];
  return mergeSourceRefs([fallback], sourceRefs);
}

export function normalizeArrangementCandidate(
  value: unknown,
  index: number
): ArrangementCandidate | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<ArrangementCandidate>;
  const title = normalizeText(candidate.title);
  const sourceRef = normalizeSourceRef(candidate.sourceRef, index);
  const sourceType = isArrangementSourceType(candidate.sourceType)
    ? candidate.sourceType
    : sourceRef?.type ?? "manual";
  if (!title || !sourceRef) return null;

  const status = isArrangementCandidateStatus(candidate.status)
    ? candidate.status
    : "pending";
  const createdBy = candidate.createdBy === "ai" ? "ai" : "validation";
  const sourceRefs = normalizeSourceRefs(candidate.sourceRefs, sourceRef);

  return {
    id: normalizeText(candidate.id) || `candidate-${index}`,
    title,
    ...(sanitizeArrangementCandidateNote(candidate.note)
      ? { note: sanitizeArrangementCandidateNote(candidate.note) }
      : {}),
    ...(normalizeArrangementTimeDraft(candidate.timeDraft)
      ? { timeDraft: normalizeArrangementTimeDraft(candidate.timeDraft) }
      : {}),
    ...(normalizeText(candidate.location)
      ? { location: normalizeText(candidate.location) }
      : {}),
    people: normalizeStringArray(candidate.people),
    ...(normalizeText(candidate.semanticKey)
      ? { semanticKey: normalizeText(candidate.semanticKey) }
      : {}),
    ...(normalizeText(candidate.eventFingerprint)
      ? { eventFingerprint: normalizeText(candidate.eventFingerprint) }
      : {}),
    ...(normalizeText(candidate.matchedCandidateId)
      ? { matchedCandidateId: normalizeText(candidate.matchedCandidateId) }
      : {}),
    ...(normalizeStringArray(candidate.linkedCandidateIds).length > 0
      ? { linkedCandidateIds: normalizeStringArray(candidate.linkedCandidateIds) }
      : {}),
    ...(normalizeNumberRatio(candidate.globalMergeConfidence) !== undefined
      ? { globalMergeConfidence: normalizeNumberRatio(candidate.globalMergeConfidence) }
      : {}),
    sourceType,
    sourceRef,
    sourceRefs,
    status,
    ...(normalizeNumberRatio(candidate.confidence) !== undefined
      ? { confidence: normalizeNumberRatio(candidate.confidence) }
      : {}),
    ...(normalizeText(candidate.reason) ? { reason: normalizeText(candidate.reason) } : {}),
    createdBy,
    createdAt: normalizeTimestamp(candidate.createdAt, Date.now() + index),
    updatedAt: normalizeTimestamp(candidate.updatedAt, Date.now() + index),
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

export function getInitialArrangementCandidates() {
  const parsedValue = readJsonValue(arrangementCandidatesStorageKey);
  if (!Array.isArray(parsedValue)) return [];

  return dedupeArrangementCandidates(
    parsedValue
    .map(normalizeArrangementCandidate)
      .filter((candidate): candidate is ArrangementCandidate => Boolean(candidate))
  );
}

export function persistArrangements(arrangements: ArrangementItem[]) {
  writeJsonValue(arrangementsStorageKey, arrangements);
  notifyArrangementsChange();
}

export function persistArrangementCandidates(candidates: ArrangementCandidate[]) {
  writeJsonValue(arrangementCandidatesStorageKey, candidates);
  notifyArrangementCandidatesChange();
}

export function notifyArrangementsChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(arrangementsStorageEvent));
}

export function notifyArrangementCandidatesChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(arrangementCandidatesStorageEvent));
}

function getSourceRefKey(sourceRef: ArrangementSourceRef) {
  return sourceRef.messageId || sourceRef.id;
}

function mergeSourceRefs(
  ...sourceRefGroups: Array<Array<ArrangementSourceRef | undefined> | undefined>
) {
  const sourceRefs = sourceRefGroups
    .flatMap((group) => group ?? [])
    .filter((sourceRef): sourceRef is ArrangementSourceRef => Boolean(sourceRef));
  const sourceRefMap = new Map<string, ArrangementSourceRef>();
  sourceRefs.forEach((sourceRef) => {
    const key = `${sourceRef.type}:${getSourceRefKey(sourceRef)}`;
    if (!sourceRefMap.has(key)) {
      sourceRefMap.set(key, sourceRef);
    }
  });
  return Array.from(sourceRefMap.values());
}

function getCandidateSourceRefs(candidate: ArrangementCandidate) {
  return mergeSourceRefs([candidate.sourceRef], candidate.sourceRefs);
}

function getNormalizedCandidateTitle(title: string) {
  return title.trim().replace(/\s+/g, "").toLocaleLowerCase();
}

function getCandidateSourceTitleKey(candidate: Pick<ArrangementCandidate, "sourceRef" | "title">) {
  return `${getSourceRefKey(candidate.sourceRef)}::${getNormalizedCandidateTitle(candidate.title)}`;
}

function getCandidateSemanticKey(
  candidate: Pick<ArrangementCandidate, "sourceRef" | "title" | "semanticKey">
) {
  return candidate.semanticKey || getCandidateSourceTitleKey(candidate);
}

function getCandidateConversationId(candidate: Pick<ArrangementCandidate, "sourceRef">) {
  return candidate.sourceRef.conversationId;
}

function isShortConfirmationTitle(title: string) {
  const normalized = title
    .trim()
    .replace(/[，。！？、；;：:,.!?\s~～…-]/g, "")
    .replace(/[的呀啊呢哈哦啦喔]+$/g, "")
    .toLocaleLowerCase();
  return /^(可以|可以来|能|能来|好的|好|行|没问题|ok|okay)$/i.test(normalized);
}

function isShortConfirmationCandidate(candidate: Pick<ArrangementCandidate, "title">) {
  return isShortConfirmationTitle(candidate.title);
}

function getArrangementCandidatePriority(candidate: ArrangementCandidate) {
  return isShortConfirmationCandidate(candidate) ? 0 : 1;
}

function shouldMergeArrangementCandidates(
  existingCandidate: ArrangementCandidate,
  nextCandidate: ArrangementCandidate
) {
  if (getCandidateSemanticKey(existingCandidate) === getCandidateSemanticKey(nextCandidate)) {
    return true;
  }

  if (existingCandidate.id === nextCandidate.matchedCandidateId) {
    return (nextCandidate.globalMergeConfidence ?? 0) >= 0.82;
  }

  if (nextCandidate.id === existingCandidate.matchedCandidateId) {
    return (existingCandidate.globalMergeConfidence ?? 0) >= 0.82;
  }

  if (
    existingCandidate.eventFingerprint &&
    nextCandidate.eventFingerprint &&
    existingCandidate.eventFingerprint === nextCandidate.eventFingerprint &&
    ((existingCandidate.globalMergeConfidence ?? 0) >= 0.82 ||
      (nextCandidate.globalMergeConfidence ?? 0) >= 0.82)
  ) {
    return true;
  }

  const existingConversationId = getCandidateConversationId(existingCandidate);
  const nextConversationId = getCandidateConversationId(nextCandidate);
  if (!existingConversationId || existingConversationId !== nextConversationId) {
    return false;
  }

  return (
    isShortConfirmationCandidate(existingCandidate) !==
    isShortConfirmationCandidate(nextCandidate)
  );
}

function getArrangementCandidateMergeBase(
  existingCandidate: ArrangementCandidate,
  nextCandidate: ArrangementCandidate
) {
  return getArrangementCandidatePriority(nextCandidate) >
    getArrangementCandidatePriority(existingCandidate)
    ? nextCandidate
    : existingCandidate;
}

function mergeCandidateNotes(previousNote?: string, nextNote?: string) {
  const notes = [previousNote, nextNote]
    .map((note) => note?.trim())
    .filter((note): note is string => Boolean(note));
  return Array.from(new Set(notes)).join("\n");
}

function mergeLinkedCandidateIds(
  existingCandidate: ArrangementCandidate,
  nextCandidate: ArrangementCandidate
) {
  return Array.from(
    new Set(
      [
        existingCandidate.id,
        nextCandidate.id,
        ...(existingCandidate.linkedCandidateIds ?? []),
        ...(nextCandidate.linkedCandidateIds ?? []),
        nextCandidate.matchedCandidateId,
        existingCandidate.matchedCandidateId,
      ].filter((id): id is string => Boolean(id))
    )
  );
}

function mergeArrangementCandidate(
  existingCandidate: ArrangementCandidate,
  nextCandidate: ArrangementCandidate
): ArrangementCandidate {
  const baseCandidate = getArrangementCandidateMergeBase(existingCandidate, nextCandidate);
  const dataCandidate = baseCandidate === nextCandidate ? nextCandidate : existingCandidate;
  const otherCandidate = dataCandidate === nextCandidate ? existingCandidate : nextCandidate;
  const sourceRefs = mergeSourceRefs(
    getCandidateSourceRefs(existingCandidate),
    getCandidateSourceRefs(nextCandidate)
  );
  const linkedCandidateIds = mergeLinkedCandidateIds(existingCandidate, nextCandidate);

  return {
    ...baseCandidate,
    title: baseCandidate.title,
    note: sanitizeArrangementCandidateNote(
      mergeCandidateNotes(existingCandidate.note, nextCandidate.note)
    ) || undefined,
    timeDraft: dataCandidate.timeDraft ?? otherCandidate.timeDraft,
    location: dataCandidate.location ?? otherCandidate.location,
    people:
      dataCandidate.people && dataCandidate.people.length > 0
        ? dataCandidate.people
        : otherCandidate.people,
    semanticKey: baseCandidate.semanticKey ?? dataCandidate.semanticKey ?? otherCandidate.semanticKey,
    eventFingerprint:
      dataCandidate.eventFingerprint ?? otherCandidate.eventFingerprint ?? baseCandidate.eventFingerprint,
    matchedCandidateId:
      dataCandidate.matchedCandidateId ?? otherCandidate.matchedCandidateId,
    ...(linkedCandidateIds.length > 0 ? { linkedCandidateIds } : {}),
    globalMergeConfidence:
      dataCandidate.globalMergeConfidence ??
      otherCandidate.globalMergeConfidence ??
      baseCandidate.globalMergeConfidence,
    sourceType: baseCandidate.sourceType,
    sourceRef: baseCandidate.sourceRef,
    sourceRefs,
    confidence: dataCandidate.confidence ?? otherCandidate.confidence,
    reason: dataCandidate.reason ?? otherCandidate.reason,
    createdBy:
      existingCandidate.createdBy === "ai" || nextCandidate.createdBy === "ai"
        ? "ai"
        : "validation",
    status:
      existingCandidate.status === "confirmed" || existingCandidate.status === "pending"
        ? existingCandidate.status
        : "pending",
    updatedAt: Date.now(),
  };
}

function dedupeArrangementCandidates(candidates: ArrangementCandidate[]) {
  return candidates.reduce<ArrangementCandidate[]>((dedupedCandidates, candidate) => {
    const existingIndex = dedupedCandidates.findIndex((item) =>
      shouldMergeArrangementCandidates(item, candidate)
    );
    if (existingIndex < 0) return [...dedupedCandidates, candidate];

    return dedupedCandidates.map((item, index) =>
      index === existingIndex ? mergeArrangementCandidate(item, candidate) : item
    );
  }, []);
}

export function createArrangementCandidateFromSourceDraft(
  draft: ArrangementSourceDraft
): ArrangementCandidate {
  const timestamp = Date.now();
  const title = draft.title.trim();

  return {
    id: `candidate-${draft.sourceRef.type}-${getSourceRefKey(draft.sourceRef)}`,
    title,
    ...(sanitizeArrangementCandidateNote(draft.note)
      ? { note: sanitizeArrangementCandidateNote(draft.note) }
      : {}),
    ...(draft.timeDraft ? { timeDraft: draft.timeDraft } : {}),
    ...(draft.semanticKey ? { semanticKey: draft.semanticKey } : {}),
    ...(draft.eventFingerprint ? { eventFingerprint: draft.eventFingerprint } : {}),
    sourceType: draft.sourceType,
    sourceRef: draft.sourceRef,
    sourceRefs: mergeSourceRefs([draft.sourceRef], draft.sourceRefs),
    status: "pending",
    createdBy: "validation",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function saveArrangementCandidateFromSourceDraft(
  draft: ArrangementSourceDraft
): ArrangementCandidate {
  const currentCandidates = getInitialArrangementCandidates();
  const candidate = createArrangementCandidateFromSourceDraft(draft);
  const existingIndex = currentCandidates.findIndex((item) =>
    shouldMergeArrangementCandidates(item, candidate)
  );

  if (existingIndex < 0) {
    persistArrangementCandidates([candidate, ...currentCandidates]);
    return candidate;
  }

  const restoredCandidate = mergeArrangementCandidate(
    currentCandidates[existingIndex],
    candidate
  );
  const nextCandidates = currentCandidates.map((item, index) =>
    index === existingIndex ? restoredCandidate : item
  );
  persistArrangementCandidates(nextCandidates);
  return restoredCandidate;
}

export function createArrangementCandidateFromAiDraft(
  draft: AiArrangementCandidateDraft,
  sourceDraft: ArrangementSourceDraft
): ArrangementCandidate {
  const timestamp = Date.now();
  const title = draft.title.trim();
  const sourceKey = getSourceRefKey(sourceDraft.sourceRef);
  const titleKey = getNormalizedCandidateTitle(title);

  return {
    id: `candidate-ai-${sourceDraft.sourceRef.type}-${sourceKey}-${titleKey || timestamp}`,
    title,
    ...(sanitizeArrangementCandidateNote(draft.note)
      ? { note: sanitizeArrangementCandidateNote(draft.note) }
      : {}),
    ...(draft.timeDraft ?? sourceDraft.timeDraft
      ? { timeDraft: draft.timeDraft ?? sourceDraft.timeDraft }
      : {}),
    ...(draft.location?.trim() ? { location: draft.location.trim() } : {}),
    people: normalizeStringArray(draft.people),
    ...(sourceDraft.semanticKey ? { semanticKey: sourceDraft.semanticKey } : {}),
    ...(draft.eventFingerprint ?? sourceDraft.eventFingerprint
      ? { eventFingerprint: draft.eventFingerprint ?? sourceDraft.eventFingerprint }
      : {}),
    ...(draft.matchedCandidateId ? { matchedCandidateId: draft.matchedCandidateId } : {}),
    ...(normalizeStringArray(draft.relatedMessageIds).length > 0
      ? { linkedCandidateIds: normalizeStringArray(draft.relatedMessageIds) }
      : {}),
    ...(normalizeNumberRatio(draft.globalMergeConfidence) !== undefined
      ? { globalMergeConfidence: normalizeNumberRatio(draft.globalMergeConfidence) }
      : {}),
    sourceType: sourceDraft.sourceType,
    sourceRef: sourceDraft.sourceRef,
    sourceRefs: mergeSourceRefs([sourceDraft.sourceRef], sourceDraft.sourceRefs),
    status: "pending",
    ...(normalizeNumberRatio(draft.confidence) !== undefined
      ? { confidence: normalizeNumberRatio(draft.confidence) }
      : {}),
    ...(draft.reason?.trim() ? { reason: draft.reason.trim() } : {}),
    createdBy: "ai",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function saveArrangementCandidateFromAiDraft(
  draft: AiArrangementCandidateDraft,
  sourceDraft: ArrangementSourceDraft
): ArrangementCandidate {
  const currentCandidates = getInitialArrangementCandidates();
  const candidate = createArrangementCandidateFromAiDraft(draft, sourceDraft);
  const existingIndex = currentCandidates.findIndex((item) =>
    shouldMergeArrangementCandidates(item, candidate)
  );

  if (existingIndex >= 0) {
    const mergedCandidate = mergeArrangementCandidate(
      currentCandidates[existingIndex],
      candidate
    );
    const nextCandidates = currentCandidates.map((item, index) =>
      index === existingIndex ? mergedCandidate : item
    );
    persistArrangementCandidates(nextCandidates);
    return mergedCandidate;
  }

  persistArrangementCandidates([candidate, ...currentCandidates]);
  return candidate;
}

export function updateArrangementCandidateStatus(
  id: string,
  status: ArrangementCandidateStatus
) {
  const nextCandidates = getInitialArrangementCandidates().map((candidate) =>
    candidate.id === id
      ? { ...candidate, status, updatedAt: Date.now() }
      : candidate
  );
  persistArrangementCandidates(nextCandidates);
  return nextCandidates;
}

export function createManualArrangement(input: ManualArrangementInput): ArrangementItem {
  const timestamp = Date.now();
  const timeFields = getArrangementTimeFieldsFromDraft(input.timeDraft, timestamp);
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
    attentionScore: input.timeDraft.kind === "none" ? 20 : 50,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createArrangementFromCandidate(
  candidate: ArrangementCandidate,
  input: ManualArrangementInput
): ArrangementItem {
  const timestamp = Date.now();
  const timeFields = getArrangementTimeFieldsFromDraft(input.timeDraft, timestamp);
  const title = input.title.trim();

  return {
    id: `arrangement-${timestamp}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    status: "active",
    ...timeFields,
    ...(input.location?.trim() ? { location: input.location.trim() } : {}),
    people: splitPeople(input.people),
    sourceType: candidate.sourceType,
    sourceRefs: getCandidateSourceRefs(candidate),
    aiCapability: candidate.createdBy === "ai" ? "aiAssist" : "userOnly",
    attentionScore: input.timeDraft.kind === "none" ? 30 : 60,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getArrangementTimeFieldsForPreset(
  preset: ArrangementTimePreset,
  now = Date.now()
): Pick<ArrangementItem, "timeKind" | "startAt" | "endAt" | "fuzzyTimeLabel"> {
  return getArrangementTimeFieldsFromDraft(getTimeDraftFromPreset(preset), now);
}

export function getTimeDraftFromPreset(preset: ArrangementTimePreset): ArrangementTimeDraft {
  if (preset === "today") return { kind: "relativeDay", day: "today" };
  if (preset === "tomorrow") return { kind: "relativeDay", day: "tomorrow" };
  if (preset === "weekend") return { kind: "weekday", weekday: 6 };
  return { kind: "none" };
}

export function getArrangementTimeFieldsFromDraft(
  draft: ArrangementTimeDraft,
  now = Date.now()
): Pick<ArrangementItem, "timeKind" | "startAt" | "endAt" | "fuzzyTimeLabel"> {
  if (draft.kind === "none") {
    return { timeKind: "none", fuzzyTimeLabel: "还没有时间" };
  }

  const targetDate = getDateForTimeDraft(draft, now);
  if (!targetDate) return { timeKind: "none", fuzzyTimeLabel: "还没有时间" };

  const hasClock = Boolean(parseClock(draft.clock));
  const hasPart = "part" in draft && Boolean(draft.part);
  const timeKind: ArrangementTimeKind = hasClock ? "deadline" : hasPart ? "fuzzy" : "fuzzy";

  return {
    timeKind,
    startAt: targetDate.getTime(),
    fuzzyTimeLabel: formatTimeDraftLabel(draft, targetDate, now),
  };
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

function getDateForTimeDraft(draft: ArrangementTimeDraft, now: number) {
  const baseDate = new Date(now);

  if (draft.kind === "relativeDay") {
    if (draft.day === "tomorrow") baseDate.setDate(baseDate.getDate() + 1);
    return applyDraftTime(baseDate, draft.part, draft.clock);
  }

  if (draft.kind === "weekday") {
    const targetDate = new Date(now);
    const currentDay = targetDate.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const daysUntilTarget = (draft.weekday - currentDay + 7) % 7 || 7;
    targetDate.setDate(targetDate.getDate() + daysUntilTarget);
    return applyDraftTime(targetDate, draft.part, draft.clock);
  }

  if (draft.kind === "date") {
    const [year, month, day] = draft.date.split("-").map(Number);
    if (!year || !month || !day) return null;
    return applyDraftTime(new Date(year, month - 1, day), draft.part, draft.clock);
  }

  return null;
}

function applyDraftTime(date: Date, part?: ArrangementTimePart, clock?: string) {
  const targetDate = new Date(date);
  const parsedClock = parseClock(clock);
  if (parsedClock) {
    targetDate.setHours(parsedClock.hour, parsedClock.minute, 0, 0);
    return targetDate;
  }

  const defaultHour = part === "afternoon" ? 14 : part === "evening" ? 19 : 9;
  targetDate.setHours(defaultHour, 0, 0, 0);
  return targetDate;
}

function parseClock(clock?: string) {
  if (!clock) return null;
  const match = clock.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function formatTimeDraftLabel(draft: ArrangementTimeDraft, targetDate: Date, now: number) {
  const clock = parseClock("clock" in draft ? draft.clock : undefined);
  const partLabel = "part" in draft ? getTimePartLabel(draft.part) : "";
  const clockLabel = clock ? `${padNumber(clock.hour)}:${padNumber(clock.minute)}` : "";
  const suffix = clockLabel || partLabel;

  if (draft.kind === "relativeDay") {
    const dayLabel = draft.day === "today" ? "今天" : "明天";
    return suffix ? `${dayLabel}${suffix}` : dayLabel;
  }

  if (draft.kind === "weekday") {
    const label = getWeekdayLabel(targetDate.getDay());
    return suffix ? `${label}${suffix}` : label;
  }

  const dateLabel = formatShortDate(targetDate, now);
  return suffix ? `${dateLabel} ${suffix}` : dateLabel;
}

function getTimePartLabel(part?: ArrangementTimePart) {
  if (part === "morning") return "上午";
  if (part === "afternoon") return "下午";
  if (part === "evening") return "晚上";
  return "";
}

function getWeekdayLabel(weekday: number) {
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][weekday] ?? "本周";
}

function formatShortDate(date: Date, now: number) {
  const current = new Date(now);
  const prefix =
    date.getFullYear() === current.getFullYear() ? "" : `${date.getFullYear()}年`;
  return `${prefix}${date.getMonth() + 1}月${date.getDate()}日`;
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
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
