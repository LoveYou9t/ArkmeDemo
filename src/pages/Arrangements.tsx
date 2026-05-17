import React from "react";
import EmptyState from "@/components/EmptyState";
import MetaPill from "@/components/MetaPill";
import SearchIcon from "@/components/SearchIcon";
import {
  arrangementCandidatesStorageEvent,
  arrangementsStorageEvent,
  createArrangementFromCandidate,
  createManualArrangement,
  getArrangementTimeFieldsFromDraft,
  getInitialArrangementCandidates,
  getInitialArrangements,
  persistArrangements,
  updateArrangementCandidateStatus,
  type ArrangementCandidate,
  type ArrangementTimeDraft,
  type ArrangementTimePart,
  type ArrangementTimePreset,
} from "@/data/arrangements";
import { formatTimeLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/settings/preferences";
import type {
  ArrangementAiCapability,
  ArrangementItem,
  ArrangementSourceRef,
  ArrangementSourceType,
  ArrangementStatus,
} from "@/types/arrangement";

type ArrangementFilter = "all" | "near" | "later" | "done";
type ArrangementSourceFilter = "all" | ArrangementSourceType;
type EditorMode = "create" | "edit" | "confirm";

type EditorForm = {
  title: string;
  timeDraft: ArrangementTimeDraft;
  location: string;
  people: string;
  note: string;
};

const filters: Array<{ key: ArrangementFilter; labelKey: string }> = [
  { key: "all", labelKey: "arrangements.filter.all" },
  { key: "near", labelKey: "arrangements.filter.near" },
  { key: "later", labelKey: "arrangements.filter.later" },
  { key: "done", labelKey: "arrangements.filter.done" },
];

const sourceFilters: Array<{ key: ArrangementSourceFilter; labelKey: string }> = [
  { key: "all", labelKey: "arrangements.source.all" },
  { key: "manual", labelKey: "arrangements.source.manual" },
  { key: "sendToSelf", labelKey: "arrangements.source.sendToSelf" },
  { key: "privateChat", labelKey: "arrangements.source.privateChat" },
  { key: "groupChat", labelKey: "arrangements.source.groupChat" },
  { key: "aiSuggestion", labelKey: "arrangements.source.aiSuggestion" },
];

const emptyEditorForm: EditorForm = {
  title: "",
  timeDraft: { kind: "none" },
  location: "",
  people: "",
  note: "",
};

type ArrangementsProps = {
  onOpenCandidateSource?: (sourceRef: ArrangementSourceRef) => void;
};

export default function Arrangements({ onOpenCandidateSource }: ArrangementsProps) {
  const { t } = usePreferences();
  const [arrangements, setArrangements] = React.useState(getInitialArrangements);
  const [candidates, setCandidates] = React.useState(getInitialArrangementCandidates);
  const [activeFilter, setActiveFilter] = React.useState<ArrangementFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<ArrangementSourceFilter>("all");
  const [showSearchBar, setShowSearchBar] = React.useState(false);
  const [showSourceFilters, setShowSourceFilters] = React.useState(false);
  const [selectedArrangementId, setSelectedArrangementId] = React.useState<string | null>(null);
  const [showEditor, setShowEditor] = React.useState(false);
  const [editingArrangementId, setEditingArrangementId] = React.useState<string | null>(null);
  const [confirmingCandidateId, setConfirmingCandidateId] = React.useState<string | null>(null);

  const selectedArrangement =
    arrangements.find((arrangement) => arrangement.id === selectedArrangementId) ?? null;
  const editingArrangement =
    arrangements.find((arrangement) => arrangement.id === editingArrangementId) ?? null;
  const confirmingCandidate =
    candidates.find((candidate) => candidate.id === confirmingCandidateId) ?? null;
  const pendingCandidates = React.useMemo(
    () => candidates.filter((candidate) => candidate.status === "pending"),
    [candidates]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const refreshArrangements = () => setArrangements(getInitialArrangements());
    const refreshCandidates = () => setCandidates(getInitialArrangementCandidates());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "arkme-demo.arrangements") {
        refreshArrangements();
      }
      if (event.key === null || event.key === "arkme-demo.arrangementCandidates") {
        refreshCandidates();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(arrangementsStorageEvent, refreshArrangements);
    window.addEventListener(arrangementCandidatesStorageEvent, refreshCandidates);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(arrangementsStorageEvent, refreshArrangements);
      window.removeEventListener(arrangementCandidatesStorageEvent, refreshCandidates);
    };
  }, []);

  const visibleArrangements = React.useMemo(
    () =>
      arrangements
        .filter((arrangement) => isVisibleForFilter(arrangement, activeFilter))
        .filter((arrangement) => matchesSearchQuery(arrangement, searchQuery))
        .filter((arrangement) => matchesSourceFilter(arrangement, sourceFilter)),
    [activeFilter, arrangements, searchQuery, sourceFilter]
  );
  const nonArchivedArrangements = React.useMemo(
    () => arrangements.filter((arrangement) => arrangement.status !== "archived"),
    [arrangements]
  );
  const activeArrangements = React.useMemo(
    () => nonArchivedArrangements.filter((arrangement) => arrangement.status === "active"),
    [nonArchivedArrangements]
  );
  const doneArrangements = React.useMemo(
    () => nonArchivedArrangements.filter((arrangement) => arrangement.status === "done"),
    [nonArchivedArrangements]
  );
  const todaySpotlightArrangements = React.useMemo(
    () =>
      activeArrangements
        .filter((arrangement) => shouldShowInTodaySpotlight(arrangement))
        .sort(compareByTimeThenAttention)
        .slice(0, 2),
    [activeArrangements]
  );
  const allVisibleArrangementsDone =
    nonArchivedArrangements.length > 0 &&
    doneArrangements.length === nonArchivedArrangements.length;
  const hasFutureActiveArrangements = activeArrangements.some(
    (arrangement) => !shouldShowInTodaySpotlight(arrangement)
  );

  const updateArrangements = React.useCallback(
    (updater: (current: ArrangementItem[]) => ArrangementItem[]) => {
      setArrangements((current) => {
        const next = updater(current);
        persistArrangements(next);
        return next;
      });
    },
    []
  );

  const patchArrangement = React.useCallback(
    (id: string, patch: Partial<ArrangementItem>) => {
      updateArrangements((current) =>
        current.map((arrangement) =>
          arrangement.id === id
            ? { ...arrangement, ...patch, updatedAt: Date.now() }
            : arrangement
        )
      );
    },
    [updateArrangements]
  );

  const handleCreateArrangement = (form: EditorForm) => {
    const nextArrangement = createManualArrangement(form);
    updateArrangements((current) => [nextArrangement, ...current]);
    setShowEditor(false);
    setActiveFilter("all");
  };

  const handleEditArrangement = (form: EditorForm) => {
    if (!editingArrangement) return;
    const timeFields = getArrangementTimeFieldsFromDraft(form.timeDraft);
    patchArrangement(editingArrangement.id, {
      title: form.title.trim(),
      note: form.note.trim() || undefined,
      timeKind: timeFields.timeKind,
      startAt: timeFields.startAt,
      endAt: timeFields.endAt,
      fuzzyTimeLabel: timeFields.fuzzyTimeLabel,
      location: form.location.trim() || undefined,
      people: splitPeopleInput(form.people),
    });
    setEditingArrangementId(null);
  };

  const handleConfirmCandidate = (form: EditorForm) => {
    if (!confirmingCandidate) return;
    const nextArrangement = createArrangementFromCandidate(confirmingCandidate, form);
    updateArrangements((current) => [nextArrangement, ...current]);
    const nextCandidates = updateArrangementCandidateStatus(confirmingCandidate.id, "confirmed");
    setCandidates(nextCandidates);
    setConfirmingCandidateId(null);
    setActiveFilter("all");
  };

  const handleIgnoreCandidate = (candidate: ArrangementCandidate) => {
    const nextCandidates = updateArrangementCandidateStatus(candidate.id, "ignored");
    setCandidates(nextCandidates);
    if (confirmingCandidateId === candidate.id) setConfirmingCandidateId(null);
  };

  const handleComplete = (arrangement: ArrangementItem) => {
    patchArrangement(arrangement.id, {
      status: "done",
      completedAt: Date.now(),
      laterAt: undefined,
    });
  };

  const handleMoveLater = (arrangement: ArrangementItem) => {
    patchArrangement(arrangement.id, {
      status: "later",
      laterAt: Date.now(),
      completedAt: undefined,
    });
  };

  const handleRestore = (arrangement: ArrangementItem) => {
    patchArrangement(arrangement.id, {
      status: "active",
      laterAt: undefined,
      completedAt: undefined,
    });
  };

  const handleArchive = (arrangement: ArrangementItem) => {
    patchArrangement(arrangement.id, { status: "archived" });
    setSelectedArrangementId(null);
  };

  return (
    <div className="flex h-full flex-col bg-bg">
      <header className="shrink-0 bg-bg px-4 pb-2 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-7 text-text">{t("arrangements.title")}</h1>
            <p className="mt-0.5 text-xs leading-5 text-text-tertiary">
              {t("arrangements.subtitle")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSearchBar((value) => !value)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-[8px] text-text-tertiary transition hover:bg-hover-overlay active:scale-[0.96]",
                (showSearchBar || searchQuery.trim()) && "text-primary"
              )}
              aria-label={t("arrangements.searchLabel")}
            >
              <SearchIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[24px] font-light leading-none text-on-primary shadow-soft transition active:scale-[0.96]"
              aria-label={t("arrangements.action.create")}
            >
              +
            </button>
          </div>
        </div>
        {!showSearchBar && searchQuery.trim() && (
          <div className="mt-2 flex items-center gap-2 text-[12px] leading-5 text-text-tertiary">
            <span className="min-w-0 flex-1 truncate">
              {t("arrangements.searchActive", { keyword: searchQuery.trim() })}
            </span>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="shrink-0 text-primary"
            >
              {t("arrangements.clear")}
            </button>
          </div>
        )}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ArrangementSearchPanel
          searchQuery={searchQuery}
          showSearchBar={showSearchBar}
          onSearchQueryChange={setSearchQuery}
          onCloseSearch={() => {
            setSearchQuery("");
            setShowSearchBar(false);
          }}
        />

        <TodaySpotlightSection
          arrangements={todaySpotlightArrangements}
          allVisibleArrangementsDone={allVisibleArrangementsDone}
          hasFutureActiveArrangements={hasFutureActiveArrangements}
          hasAnyVisibleArrangement={nonArchivedArrangements.length > 0}
          onOpen={(arrangement) => setSelectedArrangementId(arrangement.id)}
          onComplete={handleComplete}
          onRestore={handleRestore}
          onShowNear={() => setActiveFilter("near")}
          onShowDone={() => setActiveFilter("done")}
          onCreate={() => setShowEditor(true)}
        />

        <ArrangementCandidateSection
          candidates={pendingCandidates}
          onConfirm={(candidate) => setConfirmingCandidateId(candidate.id)}
          onIgnore={handleIgnoreCandidate}
          onOpenSource={onOpenCandidateSource}
        />

        <div className="sticky top-0 z-10 -mx-4 mt-3 bg-bg px-4 pb-2 pt-2">
          <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-surface p-1">
            {filters.map((filter) => {
              const active = filter.key === activeFilter;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => {
                    setActiveFilter(filter.key);
                    setShowSourceFilters(false);
                  }}
                  className={cn(
                    "h-8 rounded-[9px] text-[12px] font-medium transition active:scale-[0.98]",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-text-tertiary hover:bg-hover-overlay"
                  )}
                >
                  {t(filter.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        <ArrangementListSection
          title={t(getGroupTitleKey(activeFilter))}
          arrangements={visibleArrangements}
          sourceFilter={sourceFilter}
          showSourceFilters={showSourceFilters}
          hasActiveListFilters={Boolean(searchQuery.trim()) || sourceFilter !== "all"}
          onSourceFilterChange={(value) => {
            setSourceFilter(value);
            setShowSourceFilters(false);
          }}
          onToggleSourceFilters={() => setShowSourceFilters((value) => !value)}
          onOpen={(arrangement) => setSelectedArrangementId(arrangement.id)}
          onComplete={handleComplete}
          onRestore={handleRestore}
          onClearFilters={() => {
            setSearchQuery("");
            setSourceFilter("all");
            setShowSearchBar(false);
            setShowSourceFilters(false);
          }}
          onCreate={() => setShowEditor(true)}
        />
      </main>

      <ArrangementDetailSheet
        arrangement={selectedArrangement}
        onClose={() => setSelectedArrangementId(null)}
        onComplete={handleComplete}
        onMoveLater={handleMoveLater}
        onRestore={handleRestore}
        onEdit={(arrangement) => setEditingArrangementId(arrangement.id)}
        onArchive={handleArchive}
      />
      {showEditor && (
        <ArrangementEditorSheet
          mode="create"
          onClose={() => setShowEditor(false)}
          onSubmit={handleCreateArrangement}
        />
      )}
      {editingArrangement && (
        <ArrangementEditorSheet
          mode="edit"
          initialValue={getEditorFormFromArrangement(editingArrangement)}
          onClose={() => setEditingArrangementId(null)}
          onSubmit={handleEditArrangement}
        />
      )}
      {confirmingCandidate && (
        <ArrangementEditorSheet
          mode="confirm"
          initialValue={getEditorFormFromCandidate(confirmingCandidate)}
          onClose={() => setConfirmingCandidateId(null)}
          onSubmit={handleConfirmCandidate}
        />
      )}
    </div>
  );
}

function ArrangementCandidateSection({
  candidates,
  onConfirm,
  onIgnore,
  onOpenSource,
}: {
  candidates: ArrangementCandidate[];
  onConfirm: (candidate: ArrangementCandidate) => void;
  onIgnore: (candidate: ArrangementCandidate) => void;
  onOpenSource?: (sourceRef: ArrangementSourceRef) => void;
}) {
  const { t, resolvedLocale } = usePreferences();
  if (candidates.length === 0) return null;

  return (
    <section className="mt-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold leading-5 text-text-muted">
          {t("arrangements.candidate.title")}
        </h2>
        <span className="text-[11px] leading-4 text-text-tertiary">
          {t("arrangements.candidate.count", { count: candidates.length })}
        </span>
      </div>
      <div className="space-y-2">
        {candidates.map((candidate) => (
          <article
            key={candidate.id}
            className="rounded-[12px] border border-[var(--record-card-border)] bg-surface px-3 py-3 shadow-[var(--mine-card-shadow)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-5 text-text">
                  {candidate.title}
                </h3>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {candidate.createdBy === "ai" && (
                  <MetaPill label={t("arrangements.candidate.aiSuggestion")} tone="primary" />
                )}
                {candidate.sourceRefs && candidate.sourceRefs.length > 1 && (
                  <MetaPill label={t("arrangements.candidate.globalLinked")} tone="primary" />
                )}
                {candidate.sourceRefs && candidate.sourceRefs.length > 1 && (
                  <MetaPill
                    label={t("arrangements.candidate.sourceCount", {
                      count: candidate.sourceRefs.length,
                    })}
                  />
                )}
                {!candidate.sourceRefs?.length &&
                  typeof candidate.globalMergeConfidence === "number" &&
                  candidate.globalMergeConfidence > 0 &&
                  candidate.globalMergeConfidence < 0.82 && (
                    <MetaPill label={t("arrangements.candidate.possibleLink")} />
                  )}
                <MetaPill label={t(getSourceTypeLabelKey(candidate.sourceType))} />
              </div>
            </div>
            {candidate.note && (
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-text-tertiary">
                {candidate.note}
              </p>
            )}
            {candidate.createdBy === "ai" && candidate.reason && (
              <p className="mt-2 line-clamp-2 text-[12px] leading-5 text-text-tertiary">
                {t("arrangements.candidate.reason", { reason: candidate.reason })}
              </p>
            )}
            {candidate.createdBy === "ai" && typeof candidate.confidence === "number" && (
              <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                {t("arrangements.candidate.confidence", {
                  percent: Math.round(candidate.confidence * 100),
                })}
              </p>
            )}
            {(candidate.location || (candidate.people && candidate.people.length > 0)) && (
              <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
                {[candidate.location, candidate.people?.join(getListSeparator(resolvedLocale))]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-text-muted">
              {t("arrangements.candidate.source", { excerpt: candidate.sourceRef.excerpt })}
            </p>
            {candidate.sourceRefs && candidate.sourceRefs.length > 1 && (
              <div className="mt-2 space-y-1">
                {candidate.sourceRefs.slice(0, 3).map((sourceRef) => (
                  <button
                    key={`${sourceRef.type}-${sourceRef.id}`}
                    type="button"
                    onClick={() => onOpenSource?.(sourceRef)}
                    className="block w-full truncate text-left text-[11px] leading-4 text-text-tertiary hover:text-primary disabled:hover:text-text-tertiary"
                    disabled={!onOpenSource}
                  >
                    {sourceRef.title} · {sourceRef.excerpt}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => onConfirm(candidate)}
                className="h-9 rounded-[11px] bg-primary text-[13px] font-medium text-on-primary transition active:scale-[0.98]"
              >
                {t("arrangements.candidate.confirm")}
              </button>
              <button
                type="button"
                onClick={() => onIgnore(candidate)}
                className="h-9 rounded-[11px] border border-border-light bg-surface text-[13px] font-medium text-text-muted transition hover:bg-hover-overlay active:scale-[0.98]"
              >
                {t("arrangements.candidate.ignore")}
              </button>
              <button
                type="button"
                onClick={() => onOpenSource?.(candidate.sourceRef)}
                className="h-9 rounded-[11px] border border-border-light bg-surface text-[13px] font-medium text-text-muted transition hover:bg-hover-overlay active:scale-[0.98] disabled:opacity-45"
                disabled={!onOpenSource}
              >
                {t("arrangements.candidate.openSource")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TodaySpotlightSection({
  arrangements,
  allVisibleArrangementsDone,
  hasFutureActiveArrangements,
  hasAnyVisibleArrangement,
  onOpen,
  onComplete,
  onRestore,
  onShowNear,
  onShowDone,
  onCreate,
}: {
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
}) {
  const { t } = usePreferences();

  if (arrangements.length > 0) {
    return (
      <section className="pt-1">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold leading-5 text-text-muted">
            {t("arrangements.today.title")}
          </h2>
          <span className="text-[11px] leading-4 text-text-tertiary">
            {t("arrangements.today.count", { count: arrangements.length })}
          </span>
        </div>
        <div className="space-y-2">
          {arrangements.map((arrangement) => (
            <ArrangementCard
              key={arrangement.id}
              arrangement={arrangement}
              spotlight
              onOpen={() => onOpen(arrangement)}
              onComplete={() => onComplete(arrangement)}
              onRestore={() => onRestore(arrangement)}
            />
          ))}
        </div>
      </section>
    );
  }

  if (allVisibleArrangementsDone) {
    return (
      <SpotlightMessage
        title={t("arrangements.today.doneTitle")}
        description={t("arrangements.today.doneDesc")}
        actionLabel={t("arrangements.today.doneAction")}
        onAction={onShowDone}
      />
    );
  }

  if (!hasAnyVisibleArrangement) {
    return (
      <SpotlightMessage
        title={t("arrangements.today.emptyTitle")}
        description={t("arrangements.today.emptyDesc")}
        actionLabel={t("arrangements.today.emptyAction")}
        onAction={onCreate}
      />
    );
  }

  if (hasFutureActiveArrangements) {
    return (
      <SpotlightMessage
        title={t("arrangements.today.calmTitle")}
        description={t("arrangements.today.futureDesc")}
        actionLabel={t("arrangements.today.futureAction")}
        onAction={onShowNear}
      />
    );
  }

  return (
    <SpotlightMessage
      title={t("arrangements.today.calmTitle")}
      description={t("arrangements.today.noTodayDesc")}
    />
  );
}

function SpotlightMessage({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { t } = usePreferences();

  return (
    <section className="pt-1">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold leading-5 text-text-muted">{title}</h2>
        <span className="text-[11px] leading-4 text-text-tertiary">
          {t("arrangements.today.count", { count: 0 })}
        </span>
      </div>
      <div className="rounded-[12px] bg-surface px-3 py-4 text-sm leading-5 text-text-tertiary">
        <p>{description}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-3 rounded-full bg-primary-soft px-3 py-1.5 text-[12px] font-medium text-primary transition active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}

function ArrangementSearchPanel({
  searchQuery,
  showSearchBar,
  onSearchQueryChange,
  onCloseSearch,
}: {
  searchQuery: string;
  showSearchBar: boolean;
  onSearchQueryChange: (value: string) => void;
  onCloseSearch: () => void;
}) {
  const { t } = usePreferences();
  if (!showSearchBar) return null;

  return (
    <div className="pb-3 pt-1">
      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("arrangements.searchLabel")}</span>
          <input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder={t("arrangements.searchPlaceholder")}
            className="h-10 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[13px] text-text shadow-soft outline-none placeholder:text-input-placeholder focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
            autoFocus
          />
        </label>
        <button
          type="button"
          onClick={onCloseSearch}
          className="h-10 shrink-0 px-2 text-[13px] font-medium text-text-tertiary transition hover:text-text active:scale-[0.98]"
        >
          {t("search.cancel")}
        </button>
      </div>
    </div>
  );
}

function ArrangementSourceDropdown({
  sourceFilter,
  showSourceFilters,
  onSourceFilterChange,
  onToggleSourceFilters,
}: {
  sourceFilter: ArrangementSourceFilter;
  showSourceFilters: boolean;
  onSourceFilterChange: (value: ArrangementSourceFilter) => void;
  onToggleSourceFilters: () => void;
}) {
  const { t } = usePreferences();
  const currentLabel = t(getSourceFilterLabelKey(sourceFilter));

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={onToggleSourceFilters}
        className={cn(
          "h-7 max-w-[156px] truncate rounded-[8px] px-2 text-right text-[12px] font-medium leading-5 text-text-tertiary transition hover:bg-hover-overlay hover:text-text active:scale-[0.98]",
          sourceFilter !== "all" && "bg-primary-soft text-primary hover:text-primary"
        )}
        aria-expanded={showSourceFilters}
      >
        {t("arrangements.sourcePrefix", { source: currentLabel })}
      </button>
      {showSourceFilters && (
        <div className="absolute right-0 top-full z-20 mt-1 w-[160px] overflow-hidden rounded-[12px] border border-border-light bg-[var(--dialog-bg)] p-1 shadow-[0_10px_28px_rgba(0,0,0,0.14)]">
          {sourceFilters.map((filter) => {
            const active = filter.key === sourceFilter;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => onSourceFilterChange(filter.key)}
                className={cn(
                  "flex h-8 w-full items-center rounded-[9px] px-2 text-left text-[12px] font-medium transition active:scale-[0.98]",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-text-tertiary hover:bg-hover-overlay hover:text-text"
                )}
              >
                {t(filter.labelKey)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ArrangementListSection({
  title,
  arrangements,
  sourceFilter,
  showSourceFilters,
  hasActiveListFilters,
  onSourceFilterChange,
  onToggleSourceFilters,
  onOpen,
  onComplete,
  onRestore,
  onClearFilters,
  onCreate,
}: {
  title: string;
  arrangements: ArrangementItem[];
  sourceFilter: ArrangementSourceFilter;
  showSourceFilters: boolean;
  hasActiveListFilters: boolean;
  onSourceFilterChange: (value: ArrangementSourceFilter) => void;
  onToggleSourceFilters: () => void;
  onOpen: (arrangement: ArrangementItem) => void;
  onComplete: (arrangement: ArrangementItem) => void;
  onRestore: (arrangement: ArrangementItem) => void;
  onClearFilters: () => void;
  onCreate: () => void;
}) {
  const { t } = usePreferences();

  return (
    <section className="space-y-3">
      <div className="relative mb-2 flex items-center justify-between gap-3">
        <h2 className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5 text-text-muted">
          {title}
        </h2>
        <ArrangementSourceDropdown
          sourceFilter={sourceFilter}
          showSourceFilters={showSourceFilters}
          onSourceFilterChange={onSourceFilterChange}
          onToggleSourceFilters={onToggleSourceFilters}
        />
      </div>

      {arrangements.length > 0 ? (
        <div className="space-y-2">
          {arrangements.map((arrangement) => (
            <ArrangementCard
              key={arrangement.id}
              arrangement={arrangement}
              onOpen={() => onOpen(arrangement)}
              onComplete={() => onComplete(arrangement)}
              onRestore={() => onRestore(arrangement)}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-[300px] items-center justify-center">
          <EmptyState
            title={
              hasActiveListFilters
                ? t("arrangements.empty.noMatches")
                : t("arrangements.empty.noItems")
            }
            description={
              hasActiveListFilters
                ? t("arrangements.empty.noMatchesDesc")
                : t("arrangements.empty.noItemsDesc")
            }
            action={
              hasActiveListFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition active:scale-[0.98]"
                >
                  {t("arrangements.empty.clearFilters")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCreate}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition active:scale-[0.98]"
                >
                  {t("arrangements.action.create")}
                </button>
              )
            }
          />
        </div>
      )}
    </section>
  );
}

function ArrangementCard({
  arrangement,
  spotlight,
  onOpen,
  onComplete,
  onRestore,
}: {
  arrangement: ArrangementItem;
  spotlight?: boolean;
  onOpen: () => void;
  onComplete: () => void;
  onRestore: () => void;
}) {
  const { t, resolvedLocale } = usePreferences();
  const done = arrangement.status === "done";
  const later = arrangement.status === "later";

  return (
    <article
      className={cn(
        "rounded-[12px] border border-[var(--record-card-border)] bg-surface px-3 py-3 shadow-[var(--mine-card-shadow)] transition active:scale-[0.995]",
        spotlight && "border-primary bg-primary-soft"
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (done) {
              onRestore();
            } else {
              onComplete();
            }
          }}
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[13px] transition active:scale-[0.9]",
            done
              ? "border-primary bg-primary text-on-primary"
              : "border-border-strong bg-surface text-transparent"
          )}
          aria-label={
            done ? t("arrangements.action.restoreAria") : t("arrangements.action.completeAria")
          }
        >
          ✓
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
          <div className="flex items-start justify-between gap-2">
            <h3
              className={cn(
                "min-w-0 text-[15px] font-semibold leading-5 text-text",
                done && "text-text-tertiary line-through"
              )}
            >
              {arrangement.title}
            </h3>
            {later && <MetaPill label={t("arrangements.status.later")} />}
            {done && <MetaPill label={t("arrangements.status.done")} tone="primary" />}
          </div>
          <p className="mt-1 text-[12px] leading-5 text-text-tertiary">
            {formatArrangementMeta(arrangement, t, resolvedLocale)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <MetaPill label={t(getSourceTypeLabelKey(arrangement.sourceType))} />
            {arrangement.aiCapability !== "userOnly" && (
              <MetaPill
                label={t(getAiCapabilityLabelKey(arrangement.aiCapability))}
                tone="primary"
              />
            )}
            {arrangement.sourceRefs.length > 1 && (
              <MetaPill
                label={t("arrangements.contextCount", {
                  count: arrangement.sourceRefs.length,
                })}
              />
            )}
          </div>
        </button>
      </div>
    </article>
  );
}

function ArrangementDetailSheet({
  arrangement,
  onClose,
  onComplete,
  onMoveLater,
  onRestore,
  onEdit,
  onArchive,
}: {
  arrangement: ArrangementItem | null;
  onClose: () => void;
  onComplete: (arrangement: ArrangementItem) => void;
  onMoveLater: (arrangement: ArrangementItem) => void;
  onRestore: (arrangement: ArrangementItem) => void;
  onEdit: (arrangement: ArrangementItem) => void;
  onArchive: (arrangement: ArrangementItem) => void;
}) {
  const { t, resolvedLocale } = usePreferences();
  if (!arrangement) return null;

  const canRestore = arrangement.status === "later" || arrangement.status === "done";
  const canComplete = arrangement.status !== "done";
  const canMoveLater = arrangement.status === "active";

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-label={t("arrangements.detail.close")}
      />
      <section
        className="relative z-10 flex max-h-[86%] w-full flex-col overflow-hidden rounded-t-[16px] border border-border-light bg-[var(--dialog-bg)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={t("arrangements.detail.title")}
      >
        <header className="shrink-0 border-b border-border-light px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-fill-2" />
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-5 text-text">
              {t("arrangements.detail.title")}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition hover:bg-hover-overlay hover:text-text active:scale-[0.96]"
              aria-label={t("arrangements.detail.close")}
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-4">
          <h3 className="text-[18px] font-semibold leading-7 text-text">
            {arrangement.title}
          </h3>
          {arrangement.note && (
            <p className="mt-2 whitespace-pre-wrap text-[14px] leading-6 text-text-muted">
              {arrangement.note}
            </p>
          )}

          <div className="mt-4 space-y-3 rounded-[12px] bg-[var(--record-detail-muted-bg)] px-3 py-3">
            <DetailRow
              label={t("arrangements.detail.status")}
              value={t(getStatusLabelKey(arrangement.status))}
            />
            <DetailRow
              label={t("arrangements.detail.time")}
              value={formatArrangementTime(arrangement, t, resolvedLocale)}
            />
            <DetailRow
              label={t("arrangements.detail.location")}
              value={arrangement.location || t("arrangements.detail.noLocation")}
            />
            <DetailRow
              label={t("arrangements.detail.people")}
              value={
                arrangement.people.length > 0
                  ? arrangement.people.join(getListSeparator(resolvedLocale))
                  : t("arrangements.detail.noPeople")
              }
            />
            <DetailRow
              label={t("arrangements.detail.source")}
              value={t(getSourceTypeLabelKey(arrangement.sourceType))}
            />
            <DetailRow
              label={t("arrangements.detail.aiCapability")}
              value={t(getAiCapabilityLabelKey(arrangement.aiCapability))}
            />
          </div>

          <section className="mt-4">
            <h4 className="text-[13px] font-semibold leading-5 text-text-muted">
              {t("arrangements.detail.context")}
            </h4>
            <div className="mt-2 space-y-2">
              {arrangement.sourceRefs.map((sourceRef) => (
                <div
                  key={sourceRef.id}
                  className="rounded-[10px] border border-border-light bg-surface px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium leading-5 text-text-muted">
                        {sourceRef.title}
                      </p>
                      <p className="truncate text-[11px] leading-4 text-text-tertiary">
                        {formatSourceContextTime(sourceRef.createdAt, resolvedLocale, t)}
                      </p>
                    </div>
                    <MetaPill label={t(getSourceTypeLabelKey(sourceRef.type))} />
                  </div>
                  <p className="mt-0.5 text-[13px] leading-5 text-text">
                    {sourceRef.excerpt}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className="shrink-0 border-t border-border-light bg-[var(--dialog-bg)] px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {canComplete && (
              <ActionButton
                label={t("arrangements.action.complete")}
                primary
                onClick={() => onComplete(arrangement)}
              />
            )}
            {canMoveLater && (
              <ActionButton
                label={t("arrangements.action.moveLater")}
                onClick={() => onMoveLater(arrangement)}
              />
            )}
            {canRestore && (
              <ActionButton
                label={t("arrangements.action.restore")}
                primary
                onClick={() => onRestore(arrangement)}
              />
            )}
            <ActionButton label={t("arrangements.action.edit")} onClick={() => onEdit(arrangement)} />
            <ActionButton
              label={t("arrangements.action.archive")}
              onClick={() => onArchive(arrangement)}
            />
          </div>
        </footer>
      </section>
    </div>
  );
}

function ArrangementEditorSheet({
  mode,
  initialValue,
  onClose,
  onSubmit,
}: {
  mode: EditorMode;
  initialValue?: EditorForm;
  onClose: () => void;
  onSubmit: (form: EditorForm) => void;
}) {
  const { t } = usePreferences();
  const [form, setForm] = React.useState<EditorForm>(initialValue ?? emptyEditorForm);
  const canSubmit = form.title.trim().length > 0;
  const title = t(getEditorTitleKey(mode));
  const submitLabel = t(getEditorSubmitKey(mode));
  const closeLabel = t(getEditorCloseKey(mode));

  const updateField = <Key extends keyof EditorForm>(key: Key, value: EditorForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay"
        onClick={onClose}
        aria-label={closeLabel}
      />
      <section
        className="relative z-10 flex max-h-[88%] w-full flex-col overflow-hidden rounded-t-[16px] border border-border-light bg-[var(--dialog-bg)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="shrink-0 border-b border-border-light px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-fill-2" />
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-5 text-text">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition hover:bg-hover-overlay hover:text-text active:scale-[0.96]"
              aria-label={closeLabel}
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <label className="block">
            <span className="text-[13px] font-medium leading-5 text-text-muted">
              {t("arrangements.editor.content")}
            </span>
            <textarea
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder={t("arrangements.editor.contentPlaceholder")}
              className="mt-2 min-h-[88px] w-full resize-none rounded-[12px] border border-transparent bg-surface px-3 py-3 text-[15px] leading-6 text-text shadow-soft outline-none placeholder:text-input-placeholder focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
            />
          </label>

          <div>
            <p className="text-[13px] font-medium leading-5 text-text-muted">
              {t("arrangements.editor.time")}
            </p>
            <TimeDraftSelector
              value={form.timeDraft}
              onChange={(value) => updateField("timeDraft", value)}
            />
            <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
              {t("arrangements.editor.timeHint")}
            </p>
          </div>

          <TextField
            label={t("arrangements.editor.location")}
            value={form.location}
            placeholder={t("arrangements.editor.locationPlaceholder")}
            onChange={(value) => updateField("location", value)}
          />
          <TextField
            label={t("arrangements.editor.people")}
            value={form.people}
            placeholder={t("arrangements.editor.peoplePlaceholder")}
            onChange={(value) => updateField("people", value)}
          />
          <TextField
            label={t("arrangements.editor.note")}
            value={form.note}
            placeholder={t("arrangements.editor.notePlaceholder")}
            onChange={(value) => updateField("note", value)}
          />
        </div>

        <footer className="shrink-0 border-t border-border-light px-4 py-3">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              onSubmit(form);
            }}
            className="h-11 w-full rounded-[12px] bg-primary text-[15px] font-semibold text-on-primary transition active:scale-[0.98] disabled:opacity-50"
          >
            {submitLabel}
          </button>
        </footer>
      </section>
    </div>
  );
}

type TimeQuickOption = {
  key: string;
  labelKey: string;
  draft: ArrangementTimeDraft;
};

const timeQuickOptions: TimeQuickOption[] = [
  { key: "none", labelKey: "arrangements.time.none", draft: { kind: "none" } },
  { key: "today", labelKey: "arrangements.time.today", draft: { kind: "relativeDay", day: "today" } },
  {
    key: "tomorrow",
    labelKey: "arrangements.time.tomorrow",
    draft: { kind: "relativeDay", day: "tomorrow" },
  },
  { key: "weekday", labelKey: "arrangements.time.weekday", draft: { kind: "weekday", weekday: 1 } },
  { key: "date", labelKey: "arrangements.time.date", draft: { kind: "date", date: getTodayInputValue() } },
];

const weekdayOptions: Array<{ key: 1 | 2 | 3 | 4 | 5 | 6 | 0; labelKey: string }> = [
  { key: 1, labelKey: "arrangements.time.weekday.1" },
  { key: 2, labelKey: "arrangements.time.weekday.2" },
  { key: 3, labelKey: "arrangements.time.weekday.3" },
  { key: 4, labelKey: "arrangements.time.weekday.4" },
  { key: 5, labelKey: "arrangements.time.weekday.5" },
  { key: 6, labelKey: "arrangements.time.weekday.6" },
  { key: 0, labelKey: "arrangements.time.weekday.0" },
];

const timePartOptions: Array<{
  key: ArrangementTimePart | undefined;
  labelKey: string;
}> = [
  { key: undefined, labelKey: "arrangements.time.part.any" },
  { key: "morning", labelKey: "arrangements.time.part.morning" },
  { key: "afternoon", labelKey: "arrangements.time.part.afternoon" },
  { key: "evening", labelKey: "arrangements.time.part.evening" },
];

function TimeDraftSelector({
  value,
  onChange,
}: {
  value: ArrangementTimeDraft;
  onChange: (value: ArrangementTimeDraft) => void;
}) {
  const { t } = usePreferences();
  const activeQuickKey = getActiveTimeQuickKey(value);
  const showClockInput = value.kind !== "none";

  const updatePart = (part: ArrangementTimePart | undefined) => {
    if (value.kind === "none") return;
    onChange({ ...value, part, clock: undefined });
  };

  const updateClock = (clock: string) => {
    if (value.kind === "none") return;
    onChange({ ...value, clock });
  };

  return (
    <div className="mt-2 space-y-2 rounded-[14px] bg-surface p-2 shadow-soft">
      <div className="space-y-1.5">
        <p className="px-1 text-[11px] font-medium leading-4 text-text-tertiary">
          {t("arrangements.time.pickDate")}
        </p>
        <div className="grid grid-cols-3 gap-1">
          {timeQuickOptions.map((option) => {
            const active = activeQuickKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => onChange(option.draft)}
                className={cn(
                  "h-9 rounded-[9px] text-[12px] font-medium transition active:scale-[0.98]",
                  active
                    ? "bg-primary-soft text-primary"
                    : "text-text-tertiary hover:bg-hover-overlay"
                )}
              >
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {value.kind === "weekday" && (
        <div className="space-y-1.5">
          <p className="px-1 text-[11px] font-medium leading-4 text-text-tertiary">
            {t("arrangements.time.pickWeekday")}
          </p>
          <div className="grid grid-cols-7 gap-1">
            {weekdayOptions.map((option) => {
              const active = value.weekday === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onChange({ ...value, weekday: option.key })}
                  className={cn(
                    "h-8 rounded-[9px] text-[12px] font-medium transition active:scale-[0.98]",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-text-tertiary hover:bg-hover-overlay"
                  )}
                >
                  {t(option.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.kind === "date" && (
        <label className="block space-y-1.5">
          <span className="px-1 text-[11px] font-medium leading-4 text-text-tertiary">
            {t("arrangements.time.pickDate")}
          </span>
          <input
            type="date"
            value={value.date}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
            className="h-10 w-full rounded-[10px] border border-border-light bg-[var(--input-bg)] px-3 text-[14px] text-text outline-none placeholder:text-input-placeholder focus:bg-[var(--input-bg-focus)] focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
            style={{ colorScheme: "light dark" }}
          />
        </label>
      )}

      {showClockInput && (
        <div className="space-y-2">
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] font-medium leading-4 text-text-tertiary">
              {t("arrangements.time.pickPart")}
            </p>
            <div className="grid grid-cols-4 gap-1">
              {timePartOptions.map((option) => {
                const active = getDraftPart(value) === option.key && !getDraftClock(value);
                return (
                  <button
                    key={option.labelKey}
                    type="button"
                    onClick={() => updatePart(option.key)}
                    className={cn(
                      "h-8 rounded-[9px] text-[12px] font-medium transition active:scale-[0.98]",
                      active
                        ? "bg-primary-soft text-primary"
                        : "text-text-tertiary hover:bg-hover-overlay"
                    )}
                  >
                    {t(option.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block space-y-1.5">
            <span className="px-1 text-[11px] font-medium leading-4 text-text-tertiary">
              {t("arrangements.time.pickClock")}
            </span>
            <input
              type="time"
              value={getDraftClock(value)}
              onChange={(event) => updateClock(event.target.value)}
              className="h-10 w-full rounded-[10px] border border-border-light bg-[var(--input-bg)] px-3 text-[14px] text-text outline-none placeholder:text-input-placeholder focus:bg-[var(--input-bg-focus)] focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
              style={{ colorScheme: "light dark" }}
              aria-label={t("arrangements.time.clockAria")}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium leading-5 text-text-muted">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-11 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[14px] text-text shadow-soft outline-none placeholder:text-input-placeholder focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
      />
    </label>
  );
}

function ActionButton({
  label,
  primary,
  onClick,
}: {
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-10 rounded-[12px] text-[14px] font-medium transition active:scale-[0.98]",
        primary
          ? "bg-primary text-on-primary"
          : "border border-border-light bg-surface text-text-muted"
      )}
    >
      {label}
    </button>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 text-[13px] leading-5">
      <span className="w-[58px] shrink-0 text-text-tertiary">{label}</span>
      <div className="min-w-0 flex-1 text-text">{value}</div>
    </div>
  );
}

function isVisibleForFilter(arrangement: ArrangementItem, filter: ArrangementFilter) {
  if (arrangement.status === "archived") return false;
  if (filter === "all") return true;
  if (filter === "near") return arrangement.status === "active";
  if (filter === "later") return arrangement.status === "later";
  return arrangement.status === "done";
}

function shouldShowInTodaySpotlight(arrangement: ArrangementItem, now = Date.now()) {
  if (arrangement.status !== "active") return false;
  if (arrangement.timeKind === "none") return false;
  if (!arrangement.startAt) return false;
  return isToday(arrangement.startAt, now);
}

function isToday(timestamp: number, now = Date.now()) {
  const target = new Date(timestamp);
  const current = new Date(now);
  return (
    target.getFullYear() === current.getFullYear() &&
    target.getMonth() === current.getMonth() &&
    target.getDate() === current.getDate()
  );
}

function compareByTimeThenAttention(a: ArrangementItem, b: ArrangementItem) {
  const timeDiff = (a.startAt ?? Number.MAX_SAFE_INTEGER) - (b.startAt ?? Number.MAX_SAFE_INTEGER);
  if (timeDiff !== 0) return timeDiff;
  return b.attentionScore - a.attentionScore;
}

function matchesSearchQuery(arrangement: ArrangementItem, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  const searchableText = [
    arrangement.title,
    arrangement.note,
    arrangement.location,
    arrangement.people.join(" "),
    ...arrangement.sourceRefs.flatMap((sourceRef) => [
      sourceRef.title,
      sourceRef.excerpt,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return searchableText.includes(keyword);
}

function matchesSourceFilter(
  arrangement: ArrangementItem,
  filter: ArrangementSourceFilter
) {
  if (filter === "all") return true;
  return (
    arrangement.sourceType === filter ||
    arrangement.sourceRefs.some((sourceRef) => sourceRef.type === filter)
  );
}

function getSourceFilterLabelKey(filter: ArrangementSourceFilter) {
  return sourceFilters.find((item) => item.key === filter)?.labelKey ?? "arrangements.source.all";
}

function getSourceTypeLabelKey(type: ArrangementSourceType) {
  return `arrangements.source.${type}`;
}

function getEditorFormFromArrangement(arrangement: ArrangementItem): EditorForm {
  return {
    title: arrangement.title,
    timeDraft: getTimeDraftFromArrangement(arrangement),
    location: arrangement.location ?? "",
    people: arrangement.people.join("、"),
    note: arrangement.note ?? "",
  };
}

function getEditorFormFromCandidate(candidate: ArrangementCandidate): EditorForm {
  return {
    title: candidate.title,
    timeDraft: candidate.timeDraft ?? { kind: "none" },
    location: candidate.location ?? "",
    people: candidate.people?.join("、") ?? "",
    note: candidate.note ?? "",
  };
}

function getTimePresetFromArrangement(arrangement: ArrangementItem): ArrangementTimePreset {
  if (!arrangement.startAt) return "none";
  if (isToday(arrangement.startAt)) return "today";
  if (isTomorrow(arrangement.startAt)) return "tomorrow";
  if (arrangement.fuzzyTimeLabel?.includes("周末")) return "weekend";
  return "none";
}

function getTimeDraftFromArrangement(arrangement: ArrangementItem): ArrangementTimeDraft {
  if (!arrangement.startAt) return { kind: "none" };

  const date = new Date(arrangement.startAt);
  const part = getTimePartFromLabel(arrangement.fuzzyTimeLabel);
  const clock = arrangement.timeKind === "deadline" ? getClockInputValue(date) : undefined;

  if (isToday(arrangement.startAt)) {
    return { kind: "relativeDay", day: "today", part, clock };
  }

  if (isTomorrow(arrangement.startAt)) {
    return { kind: "relativeDay", day: "tomorrow", part, clock };
  }

  if (
    arrangement.fuzzyTimeLabel?.includes("周") ||
    arrangement.fuzzyTimeLabel?.toLowerCase().includes("week") ||
    getTimePresetFromArrangement(arrangement) === "weekend"
  ) {
    return {
      kind: "weekday",
      weekday: date.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      part,
      clock,
    };
  }

  return { kind: "date", date: getDateInputValue(date), part, clock };
}

function getActiveTimeQuickKey(value: ArrangementTimeDraft) {
  if (value.kind === "none") return "none";
  if (value.kind === "weekday") return "weekday";
  if (value.kind === "date") return "date";
  if (value.day === "today") return "today";
  return "tomorrow";
}

function getDraftPart(value: ArrangementTimeDraft): ArrangementTimePart | undefined {
  if (value.kind === "none") return undefined;
  return value.part;
}

function getDraftClock(value: ArrangementTimeDraft) {
  if (value.kind === "none") return "";
  return value.clock ?? "";
}

function getTimePartFromLabel(label?: string): ArrangementTimePart | undefined {
  if (!label) return undefined;
  const normalizedLabel = label.toLowerCase();
  if (label.includes("上午") || normalizedLabel.includes("morning")) return "morning";
  if (label.includes("下午") || normalizedLabel.includes("afternoon")) return "afternoon";
  if (label.includes("晚上") || normalizedLabel.includes("evening")) return "evening";
  return undefined;
}

function getTodayInputValue() {
  return getDateInputValue(new Date());
}

function getDateInputValue(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getClockInputValue(date: Date) {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function isTomorrow(timestamp: number, now = Date.now()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(timestamp);
  return (
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate()
  );
}

function splitPeopleInput(value: string) {
  return value
    .split(/[、，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getGroupTitleKey(filter: ArrangementFilter) {
  if (filter === "near") return "arrangements.group.near";
  if (filter === "later") return "arrangements.group.later";
  if (filter === "done") return "arrangements.group.done";
  return "arrangements.group.all";
}

function formatArrangementMeta(
  arrangement: ArrangementItem,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string
) {
  const parts = [formatArrangementTime(arrangement, t, locale)];
  if (arrangement.location) parts.push(arrangement.location);
  if (arrangement.people.length > 0) {
    parts.push(arrangement.people.join(getListSeparator(locale)));
  }
  return parts.filter(Boolean).join(" · ");
}

function formatArrangementTime(
  arrangement: ArrangementItem,
  t: (key: string, values?: Record<string, string | number>) => string,
  locale: string
) {
  if (arrangement.startAt) {
    return formatTimeLabel(arrangement.startAt, {
      locale,
      today: t("arrangements.time.today"),
      yesterday: t("time.yesterday"),
      dayBeforeYesterday: t("time.dayBeforeYesterday"),
    });
  }

  if (arrangement.fuzzyTimeLabel && !isLegacyNoTimeLabel(arrangement.fuzzyTimeLabel)) {
    return arrangement.fuzzyTimeLabel;
  }

  return t("arrangements.time.noTime");
}

function formatSourceContextTime(
  timestamp: number,
  locale: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  const date = new Date(timestamp);
  const now = new Date();
  const time = `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;

  if (isToday(timestamp, now.getTime())) return `${t("time.today")} ${time}`;
  if (isYesterday(timestamp, now.getTime())) return `${t("time.yesterday")} ${time}`;
  if (isDayBeforeYesterday(timestamp, now.getTime())) {
    return `${t("time.dayBeforeYesterday")} ${time}`;
  }

  return `${formatSourceContextDate(date, now, locale)} ${time}`;
}

function isYesterday(timestamp: number, now = Date.now()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(timestamp);
  return (
    target.getFullYear() === yesterday.getFullYear() &&
    target.getMonth() === yesterday.getMonth() &&
    target.getDate() === yesterday.getDate()
  );
}

function isDayBeforeYesterday(timestamp: number, now = Date.now()) {
  const dayBeforeYesterday = new Date(now);
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  const target = new Date(timestamp);
  return (
    target.getFullYear() === dayBeforeYesterday.getFullYear() &&
    target.getMonth() === dayBeforeYesterday.getMonth() &&
    target.getDate() === dayBeforeYesterday.getDate()
  );
}

function formatSourceContextDate(date: Date, now: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function isLegacyNoTimeLabel(label: string) {
  return (
    label === "还没有时间" ||
    label === "No time yet" ||
    label.includes("没有时间") ||
    label.toLowerCase().includes("no time")
  );
}

function getStatusLabelKey(status: ArrangementStatus) {
  return `arrangements.status.${status}`;
}

function getAiCapabilityLabelKey(capability: ArrangementAiCapability) {
  return `arrangements.aiCapability.${capability}`;
}

function getEditorTitleKey(mode: EditorMode) {
  if (mode === "edit") return "arrangements.editor.editTitle";
  if (mode === "confirm") return "arrangements.editor.confirmTitle";
  return "arrangements.editor.createTitle";
}

function getEditorSubmitKey(mode: EditorMode) {
  if (mode === "edit") return "arrangements.editor.saveChanges";
  if (mode === "confirm") return "arrangements.editor.saveCandidate";
  return "arrangements.editor.save";
}

function getEditorCloseKey(mode: EditorMode) {
  if (mode === "edit") return "arrangements.editor.closeEdit";
  if (mode === "confirm") return "arrangements.editor.closeConfirm";
  return "arrangements.editor.closeCreate";
}

function getListSeparator(locale: string) {
  return locale.startsWith("en") ? ", " : "、";
}

function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
