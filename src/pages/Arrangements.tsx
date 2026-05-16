import React from "react";
import EmptyState from "@/components/EmptyState";
import {
  createManualArrangement,
  getArrangementTimeFieldsForPreset,
  getInitialArrangements,
  getSourceTypeLabel,
  persistArrangements,
  type ArrangementTimePreset,
} from "@/data/arrangements";
import { formatTimeLabel } from "@/lib/time";
import { cn } from "@/lib/utils";
import type {
  ArrangementAiCapability,
  ArrangementItem,
  ArrangementSourceType,
  ArrangementStatus,
} from "@/types/arrangement";

type ArrangementFilter = "all" | "near" | "later" | "done";
type ArrangementSourceFilter = "all" | ArrangementSourceType;
type EditorMode = "create" | "edit";

type EditorForm = {
  title: string;
  timePreset: ArrangementTimePreset;
  location: string;
  people: string;
  note: string;
};

const filters: Array<{ key: ArrangementFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "near", label: "近期" },
  { key: "later", label: "以后再说" },
  { key: "done", label: "已完成" },
];

const sourceFilters: Array<{ key: ArrangementSourceFilter; label: string }> = [
  { key: "all", label: "全部来源" },
  { key: "manual", label: "手动" },
  { key: "sendToSelf", label: "发给自己" },
  { key: "privateChat", label: "私聊" },
  { key: "groupChat", label: "群聊" },
  { key: "aiSuggestion", label: "AI 建议" },
];

const emptyEditorForm: EditorForm = {
  title: "",
  timePreset: "none",
  location: "",
  people: "",
  note: "",
};

