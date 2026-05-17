# 安排模块明日提醒与多粒度时间方案

## 1. 背景

当前「安排」页顶部的 `TodaySpotlightSection` 只展示今天真正需要关注的 active 安排。这个方向是对的，但它带来一个新的体验问题：

- 如果今天没有安排，但明天有重要安排，顶部只显示「今天不用急」。
- 用户会误以为没有值得注意的事，实际却可能漏掉明天上午、明天下午或明天某个具体时间的安排。
- 当前创建/编辑安排的时间只支持 `无时间 / 今天 / 明天 / 周末`，无法表达「明天上午」「明天下午」「这周三」「5 月 20 日」「明天 9 点」等更真实的时间。

本方案只做计划，不直接改业务代码。后续实现应继续复用现有 `ArrangementItem`、`startAt`、`fuzzyTimeLabel`、`timeKind`、`Arrangements` 页面、创建/编辑 Sheet、详情 Sheet、localStorage 数据层和顶部 Spotlight 区域。

## 2. 目标

1. 今天没有安排时，如果存在明天或近期 active 安排，顶部要提醒用户「明天别忘了」或「接下来别忘了」。
2. 顶部区域仍然优先展示今天事项，不把明天事项混进「今天值得留意」。
3. 时间输入从单一 preset 升级为多粒度表达，至少支持：
   - 无时间
   - 今天
   - 明天
   - 明天上午
   - 明天下午
   - 本周某天
   - 具体日期
   - 具体日期 + 具体时间
   - 今天/明天 + 具体几点
4. 不迁移已有 `arkme-demo.arrangements` 存储结构，不破坏旧数据。
5. 对旧的 `timePreset` 继续兼容，先做渐进式升级。

## 3. 现状问题

### 3.1 顶部提醒过于绝对

当前逻辑大致是：

```ts
const todaySpotlightArrangements = activeArrangements
  .filter((arrangement) => shouldShowInTodaySpotlight(arrangement))
  .sort(compareByTimeThenAttention)
  .slice(0, 2);

function shouldShowInTodaySpotlight(arrangement, now = Date.now()) {
  if (arrangement.status !== "active") return false;
  if (arrangement.timeKind === "none") return false;
  if (!arrangement.startAt) return false;
  return isToday(arrangement.startAt, now);
}
```

这能避免「明天」或「后天」误入今天区域，但当今天为空、明天有事时，只用 `hasFutureActiveArrangements` 显示「今天不用急」，信息密度不够。

### 3.2 时间模型 UI 表达太粗

当前 `ArrangementTimePreset` 是：

```ts
export type ArrangementTimePreset = "none" | "today" | "tomorrow" | "weekend";
```

这不足以支持用户常见表达：

- 明天上午带早餐
- 明天下午开会
- 这周五交材料
- 5 月 20 日去医院
- 明天 9:30 到公司

底层 `ArrangementItem` 已经有 `startAt`、`endAt`、`timeKind`、`fuzzyTimeLabel`，不需要推倒重来。真正缺的是一个更细的表单输入草稿和转换函数。

## 4. 推荐产品逻辑

### 4.1 顶部区域分层

顶部区域按优先级展示：

1. 有今天 active 安排：展示「今天值得留意」和今天卡片。
2. 今天没有，但明天有 active 安排：展示「明天别忘了」和明天最重要的 1-2 条。
3. 今天、明天都没有，但 7 天内有 active 安排：展示「接下来别忘了」和最近 1-2 条。
4. 没有近期 active，但全部已完成：展示「今天都处理好了」。
5. 没有任何非归档安排：展示「还没有安排」。
6. 只有更远未来或无时间安排：展示「今天不用急」，并给「查看近期」或「查看全部」入口。

### 4.2 不混淆标题语义

明天事项不应该放在「今天值得留意」标题下，否则语义又会回到第二阶段修过的问题。

建议新增一个更通用的顶部展示结构：

```ts
type ArrangementSpotlightMode =
  | "today"
  | "tomorrow"
  | "upcoming"
  | "done"
  | "empty"
  | "calm";
```

不同 mode 对应不同标题：

```ts
today: "今天值得留意"
tomorrow: "明天别忘了"
upcoming: "接下来别忘了"
done: "今天都处理好了"
empty: "还没有安排"
calm: "今天不用急"
```

### 4.3 明天提醒文案

如果只有一条明天安排：

```text
明天别忘了
明天上午到公司帮小李带早餐
```

如果有多条：

```text
明天别忘了
明天还有 2 条安排，先看最靠前的。
```

卡片仍复用 `ArrangementCard`，不额外做一套样式。

## 5. 多粒度时间设计

### 5.1 新增表单时间草稿

建议在 UI 层新增 `ArrangementTimeDraft`，不要直接扩大 `ArrangementItem` 主模型：

