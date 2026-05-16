# 「安排」模块第二阶段迭代方案

## 1. 阶段目标

第二阶段聚焦修正「今天值得留意」区域的聚合逻辑和状态反馈，让顶部区域真正表达“今天要处理什么”，同时在无今日安排、全部完成、暂无安排等场景下给出更准确的低压力提示。

本阶段不扩展到 AI 识别、日历月视图、浏览器通知、循环提醒或真实后端同步，避免把问题范围从体验纠偏扩大成新模块建设。

## 2. 当前基础

第一阶段已经具备以下可复用基础：

- `ArrangementItem` 数据模型已经包含 `status`、`timeKind`、`startAt`、`attentionScore` 等字段。
- `Arrangements` 页面已经包含顶部区域、筛选段、安排卡片、详情 Sheet、创建 Sheet。
- 状态流转已经支持 `active`、`later`、`done`、`archived`。
- localStorage 持久化和归一化逻辑已经存在，不需要改变存储结构。
- 页面视觉已经接入现有主题 token、移动端 Sheet 风格和 `EmptyState`。

## 3. 要解决的问题

### 3.1 今天区域混入非今日内容

当前 `spotlightArrangements` 只按 `status === "active"` 和 `attentionScore` 取前两条，会把明天、周末、无明确时间的安排也放进「今天值得留意」。

### 3.2 全部完成后的反馈不准确

当所有非归档安排都已完成时，顶部仍显示“现在没有必须立刻处理的安排”，语义像普通空状态，缺少“已经处理好了”的正向反馈。

### 3.3 顶部状态和筛选段联动不足

当今天没有安排但未来还有安排时，顶部应该引导用户查看「近期」；当全部完成时，应引导查看「已完成」；当完全没有安排时，应直接提供「新增安排」入口。

## 4. 第二阶段功能范围

### 4.1 新增今日聚合规则

新增 `shouldShowInTodaySpotlight`，用于判断一条安排是否应该出现在顶部今日区域。

推荐规则：

```ts
function shouldShowInTodaySpotlight(arrangement: ArrangementItem, now = Date.now()) {
  if (arrangement.status !== "active") return false;
  if (arrangement.timeKind === "none") return false;
  if (!arrangement.startAt) return false;
  return isToday(arrangement.startAt, now);
}
```

如果项目内没有可复用的 `isToday`，可在 `Arrangements.tsx` 内先实现一个局部工具函数，避免过早扩展公共时间工具。

### 4.2 调整顶部排序

今日区域排序改为：

1. `startAt` 更早的安排排在前面。
2. 如果时间相同，再按 `attentionScore` 从高到低排序。
3. 最多展示 2 条。

这比单纯按关注分排序更符合“今天要处理”的用户预期。

### 4.3 抽出顶部状态组件

建议在 `src/pages/Arrangements.tsx` 内部抽出 `TodaySpotlightSection` 小组件，保持文件数量克制，同时把顶部状态分支从主组件 JSX 中分离出来。

建议 props：

```ts
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

### 4.4 顶部区域四种状态

#### 状态 A：今天有安排

- 标题：`今天值得留意`
- 右侧计数：今日 active 安排数量
- 内容：最多 2 条今日安排卡片

#### 状态 B：今天没有安排，但还有未来 active 安排

- 标题：`今天不用急`
- 文案：`后面还有几条安排，可以先看看近期。`
- 操作：`查看近期`
- 行为：切换到 `近期` 筛选

#### 状态 C：所有非归档安排都已完成

- 标题：`今天都处理好了`
- 文案：`已完成的安排会留在「已完成」里，之后也可以恢复。`
- 操作：`查看已完成`
- 行为：切换到 `已完成` 筛选

#### 状态 D：没有任何非归档安排

- 标题：`还没有安排`
- 文案：`把接下来可能要做的事先放进来，不确定时间也没关系。`
- 操作：`新增安排`
- 行为：打开创建 Sheet

## 5. 建议实现拆分

### 5.1 派生状态

在 `Arrangements` 主组件中增加以下派生状态：

```ts
const nonArchivedArrangements = arrangements.filter(
  (item) => item.status !== "archived"
);

