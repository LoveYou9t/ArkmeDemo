# Interface Cache

This file records high-reusability components, state-transition logic, core data models, and API/TypeScript types discovered during codebase exploration.

## Entry Template

### Interface/Model Name

- **File Location:** `path/to/source.ts`
- **Core Signature:**

```ts
// Essential skeleton only
```

- **Contextual Value:** One sentence explaining why this interface or model matters for future AI integrations.

### AppShell

- **File Location:** `src/layouts/AppShell.tsx`
- **Core Signature:**

```tsx
export default function AppShell({
  mainPane,
  className,
}: {
  mainPane: React.ReactNode;
  className?: string;
})
```

- **Contextual Value:** Provides the shared mobile device frame and status bar that the new arrangements module should continue using through the existing `Home` entry.

### PageType

- **File Location:** `src/App.tsx`
- **Core Signature:**

```ts
export type PageType = "records" | "insight" | "mine";
```

- **Contextual Value:** The central navigation union that must be extended with `"arrangements"` for the first-stage arrangements tab.

### RecordItem

- **File Location:** `src/types/record.ts`
- **Core Signature:**

```ts
export type RecordItem = {
  uid: string;
  text_content: string;
  send_at: number;
  create_at: number;
  update_at: number;
  sourceConversation?: RecordSourceConversation;
  referencedRecord?: RecordReference;
};
```

- **Contextual Value:** Existing quick-note memory shape and source-reference pattern can inform arrangement source context and future conversion from records to arrangements.

### RecordSourceConversation

- **File Location:** `src/types/record.ts`
- **Core Signature:**

```ts
export type RecordSourceConversation = {
  type: "ai" | "self" | "test";
  label: string;
  actionLabel: string;
  iconLabel: string;
  entryIndex?: number;
  recordUid?: string;
  identityId?: string;
  conversationId?: string;
};
```

- **Contextual Value:** Existing source-link model is the nearest reusable reference for arrangement `sourceRefs` and later AI conversation provenance.

### RecordDetailSheet

- **File Location:** `src/components/RecordDetailSheet.tsx`
- **Core Signature:**

```tsx
type RecordDetailSheetProps = {
  record: RecordItem | null;
  onClose: () => void;
  onOpenSource?: (source: RecordSourceConversation) => void;
};
```

- **Contextual Value:** Reusable bottom-sheet interaction and detail-row layout should guide the first arrangement detail sheet to keep visual consistency.

### ChatInput

- **File Location:** `src/components/ChatInput.tsx`
- **Core Signature:**

```tsx
type ChatInputProps = {
  onSubmit: (content: string) => void;
  onVoiceSubmit: () => void;
};
```

- **Contextual Value:** Existing lightweight input interaction can be reused conceptually for quick arrangement creation or later "send to self -> arrangement" flows.

### TestConversation Models

- **File Location:** `src/data/testConversations.ts`
- **Core Signature:**

```ts
export type TestMessage = {
  id: string;
  conversationId: string;
  conversationType: "private" | "group";
  identityId: string;
  text: string;
  sentAt: number;
  sender: "identity" | "demo";
};
```

- **Contextual Value:** These existing message models are the likely future input source for private/group chat arrangement recognition.

### TestConversation Storage Pattern

- **File Location:** `src/data/testConversations.ts`
- **Core Signature:**

```ts
function readJsonValue(key: string): unknown;
function writeJsonValue(key: string, value: unknown): void;
export function persistTestMessages(messages: TestMessage[]): void;
export function notifyTestConversationChange(): void;
```

- **Contextual Value:** The arrangements data layer should mirror this normalization and localStorage persistence style for reliable no-backend state.

### MobileBottomNavigation

- **File Location:** `src/pages/Home.tsx`
- **Core Signature:**

```tsx
function MobileBottomNavigation({
  currentPage,
  onNavigate,
}: {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
})
```

- **Contextual Value:** The first-stage arrangements entry should reuse this bottom navigation pattern by adding an `"arrangements"` tab instead of creating a new navigation system.

### renderMainContent Flow

- **File Location:** `src/pages/Home.tsx`
- **Core Signature:**

```tsx
const renderMainContent = () => {
  if (currentPage === "mine") return <MinePreview ... />;
  if (currentPage === "insight") return <InsightPreview />;
  return <Records ... />;
};
```

- **Contextual Value:** The arrangements page should be inserted as another `currentPage` branch so side drawers, sheets, and bottom navigation visibility keep working consistently.

