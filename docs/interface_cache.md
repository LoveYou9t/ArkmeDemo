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
export function getArrangementTimeFieldsForPreset(
  preset: ArrangementTimePreset,
  now?: number
): Pick<ArrangementItem, "timeKind" | "startAt" | "fuzzyTimeLabel">;
export function normalizeArrangement(value: unknown, index: number): ArrangementItem | null;
```

- **Contextual Value:** Local no-backend persistence and normalization layer for first-stage manual arrangements and future AI-generated arrangements.

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

### Arrangement Compact Search And Source Panels Plan

- **File Location:** `src/pages/Arrangements.tsx`
- **Core Signature:**

```tsx
type ArrangementSearchPanelProps = {
  searchQuery: string;
  showSearchBar: boolean;
  onSearchQueryChange: (value: string) => void;
  onCloseSearch: () => void;
};

type ArrangementSourceFilterPanelProps = {
  sourceFilter: ArrangementSourceFilter;
  showSourceFilters: boolean;
  onSourceFilterChange: (value: ArrangementSourceFilter) => void;
  onToggleSourceFilters: () => void;
  onCloseSourceFilters: () => void;
};
```

- **Contextual Value:** Planned compact control surface where the search button lives in the header next to the create button, while source filtering becomes an expandable panel that does not permanently consume mobile first-screen space.