const activeArrangements = nonArchivedArrangements.filter(
  (item) => item.status === "active"
);

const doneArrangements = nonArchivedArrangements.filter(
  (item) => item.status === "done"
);

const todaySpotlightArrangements = activeArrangements
  .filter((item) => shouldShowInTodaySpotlight(item))
  .sort(compareByTimeThenAttention)
  .slice(0, 2);

const allVisibleArrangementsDone =
  nonArchivedArrangements.length > 0 &&
  doneArrangements.length === nonArchivedArrangements.length;

const hasFutureActiveArrangements =
  activeArrangements.some((item) => !shouldShowInTodaySpotlight(item));
```

### 5.2 替换原顶部 JSX

用 `TodaySpotlightSection` 替换当前硬编码的「今天值得留意」区域。保留现有 `ArrangementCard`，避免重复创建新卡片样式。

### 5.3 复用现有视觉语言

顶部空状态卡片继续使用：

- `rounded-[12px]`
- `bg-surface`
- `text-text` / `text-text-tertiary`
- `primary` / `primary-soft`

不要引入新色板、大面积红色、桌面端 Modal 或新的导航控件。

### 5.4 保持筛选段不变

第二阶段不改变筛选段结构，仍为：

- `全部`
- `近期`
- `以后再说`
- `已完成`

顶部按钮只负责切换现有筛选或打开现有创建 Sheet。

## 6. 文件改动范围

建议只改动：

- `src/pages/Arrangements.tsx`
- `docs/interface_cache.md`
- 当前候选人个人日志
- `src/data/aiConversationLog.ts`

如实现中发现时间判断函数具备明显复用价值，可再考虑改动：

- `src/lib/time.ts`

但第二阶段优先保持局部实现，降低影响面。

## 7. 不做内容

第二阶段明确不做：

- 不修改 `ArrangementItem` 存储结构。
- 不迁移 localStorage key。
- 不增加新的底部标签。
- 不新增 AI API 调用。
- 不做私聊、群聊自动识别。
- 不做日历视图、浏览器通知、循环提醒。
- 不做编辑已有安排、搜索、人物/地点过滤。

## 8. 验收标准

完成后应满足：

- 明天、周末、无明确时间的 active 安排不会出现在「今天值得留意」。
- 今天的 active 安排会出现在顶部区域。
- 顶部今日安排按时间优先排序，最多展示 2 条。
- 今天没有安排但还有未来 active 安排时，顶部显示「今天不用急」并可切到「近期」。
- 所有非归档安排都已完成时，顶部显示「今天都处理好了」并可切到「已完成」。
- 没有任何非归档安排时，顶部显示「还没有安排」并可打开创建 Sheet。
- 原有创建、详情、完成、以后再说、恢复、归档功能不回退。
- 浅色、深色和强调色切换下视觉仍使用现有主题 token。
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过。

## 9. 推荐实施顺序

1. 在 `Arrangements.tsx` 增加 `isToday`、`shouldShowInTodaySpotlight`、`compareByTimeThenAttention`。
2. 用派生状态替换原 `spotlightArrangements`。
3. 抽出 `TodaySpotlightSection`。
4. 接入四种顶部状态的文案和按钮行为。
5. 手动验证安排状态流转和筛选跳转。
6. 更新 `docs/interface_cache.md` 中安排页状态流记录。
7. 运行 `C:\nvm4w\nodejs\pnpm.CMD verify:answer`。

## 10. 后续拓展预留

第二阶段完成后，第三阶段可以在此基础上继续扩展：

- 编辑已有安排。
- 搜索和按人物、地点、来源过滤。
- 从快记或测试消息中手动转成安排。
- AI 识别候选安排并进入确认队列。
- 日历视图和提醒设置。

这些能力都可以复用第二阶段沉淀的“顶部状态分支”和“今日判断函数”，但不应在第二阶段一起实现。