### Created Self Records Persistence

- **File Location:** `src/pages/Home.tsx`
- **Core Signature:**

```ts
const createdSelfRecordsStorageKey = "arkme-demo.selfRecords";
function getInitialCreatedSelfRecords(): RecordItem[];
function persistCreatedSelfRecords(records: RecordItem[]): void;
const createSelfRecord = React.useCallback((content: string) => { ... }, []);
```

- **Contextual Value:** This is the closest existing localStorage create/persist state loop and should be mirrored for first-stage manual arrangement creation.

### Time Formatting Utilities

- **File Location:** `src/lib/time.ts`
- **Core Signature:**

```ts
export function formatTimeLabel(timestamp: number, options?: {...}): string;
export function formatBubbleTime(timestamp: number): string;
export function formatRelativeTime(timestamp: number, options?: {...}): string;
```

- **Contextual Value:** Arrangement cards and detail sheets should reuse these existing time formatters before introducing any new date formatting helpers.

### EmptyState

- **File Location:** `src/components/EmptyState.tsx`
- **Core Signature:**

```tsx
type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
};
```

- **Contextual Value:** The arrangements empty and filtered states can reuse the existing empty-state visual language to stay aligned with the current Demo.

## Logged Interfaces

### AiConversationLogEntry

- **File Location:** `src/data/aiConversationLog.ts`
- **Core Signature:**

```ts
export type AiConversationLogEntry = {
  timestamp: string;
  userInput: string;
  aiFinalOutput: string;
  changedFiles: string[];
  verification: string[];
};
```

- **Contextual Value:** The UI-facing record contract that keeps Codex iteration history synchronized between candidate Markdown logs and the in-app AI conversation sidebar.

### ArrangementItem

- **File Location:** `src/types/arrangement.ts`
- **Core Signature:**

```ts
export type ArrangementItem = {
  id: string;
  title: string;
  status: "active" | "done" | "later" | "archived";
  timeKind: "none" | "deadline" | "timeRange" | "reminder" | "fuzzy";
  startAt?: number;
  location?: string;
  people: string[];
  sourceType: ArrangementSourceType;
  sourceRefs: ArrangementSourceRef[];
  aiCapability: "userOnly" | "aiAssist" | "aiExecutable";
  attentionScore: number;
};
```

- **Contextual Value:** Core arrangement data model that preserves future AI recognition, source merging, calendar, and reminder expansion points.

### Arrangement Data Layer

- **File Location:** `src/data/arrangements.ts`
- **Core Signature:**

```ts
export function getInitialArrangements(): ArrangementItem[];
export function persistArrangements(arrangements: ArrangementItem[]): void;
export function createManualArrangement(input: ManualArrangementInput): ArrangementItem;
export type ArrangementTimeDraft =
  | { kind: "none" }
  | { kind: "relativeDay"; day: "today" | "tomorrow"; part?: ArrangementTimePart; clock?: string }
  | { kind: "weekday"; weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; part?: ArrangementTimePart; clock?: string }
  | { kind: "date"; date: string; part?: ArrangementTimePart; clock?: string };
export function getArrangementTimeFieldsFromDraft(
  draft: ArrangementTimeDraft,
  now?: number
): Pick<ArrangementItem, "timeKind" | "startAt" | "endAt" | "fuzzyTimeLabel">;
export function getArrangementTimeFieldsForPreset(
  preset: ArrangementTimePreset,
  now?: number
): Pick<ArrangementItem, "timeKind" | "startAt" | "endAt" | "fuzzyTimeLabel">;
export function normalizeArrangement(value: unknown, index: number): ArrangementItem | null;
```

- **Contextual Value:** Local no-backend persistence and normalization layer for manual, AI-generated, and multi-granularity time arrangements.

### Arrangements Page State Flow

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```tsx
export default function Arrangements();
type ArrangementFilter = "all" | "near" | "later" | "done";
```

- **Contextual Value:** First implementation surface for arrangement list, creation, detail sheet, and state transitions while reusing existing mobile shell/navigation.

### TodaySpotlightSection

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```tsx
type TodaySpotlightSectionProps = {
  arrangements: ArrangementItem[];
  allVisibleArrangementsDone: boolean;
  hasFutureActiveArrangements: boolean;
  hasAnyVisibleArrangement: boolean;
  onOpen: (arrangement: ArrangementItem) => void;
  onComplete: (arrangement: ArrangementItem) => void;
  onRestore: (arrangement: ArrangementItem) => void;
  onShowNear: () => void;
  onShowDone: () => void;
  onCreate: () => void;
};
```

