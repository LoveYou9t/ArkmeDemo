export type ArrangementStatus = "active" | "done" | "later" | "archived";

export type ArrangementTimeKind =
  | "none"
  | "deadline"
  | "timeRange"
  | "reminder"
  | "fuzzy";

export type ArrangementSourceType =
  | "manual"
  | "sendToSelf"
  | "privateChat"
  | "groupChat"
  | "aiSuggestion";

export type ArrangementAiCapability = "userOnly" | "aiAssist" | "aiExecutable";

export type ArrangementSourceRef = {
  id: string;
  type: ArrangementSourceType;
  title: string;
  excerpt: string;
  createdAt: number;
  conversationId?: string;
  messageId?: string;
};

export type ArrangementItem = {
  id: string;
  title: string;
  note?: string;
  status: ArrangementStatus;
  timeKind: ArrangementTimeKind;
  startAt?: number;
  endAt?: number;
  fuzzyTimeLabel?: string;
  location?: string;
  people: string[];
  sourceType: ArrangementSourceType;
  sourceRefs: ArrangementSourceRef[];
  aiCapability: ArrangementAiCapability;
  attentionScore: number;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  laterAt?: number;
};