```ts
type ArrangementTimeDraft =
  | { kind: "none" }
  | { kind: "relativeDay"; day: "today" | "tomorrow"; part?: "morning" | "afternoon" | "evening"; clock?: string }
  | { kind: "weekday"; weekday: 1 | 2 | 3 | 4 | 5 | 6 | 0; part?: "morning" | "afternoon" | "evening"; clock?: string }
  | { kind: "date"; date: string; part?: "morning" | "afternoon" | "evening"; clock?: string };
```

字段含义：

- `part` 表示上午、下午、晚上等模糊时间段。
- `clock` 表示具体几点，如 `09:30`。
- `date` 用 `YYYY-MM-DD`，便于 `<input type="date">` 和后续 AI/API 使用。
- `weekday` 表示本周某天，后续转换成具体日期时间。

### 5.2 转换到现有 ArrangementItem

新增转换函数：

```ts
function getArrangementTimeFieldsFromDraft(
  draft: ArrangementTimeDraft,
  now?: number
): Pick<ArrangementItem, "timeKind" | "startAt" | "endAt" | "fuzzyTimeLabel">;
```

转换规则：

- `none`：`timeKind: "none"`，`fuzzyTimeLabel: "还没有时间"`。
- `relativeDay + part`：生成明天上午、明天下午等 `fuzzyTimeLabel`，`startAt` 落在默认时间点。
- `relativeDay + clock`：生成明天 09:30，`timeKind: "deadline"`。
- `weekday`：转换到本周对应日期，如果当天已过，可按产品选择本周已过日期或下周同一天。建议默认「未来最近一次」。
- `date`：按具体日期生成 `startAt`，有 `clock` 则精确到分钟。
- `part` 默认时间建议：
  - morning: 09:00
  - afternoon: 14:00
  - evening: 19:00

### 5.3 兼容旧 preset

旧的 `ArrangementTimePreset` 可以先保留，新增桥接函数：

```ts
function getTimeDraftFromPreset(preset: ArrangementTimePreset): ArrangementTimeDraft;
function getTimeDraftFromArrangement(arrangement: ArrangementItem): ArrangementTimeDraft;
```

这样创建/编辑 Sheet 可以逐步从 `timePreset` 改为 `timeDraft`，但旧数据仍能正确显示。

## 6. UI 调整方案

### 6.1 创建/编辑 Sheet

时间区域从四个按钮升级为两层：

第一层：快速选择

- 无时间
- 今天
- 明天
- 明天上午
- 明天下午
- 本周
- 具体日期

第二层：按需展开

- 选择「本周」后展示周一到周日。
- 选择「具体日期」后展示日期输入。
- 任意有时间的选项都可补充「具体几点」。

移动端布局建议：

- 快速选择继续用横向 chips 或两行网格，不改整体 Sheet 风格。
- 日期和时间输入用现有 `TextField` 样式或原生 `date/time` input。
- 不要做复杂日历控件，先保证低成本可用。

### 6.2 详情与卡片展示

继续优先使用 `fuzzyTimeLabel`。

示例：

- 明天上午
- 明天下午
- 周五上午
- 5 月 20 日
- 5 月 20 日 09:30

如果有具体时间，卡片 meta 中展示具体时间；如果只是上午/下午，展示模糊时间。

## 7. 实现步骤

1. 在 `src/data/arrangements.ts` 增加 `ArrangementTimeDraft`、转换函数和旧 preset 桥接函数。
2. 在 `src/pages/Arrangements.tsx` 增加 `getTomorrowSpotlightArrangements` 和 `getUpcomingSpotlightArrangements` 派生逻辑。
3. 将 `TodaySpotlightSection` 改为更通用的 `ArrangementSpotlightSection`，接收 mode、arrangements 和对应操作。
4. 在创建/编辑 Sheet 中把 `timePreset` 状态替换或包一层为 `timeDraft`。
5. 保留 `ArrangementItem` 主模型和 localStorage key 不变。
6. 补充浏览器烟测：
   - 今天无安排、明天有安排时顶部显示「明天别忘了」。
   - 今天有安排时仍优先显示「今天值得留意」。
   - 明天上午、明天下午、具体日期、具体几点都能保存并刷新保留。

## 8. 验收标准

- 当今天无 active 安排但明天有 active 安排时，顶部不再只显示「今天不用急」，而是显示「明天别忘了」。
- 明天提醒卡片不改变状态筛选和来源筛选逻辑。
- 新建安排时可选择明天上午、明天下午、本周某天、具体日期、具体几点。
- 编辑旧安排时不会丢失已有时间信息。
- 旧 localStorage 数据能继续被 `normalizeArrangement` 读取。
- 不新增底部主导航，不改 `/sendtest`。
- `pnpm verify:answer` 通过。

## 9. 非目标

- 本阶段不接真实 AI。
- 本阶段不做完整日历月视图。
- 本阶段不做浏览器系统通知。
- 本阶段不迁移 localStorage 数据结构。
- 本阶段不引入新的日期库。