- **Contextual Value:** Second-stage state component separating today's actionable arrangements from future, completed, and empty arrangement states without changing the existing data model.

### Arrangement Today Spotlight Helpers

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```ts
function shouldShowInTodaySpotlight(arrangement: ArrangementItem, now?: number): boolean;
function compareByTimeThenAttention(a: ArrangementItem, b: ArrangementItem): number;
```

- **Contextual Value:** Local filtering and sorting rules that keep the top arrangements area focused on today's active items while preserving future calendar and reminder expansion paths.

### Arrangement Time Draft

- **File Location:** `src/data/arrangements.ts`
- **Core Signature:**

```ts
type ArrangementTimeDraft =
  | { kind: "none" }
  | {
      kind: "relativeDay";
      day: "today" | "tomorrow";
      part?: "morning" | "afternoon" | "evening";
      clock?: string;
    }
  | {
      kind: "weekday";
      weekday: 1 | 2 | 3 | 4 | 5 | 6 | 0;
      part?: "morning" | "afternoon" | "evening";
      clock?: string;
    }
  | {
      kind: "date";
      date: string;
      part?: "morning" | "afternoon" | "evening";
      clock?: string;
    };

function getArrangementTimeFieldsFromDraft(
  draft: ArrangementTimeDraft,
  now?: number
): Pick<ArrangementItem, "timeKind" | "startAt" | "endAt" | "fuzzyTimeLabel">;
```

- **Contextual Value:** Planned UI-layer time input contract that lets future AI and manual creation express tomorrow morning, afternoon, weekdays, exact dates, and clock times without changing the core `ArrangementItem` model.

### TimeDraftSelector

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```tsx
function TimeDraftSelector({
  value,
  onChange,
}: {
  value: ArrangementTimeDraft;
  onChange: (value: ArrangementTimeDraft) => void;
}): JSX.Element;

const timeQuickOptions = [
  { key: "none", label: "无时间" },
  { key: "today", label: "今天" },
  { key: "tomorrow", label: "明天" },
  { key: "weekday", label: "本周" },
  { key: "date", label: "具体日期" },
];
```

- **Contextual Value:** Manual arrangement editing uses this component as the single UI state bridge from quick date, weekday, time part, and exact clock controls into `ArrangementTimeDraft`.

### Arrangement Spotlight Mode Plan

- **File Location:** `docs/arrangements-tomorrow-reminder-time-plan.md`
- **Core Signature:**

```ts
type ArrangementSpotlightMode =
  | "today"
  | "tomorrow"
  | "upcoming"
  | "done"
  | "empty"
  | "calm";

type ArrangementSpotlightState = {
  mode: ArrangementSpotlightMode;
  arrangements: ArrangementItem[];
};
```

- **Contextual Value:** Planned top-of-page state contract that keeps today's arrangements distinct from tomorrow and upcoming reminders while reusing the existing spotlight card UI.

### Arrangement Editing And Search

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```ts
type ArrangementSourceFilter =
  | "all"
  | "manual"
  | "sendToSelf"
  | "privateChat"
  | "groupChat"
  | "aiSuggestion";
type EditorMode = "create" | "edit";

function matchesSearchQuery(arrangement: ArrangementItem, query: string): boolean;
function matchesSourceFilter(
  arrangement: ArrangementItem,
  sourceFilter: ArrangementSourceFilter
): boolean;
function getEditorFormFromArrangement(arrangement: ArrangementItem): EditorForm;
```

- **Contextual Value:** Third-stage interaction layer for editing existing arrangements and filtering local arrangements before adding AI-generated or message-derived arrangement flows.

### Arrangement Compact Search And Source Dropdown

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```tsx
type ArrangementSearchPanelProps = {
  searchQuery: string;
  showSearchBar: boolean;
  onSearchQueryChange: (value: string) => void;
  onCloseSearch: () => void;
};

type ArrangementSourceDropdownProps = {
  sourceFilter: ArrangementSourceFilter;
  showSourceFilters: boolean;
  onSourceFilterChange: (value: ArrangementSourceFilter) => void;
  onToggleSourceFilters: () => void;
};

type ArrangementListSectionProps = {
  title: string;
  arrangements: ArrangementItem[];
  sourceFilter: ArrangementSourceFilter;
  showSourceFilters: boolean;
  hasActiveListFilters: boolean;
};
```