export default function Arrangements() {
  const [arrangements, setArrangements] = React.useState(getInitialArrangements);
  const [activeFilter, setActiveFilter] = React.useState<ArrangementFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [sourceFilter, setSourceFilter] = React.useState<ArrangementSourceFilter>("all");
  const [selectedArrangementId, setSelectedArrangementId] = React.useState<string | null>(null);
  const [showEditor, setShowEditor] = React.useState(false);
  const [editingArrangementId, setEditingArrangementId] = React.useState<string | null>(null);

  const selectedArrangement =
    arrangements.find((arrangement) => arrangement.id === selectedArrangementId) ?? null;
  const editingArrangement =
    arrangements.find((arrangement) => arrangement.id === editingArrangementId) ?? null;

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
    const timeFields = getArrangementTimeFieldsForPreset(form.timePreset);
    patchArrangement(editingArrangement.id, {
      title: form.title.trim(),
      note: form.note.trim() || undefined,
      timeKind: timeFields.timeKind,
      startAt: timeFields.startAt,
      endAt: undefined,
      fuzzyTimeLabel: timeFields.fuzzyTimeLabel,
      location: form.location.trim() || undefined,
      people: splitPeopleInput(form.people),
    });
    setEditingArrangementId(null);
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
            <h1 className="text-xl font-semibold leading-7 text-text">安排</h1>
            <p className="mt-0.5 text-xs leading-5 text-text-tertiary">
              未来的事，轻一点放在这
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowEditor(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[24px] font-light leading-none text-on-primary shadow-soft transition active:scale-[0.96]"
            aria-label="新增安排"
          >
            +
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ArrangementSearchBar value={searchQuery} onChange={setSearchQuery} />

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

        <ArrangementSourceFilterBar value={sourceFilter} onChange={setSourceFilter} />

        <div className="sticky top-0 z-10 -mx-4 mt-3 bg-bg px-4 pb-2 pt-2">
          <div className="grid grid-cols-4 gap-1 rounded-[12px] bg-surface p-1">
            {filters.map((filter) => {
              const active = filter.key === activeFilter;
              return (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setActiveFilter(filter.key)}
                  className={cn(
                    "h-8 rounded-[9px] text-[12px] font-medium transition active:scale-[0.98]",
                    active
                      ? "bg-primary-soft text-primary"
                      : "text-text-tertiary hover:bg-hover-overlay"
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {visibleArrangements.length > 0 ? (
          <section className="space-y-3">
            <ArrangementGroup
              title={getGroupTitle(activeFilter)}
              arrangements={visibleArrangements}
              onOpen={(arrangement) => setSelectedArrangementId(arrangement.id)}
              onComplete={handleComplete}
              onRestore={handleRestore}
            />
          </section>
        ) : (
          <div className="flex min-h-[300px] items-center justify-center">
            <EmptyState
              title={searchQuery.trim() || sourceFilter !== "all" ? "没有匹配的安排" : "这里还没有安排"}
              description={
                searchQuery.trim() || sourceFilter !== "all"
                  ? "换个关键词或来源试试。"
                  : "把接下来可能要做的事先放进来，不确定时间也没关系。"
              }
              action={
                searchQuery.trim() || sourceFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSourceFilter("all");
                    }}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition active:scale-[0.98]"
                  >
                    清除筛选
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowEditor(true)}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-on-primary transition active:scale-[0.98]"
                  >
                    新增安排
                  </button>
                )
              }
            />
          </div>
        )}
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
    </div>
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
  if (arrangements.length > 0) {
    return (
      <section className="pt-1">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold leading-5 text-text-muted">
            今天值得留意
          </h2>
          <span className="text-[11px] leading-4 text-text-tertiary">
            {arrangements.length} 条
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
        title="今天都处理好了"
        description="已完成的安排会留在「已完成」里，之后也可以恢复。"
        actionLabel="查看已完成"
        onAction={onShowDone}
      />
    );
  }

  if (!hasAnyVisibleArrangement) {
    return (
      <SpotlightMessage
        title="还没有安排"
        description="把接下来可能要做的事先放进来，不确定时间也没关系。"
        actionLabel="新增安排"
        onAction={onCreate}
      />
    );
  }

  if (hasFutureActiveArrangements) {
    return (
      <SpotlightMessage
        title="今天不用急"
        description="后面还有几条安排，可以先看看近期。"
        actionLabel="查看近期"
        onAction={onShowNear}
      />
    );
  }

  return (
    <SpotlightMessage
      title="今天不用急"
      description="暂时没有需要今天处理的安排。"
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
  return (
    <section className="pt-1">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[13px] font-semibold leading-5 text-text-muted">{title}</h2>
        <span className="text-[11px] leading-4 text-text-tertiary">0 条</span>
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

function ArrangementSearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pb-3 pt-1">
      <label className="block">
        <span className="sr-only">搜索安排</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="搜索安排、地点、相关人"
          className="h-10 w-full rounded-[12px] border border-transparent bg-surface px-3 text-[13px] text-text shadow-soft outline-none placeholder:text-input-placeholder focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
        />
      </label>
    </div>
  );
}

function ArrangementSourceFilterBar({
  value,
  onChange,
}: {
  value: ArrangementSourceFilter;
  onChange: (value: ArrangementSourceFilter) => void;
}) {
  return (
    <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
      <div className="flex w-max gap-1.5">
        {sourceFilters.map((filter) => {
          const active = filter.key === value;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => onChange(filter.key)}
              className={cn(
                "h-8 whitespace-nowrap rounded-full px-3 text-[12px] font-medium transition active:scale-[0.98]",
                active
                  ? "bg-primary-soft text-primary"
                  : "bg-surface text-text-tertiary hover:bg-hover-overlay"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ArrangementGroup({
  title,
  arrangements,
  onOpen,
  onComplete,
  onRestore,
}: {
  title: string;
  arrangements: ArrangementItem[];
  onOpen: (arrangement: ArrangementItem) => void;
  onComplete: (arrangement: ArrangementItem) => void;
  onRestore: (arrangement: ArrangementItem) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-[13px] font-semibold leading-5 text-text-muted">
        {title}
      </h2>
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
    </div>
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
          aria-label={done ? "恢复安排" : "完成安排"}
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
            {later && <StatusPill label="以后再说" tone="muted" />}
            {done && <StatusPill label="已完成" tone="primary" />}
          </div>
          <p className="mt-1 text-[12px] leading-5 text-text-tertiary">
            {formatArrangementMeta(arrangement)}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <StatusPill label={getSourceTypeLabel(arrangement.sourceType)} tone="muted" />
            {arrangement.aiCapability !== "userOnly" && (
              <StatusPill
                label={getAiCapabilityLabel(arrangement.aiCapability)}
                tone="primary"
              />
            )}
            {arrangement.sourceRefs.length > 1 && (
              <StatusPill
                label={`关联 ${arrangement.sourceRefs.length} 段上下文`}
                tone="muted"
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
        aria-label="关闭安排详情"
      />
      <section
        className="relative z-10 flex max-h-[86%] w-full flex-col overflow-hidden rounded-t-[16px] border border-border-light bg-[var(--dialog-bg)] shadow-[0_-12px_36px_rgba(0,0,0,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-label="安排详情"
      >
        <header className="shrink-0 border-b border-border-light px-4 pb-3 pt-2.5">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-fill-2" />
          <div className="flex items-center gap-3">
            <h2 className="min-w-0 flex-1 truncate text-[14px] leading-5 text-text">
              安排详情
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-text-tertiary transition hover:bg-hover-overlay hover:text-text active:scale-[0.96]"
              aria-label="关闭安排详情"
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
            <DetailRow label="状态" value={getStatusLabel(arrangement.status)} />
            <DetailRow label="时间" value={formatArrangementTime(arrangement)} />
            <DetailRow label="地点" value={arrangement.location || "暂未设置"} />
            <DetailRow
              label="相关人"
              value={arrangement.people.length > 0 ? arrangement.people.join("、") : "暂无"}
            />
            <DetailRow label="来源" value={getSourceTypeLabel(arrangement.sourceType)} />
            <DetailRow
              label="AI 能力"
              value={getAiCapabilityLabel(arrangement.aiCapability)}
            />
          </div>

          <section className="mt-4">
            <h4 className="text-[13px] font-semibold leading-5 text-text-muted">
              相关上下文
            </h4>
            <div className="mt-2 space-y-2">
              {arrangement.sourceRefs.map((sourceRef) => (
                <div
                  key={sourceRef.id}
                  className="rounded-[10px] border border-border-light bg-surface px-3 py-2"
                >
                  <p className="text-[12px] font-medium leading-5 text-text-muted">
                    {sourceRef.title}
                  </p>
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
              <ActionButton label="完成" primary onClick={() => onComplete(arrangement)} />
            )}
            {canMoveLater && (
              <ActionButton label="以后再说" onClick={() => onMoveLater(arrangement)} />
            )}
            {canRestore && (
              <ActionButton label="重新放回安排" primary onClick={() => onRestore(arrangement)} />
            )}
            <ActionButton label="编辑" onClick={() => onEdit(arrangement)} />
            <ActionButton label="归档" onClick={() => onArchive(arrangement)} />
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
  const [form, setForm] = React.useState<EditorForm>(initialValue ?? emptyEditorForm);
  const canSubmit = form.title.trim().length > 0;
  const title = mode === "edit" ? "编辑安排" : "新增安排";
  const submitLabel = mode === "edit" ? "保存修改" : "保存安排";
  const closeLabel = mode === "edit" ? "关闭编辑安排" : "关闭新增安排";

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
            <span className="text-[13px] font-medium leading-5 text-text-muted">内容</span>
            <textarea
              value={form.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="写下接下来可能要做的事"
              className="mt-2 min-h-[88px] w-full resize-none rounded-[12px] border border-transparent bg-surface px-3 py-3 text-[15px] leading-6 text-text shadow-soft outline-none placeholder:text-input-placeholder focus:shadow-[0_0_0_1px_var(--primary-ring),0_0_10px_var(--primary-ring)]"
            />
          </label>

          <div>
            <p className="text-[13px] font-medium leading-5 text-text-muted">时间</p>
            <div className="mt-2 grid grid-cols-4 gap-1 rounded-[12px] bg-surface p-1">
              {timePresetOptions.map((option) => {
                const active = form.timePreset === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateField("timePreset", option.key)}
                    className={cn(
                      "h-8 rounded-[9px] text-[12px] font-medium transition active:scale-[0.98]",
                      active ? "bg-primary-soft text-primary" : "text-text-tertiary"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] leading-4 text-text-tertiary">
              不确定时间也可以先放进来。
            </p>
          </div>

          <TextField
            label="地点"
            value={form.location}
            placeholder="医院、公司、线上..."
            onChange={(value) => updateField("location", value)}
          />
          <TextField
            label="相关人"
            value={form.people}
            placeholder="用空格或顿号分隔"
            onChange={(value) => updateField("people", value)}
          />
          <TextField
            label="备注"
            value={form.note}
            placeholder="补充背景或想法"
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

const timePresetOptions: Array<{ key: ArrangementTimePreset; label: string }> = [
  { key: "none", label: "无时间" },
  { key: "today", label: "今天" },
  { key: "tomorrow", label: "明天" },
  { key: "weekend", label: "周末" },
];

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

function StatusPill({ label, tone }: { label: string; tone: "primary" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[10px] font-medium leading-4",
        tone === "primary"
          ? "bg-primary-soft text-primary"
          : "bg-fill-3 text-text-tertiary"
      )}
    >
      {label}
    </span>
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

function getEditorFormFromArrangement(arrangement: ArrangementItem): EditorForm {
  return {
    title: arrangement.title,
    timePreset: getTimePresetFromArrangement(arrangement),
    location: arrangement.location ?? "",
    people: arrangement.people.join("、"),
    note: arrangement.note ?? "",
  };
}

function getTimePresetFromArrangement(arrangement: ArrangementItem): ArrangementTimePreset {
  if (!arrangement.startAt) return "none";
  if (isToday(arrangement.startAt)) return "today";
  if (isTomorrow(arrangement.startAt)) return "tomorrow";
  if (arrangement.fuzzyTimeLabel?.includes("周末")) return "weekend";
  return "none";
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
    .split(/[、,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getGroupTitle(filter: ArrangementFilter) {
  if (filter === "near") return "近期";
  if (filter === "later") return "以后再说";
  if (filter === "done") return "已完成";
  return "全部安排";
}

function formatArrangementMeta(arrangement: ArrangementItem) {
  const parts = [formatArrangementTime(arrangement)];
  if (arrangement.location) parts.push(arrangement.location);
  if (arrangement.people.length > 0) parts.push(arrangement.people.join("、"));
  return parts.filter(Boolean).join(" · ");
}

function formatArrangementTime(arrangement: ArrangementItem) {
  if (arrangement.fuzzyTimeLabel && arrangement.fuzzyTimeLabel !== "还没有时间") {
    return arrangement.fuzzyTimeLabel;
  }

  if (arrangement.startAt) {
    return formatTimeLabel(arrangement.startAt);
  }

  return "还没有时间";
}

function getStatusLabel(status: ArrangementStatus) {
  if (status === "done") return "已完成";
  if (status === "later") return "以后再说";
  if (status === "archived") return "已归档";
  return "进行中";
}

function getAiCapabilityLabel(capability: ArrangementAiCapability) {
  if (capability === "aiAssist") return "AI 可协助";
  if (capability === "aiExecutable") return "AI 可执行";
  return "需要自己完成";
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