- **Contextual Value:** Compact control surface where the search button lives in the header next to the create button, while source filtering is anchored to the arrangement list title as a right-aligned dropdown that remains available even when filters return no list results.

### SearchIcon

- **File Location:** `src/components/SearchIcon.tsx`
- **Core Signature:**

```tsx
export default function SearchIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}): JSX.Element;
```

- **Contextual Value:** Shared quick-note search icon now reused by arrangements so search entry styling stays consistent while color continues to inherit from surrounding theme text utilities.

### Arrangement Candidate Data Layer

- **File Location:** `src/data/arrangements.ts`
- **Core Signature:**

```ts
type ArrangementCandidateStatus = "pending" | "confirmed" | "ignored";

type ArrangementCandidate = {
  id: string;
  title: string;
  note?: string;
  confidence?: number;
  reason?: string;
  sourceType: ArrangementSourceType;
  semanticKey?: string;
  timeDraft?: ArrangementTimeDraft;
  location?: string;
  people?: string[];
  sourceRef: ArrangementSourceRef;
  status: ArrangementCandidateStatus;
  createdBy: "validation" | "ai";
  createdAt: number;
  updatedAt: number;
};

type ArrangementSourceDraft = {
  title: string;
  note?: string;
  semanticKey?: string;
  timeDraft?: ArrangementTimeDraft;
  sourceType: ArrangementSourceType;
  sourceRef: ArrangementSourceRef;
};

function createArrangementCandidateFromSourceDraft(
  draft: ArrangementSourceDraft
): ArrangementCandidate;

function saveArrangementCandidateFromSourceDraft(
  draft: ArrangementSourceDraft
): ArrangementCandidate;

function shouldMergeArrangementCandidates(
  existingCandidate: ArrangementCandidate,
  nextCandidate: ArrangementCandidate
): boolean;

function dedupeArrangementCandidates(
  candidates: ArrangementCandidate[]
): ArrangementCandidate[];

function createArrangementFromCandidate(
  candidate: ArrangementCandidate,
  input: ManualArrangementInput
): ArrangementItem;
```

- **Contextual Value:** Fourth-stage validation queue that lets quick notes and test messages become confirmable arrangement candidates, with semantic-key and same-chat short-confirmation merging before conversion into official `ArrangementItem` records.

### Arrangement Candidate StatusPill Display

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```tsx
function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "primary" | "muted";
}): JSX.Element;

// AI candidates render candidate.title directly and use:
<StatusPill label="AI 建议" tone="primary" />;
<StatusPill label={getSourceTypeLabel(candidate.sourceType)} tone="muted" />;
```

- **Contextual Value:** Shared small capsule style for AI suggestion and source/status labels, keeping arrangement cards aligned with settings-page `bg-primary-soft text-primary` and `bg-fill-3 text-text-tertiary` tokens.

### Arrangement AI Recognition Service Plan

- **File Location:** `docs/arrangements-real-ai-integration-plan.md`
- **Core Signature:**

```ts
type AiArrangementCandidateDraft = {
  title: string;
  note?: string;
  timeDraft?: ArrangementTimeDraft;
  location?: string;
  people?: string[];
  confidence?: number;
  reason?: string;
};

type RecognizeArrangementCandidatesInput = {
  sourceDraft: ArrangementSourceDraft;
  locale?: "zh-CN" | "en-US";
};

async function recognizeArrangementCandidates(
  input: RecognizeArrangementCandidatesInput
): Promise<{ candidates: AiArrangementCandidateDraft[]; rawText?: string }>;

function createArrangementCandidateFromAiDraft(
  draft: AiArrangementCandidateDraft,
  sourceDraft: ArrangementSourceDraft
): ArrangementCandidate;
```

- **Contextual Value:** Planned service boundary for real AI arrangement extraction that can feed the existing candidate queue without changing the official `ArrangementItem` model or confirmation UI.

### AI API Settings Data Layer

- **File Location:** `src/data/aiApiSettings.ts`
- **Core Signature:**

```ts
type AiApiSettings = {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
};

const aiApiSettingsStorageKey = "arkme-demo.aiApiSettings";

function getAiApiSettings(): AiApiSettings;
function persistAiApiSettings(settings: AiApiSettings): void;
function isAiApiConfigured(settings?: AiApiSettings): boolean;
function useAiApiSettings(): AiApiSettings;
```

- **Contextual Value:** Browser-local AI preference contract for enable state, Base URL, API Key, and model; the browser sends these only to the same-origin recognition proxy, which forwards to the configured Responses API endpoint.

### Arrangement AI Recognition Service

- **File Location:** `src/services/arrangementAi.ts`
- **Core Signature:**

```ts
type AiArrangementRecognitionResult = {
  hasArrangement: boolean;
  title: string;
  timeDraft?: ArrangementTimeDraft;
  location?: string;
  people?: string[];
  note?: string;
  confidence?: number;
  reason?: string;
};

async function recognizeArrangementCandidate(
  sourceDraft: ArrangementSourceDraft,
  options?: { locale?: string; languageName?: string }
): Promise<AiArrangementRecognitionResult>;

function getResponsesEndpoint(baseUrl: string): string;

const arrangementRecognitionSchema = {
  required: ["hasArrangement", "title", "timeDraft", "location", "people", "note", "confidence", "reason"],
  properties: {
    timeDraft: {
      required: ["kind", "day", "weekday", "date", "part", "clock"],
      properties: {
        kind: { enum: ["none", "relativeDay", "weekday", "date"] },
      },
    },
  },
};
```

- **Contextual Value:** Real AI extraction boundary that calls same-origin `/api/arrangement-recognition`, turns conversation-context source drafts into structured candidate summaries for title, time, location, people, and notes, and keeps official arrangements user-confirmed; the proxy target accepts either a base `/v1` URL or a full `/responses` URL.

### Arrangement Candidate Note Localization

- **File Location:** `src/data/arrangements.ts`
- **Core Signature:**

```ts
type ArrangementNoteLocale = "zh-CN" | "zh-TW" | "en-US" | "ar-SA";

function getArrangementNoteLanguageName(locale: string): string;

function formatArrangementCandidateNote(
  parts: {
    sourceLabel?: string;
    confirmationText?: string;
    modifierText?: string;
    arrangementText?: string;
    timeDraft?: ArrangementTimeDraft;
  },
  locale: string
): string;

function sanitizeArrangementCandidateNote(
  note: string | undefined,
  locale?: string
): string;
```

- **Contextual Value:** Shared candidate-note boundary that keeps AI and local fallback notes as one user-facing sentence aligned with the app's current `resolvedLocale`, covering time, requester, requested action, and user reply while stripping internal labels such as `Source` and `Confirmation reply`.

### Arrangement Recognition Proxy API

- **File Location:** `server/arrangementRecognitionProxy.ts`
- **Core Signature:**

```ts
type ArrangementRecognitionApiRequest = {
  sourceDraft: ArrangementSourceDraft;
  model?: string;
};

type ArrangementRecognitionApiResponse =
  | { ok: true; result: AiArrangementRecognitionResult }
  | { ok: false; error: string };

async function arrangementRecognitionProxy(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void>;
```

- **Contextual Value:** Same-origin backend boundary that avoids browser-side CORS failures while preserving the current settings-page Base URL/API Key/Model inputs and the existing arrangement candidate flow.

### Recent Arrangement Scan Action

- **File Location:** `src/pages/Home.tsx`
- **Core Signature:**

```ts
type RecentArrangementScanState = {
  state: "idle" | "scanning" | "success" | "empty" | "error" | "unconfigured";
  message: string;
};

async function scanRecentConversationsForArrangements(): Promise<void>;

function AiApiSettingsScreen(props: {
  onScanRecentConversations: () => void;
  scanState: RecentArrangementScanState;
}): JSX.Element;
```

- **Contextual Value:** Settings-level batch entry that reuses the single-record AI recognition service and candidate queue to scan recent self/private/group conversations without directly creating official arrangements.

### AI Recognition Diagnostics

- **File Location:** `src/data/aiRecognitionDiagnostics.ts`
- **Core Signature:**

```ts
type AiRecognitionDiagnosticStage =
  | "request"
  | "success"
  | "empty"
  | "http-error"
  | "network-error"
  | "parse-error"
  | "unconfigured"
  | "fallback";

type AiRecognitionDiagnosticEntry = {
  action: "single" | "quick-scan";
  stage: AiRecognitionDiagnosticStage;
  endpoint?: string;
  model?: string;
  hasApiKey: boolean;
  apiKeyTail?: string;
  httpStatus?: number;
  errorMessage?: string;
  responseBodySnippet?: string;
  fallbackUsed?: boolean;
};

function appendAiRecognitionDiagnostic(
  entry: Omit<AiRecognitionDiagnosticEntry, "id" | "timestamp">
): void;

function useAiRecognitionDiagnostics(): AiRecognitionDiagnosticEntry[];
```

- **Contextual Value:** Browser-local ring buffer for proving whether AI recognition used the same-origin proxy, which target `/responses` endpoint/model it forwarded to, and why quick scan fell back to local rules without exposing the full API key.

### AI Recognition Switch

- **File Location:** `src/pages/Home.tsx`
- **Core Signature:**

```tsx
function AiRecognitionSwitch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}): JSX.Element;
```

- **Contextual Value:** Reusable settings switch for the browser-local AI recognition enable state; the thumb uses explicit pixel dimensions against a fixed 56x32 track so customized Tailwind spacing tokens cannot move it off center.

### Preferences And Translation Context

- **File Location:** `src/settings/preferences.ts`
- **Core Signature:**

```ts
type PreferencesContextValue = {
  resolvedLocale: string;
  direction: "ltr" | "rtl";
  setLocaleCode: (value: LocaleCode) => void;
  t: (
    key: TranslationKey,
    values?: Record<string, string | number>
  ) => string;
};

export function PreferencesProvider({ children }: { children: React.ReactNode }): JSX.Element;
export function usePreferences(): PreferencesContextValue;
```

- **Contextual Value:** Central app-wide language and theme boundary; new arrangement and AI settings UI reuse `t()` with fallback and interpolation instead of introducing a separate i18n mechanism.

### MetaPill

- **File Location:** `src/components/MetaPill.tsx`
- **Core Signature:**

```tsx
export type MetaPillTone = "primary" | "muted" | "danger";

export default function MetaPill({
  label,
  tone = "muted",
  className,
}: {
  label: string;
  tone?: MetaPillTone;
  className?: string;
}): JSX.Element;
```

- **Contextual Value:** Shared lightweight capsule for arrangement statuses, source tags, AI settings enable state, and diagnostic stages so new metadata labels keep one visual contract across pages.

### Local Arrangement Candidate Derivation

- **File Location:** `src/pages/Home.tsx`
- **Core Signature:**

```ts
function isLocalShortConfirmationText(value: string): boolean;

type LocalArrangementSemanticResult = {
  baseRecord: RecordItem;
  modifierRecord?: RecordItem;
  confirmationRecord?: RecordItem;
  timeDraft?: ArrangementTimeDraft;
};

function isLocalTimeChangeText(value: string): boolean;

function getLocalArrangementSemanticResult(
  record: RecordItem,
  contextRecords: RecordItem[]
): LocalArrangementSemanticResult;

function parseLocalArrangementTimeDraftFromText(
  text: string
): ArrangementTimeDraft | undefined;

function mergeLocalArrangementTimeDraft(
  baseDraft: ArrangementTimeDraft | undefined,
  overrideDraft: ArrangementTimeDraft | undefined,
  overrideText?: string
): ArrangementTimeDraft | undefined;

function deriveLocalArrangementCandidateDraft(
  record: RecordItem,
  contextRecords: RecordItem[]
): ArrangementSourceDraft;
```

- **Contextual Value:** Local fallback path that lets no-API arrangement recognition infer the real candidate from conversation context, normalize short confirmations like "能的", merge reschedule messages, and prefill time drafts for confirmation.

### Arrangement Candidate Source Boundary

- **File Location:** `src/data/arrangements.ts`, `src/types/arrangement.ts`
- **Core Signature:**

```ts
type ArrangementSourceRef = {
  id: string;
  type: ArrangementSourceType;
  title: string;
  excerpt: string;
  createdAt: number;
  conversationId?: string;
  messageId?: string;
};

type ArrangementCandidate = {
  sourceRef: ArrangementSourceRef;
  sourceRefs?: ArrangementSourceRef[];
  semanticKey?: string;
  eventFingerprint?: string;
  matchedCandidateId?: string;
  linkedCandidateIds?: string[];
  globalMergeConfidence?: number;
};

type ArrangementItem = {
  sourceRefs: ArrangementSourceRef[];
};
```

- **Contextual Value:** Candidate storage currently keeps one primary source while confirmed arrangements keep multiple sources; future multi-user same-event association should extend candidates with a compatible `sourceRefs` collection before creating final arrangements.
