# 「安排」模块现状梳理与「今天值得留意」优化方案

## 1. 已完成功能

第一阶段已经完成「安排」模块的基础闭环，可以正常作为一个可用的主标签页进入。

### 1.1 主入口

- 底部导航已扩展为「快记 / 安排 / 洞见 / 我的」。
- 「安排」标签复用了当前 `MobileBottomNavigation` 的宽度分配、圆角、高度和激活态样式。
- 标签文案已补充到现有多语言配置中。

### 1.2 数据和持久化

- 已新增 `ArrangementItem` 核心模型。
- 已新增安排数据层，支持 localStorage 读写和归一化。
- 已内置 4 条示例安排，分别覆盖：
  - 医院复查上下文合并
  - 私聊带早餐
  - 手动创建的交互整理
  - 周末游泳提醒

### 1.3 页面能力

- 已新增 `Arrangements` 页面。
- 已支持顶部标题、副标题和新增按钮。
- 已支持安排列表与筛选段。
- 已支持详情 Sheet。
- 已支持创建 Sheet。
- 已支持完成、以后再说、恢复、归档。

### 1.4 风格复用

- 页面复用了现有主题 token。
- 时间显示复用了现有时间工具。
- 空状态复用了现有 `EmptyState` 风格。
- 弹层结构复用了现有移动端底部 Sheet 的语气和形态。

### 1.5 规范记录

- 已将关键接口、模型和状态流记录到 `docs/interface_cache.md`。
- 已将本轮实现过程记录到个人 Markdown 日志和 `src/data/aiConversationLog.ts`。

## 2. 尚未完成功能

下面这些能力还没有实现，当前只停留在结构预留或示意层。

### 2.1 AI 识别

- 真实大模型 API 绑定
- 发给自己的自动识别
- 私聊请求/承诺识别
- 群聊安排识别
- 多物品连续对话合并识别

### 2.2 合并与拆分

- 用户手动合并安排
- 用户拆分一条安排中的多个上下文
- AI 给出合并理由

### 2.3 日历与提醒

- 日历月视图
- 提前提醒
- 循环提醒
- 浏览器通知
- “已提醒”与“已完成”的状态区分

### 2.4 AI 执行

- AI 先准备
- AI 直接执行
- 清单生成
- 回复草拟
- 上下文总结

### 2.5 编辑和搜索

- 编辑已存在安排
- 搜索安排
- 按人物/地点/来源过滤
- 撤销删除

## 3. 当前问题

当前 `今天值得留意` 的规则会把所有 `active` 安排按 `attentionScore` 排序后截取 2 条：

```ts
arrangements
  .filter((arrangement) => arrangement.status === "active")
  .sort((a, b) => b.attentionScore - a.attentionScore)
  .slice(0, 2)
```

这会导致两个体验偏差：

- 时间是后天、周末、或者没有明确时间的 active 安排，也可能因为分数高而进入「今天值得留意」。
- 当所有安排都设置为已完成时，顶部显示“现在没有必须立刻处理的安排”，语义上像普通空状态，而不是完成反馈。

## 4. 优化目标

优化后应达到：

- 「今天值得留意」只展示今天真正值得用户关注的安排。
- 不把远期安排、无明确时间安排混进去。
- 当所有安排都已完成时，给用户明确的完成反馈。
- 当今天没有安排但未来还有安排时，提示用户去看近期或全部。
- 当没有任何安排时，保留新增入口。
- 保持当前低压力、低焦虑的产品语气。

## 5. 推荐方案

### 5.1 重新定义“今天值得留意”

建议把今天区域从“高关注 active”改成“今天要处理的 active”。

建议规则：

- 只展示 `active`。
- 只展示有 `startAt` 的安排。
- 只展示今天的安排。
- 如果后续要支持轻度过期提醒，可再加一层宽限，但第一版可以先不加。

推荐函数：

```ts
function shouldShowInTodaySpotlight(arrangement: ArrangementItem, now = Date.now()) {
  if (arrangement.status !== "active") return false;
  if (arrangement.timeKind === "none") return false;
  if (!arrangement.startAt) return false;
  return isToday(arrangement.startAt, now);
}
```

### 5.2 今天区域的三种状态

#### 状态 A: 今天有安排

展示标题：

```text
今天值得留意
```

展示今天的 active 安排卡片，最多 2 条。

#### 状态 B: 今天没有安排，但还有未来安排

展示标题：

```text
今天不用急
```

辅助文案：

```text
后面还有几条安排，可以先看看近期。
```

按钮：

```text
查看近期
```

点击后切到 `近期` 筛选。

#### 状态 C: 所有非归档安排都已完成

展示标题：

```text
今天都处理好了
```

辅助文案：

```text
已完成的安排会留在「已完成」里，之后也可以恢复。
```

按钮：

```text
查看已完成
```

点击后切到 `已完成` 筛选。

#### 状态 D: 没有任何安排

展示标题：

```text
还没有安排
```

辅助文案：

```text
把接下来可能要做的事先放进来，不确定时间也没关系。
```

按钮：

```text
新增安排
```

点击打开创建 Sheet。

## 6. 建议实现方式

在 `Arrangements.tsx` 里把顶部区域拆成一个独立的小组件，逻辑只依赖派生状态：

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

然后将固定文案替换为一个 `TodaySpotlightSection`，把文案和按钮动作交给状态分支处理。

## 7. 排序建议

今天区域的排序优先级建议是：

1. 今天有明确时间的排前面。
2. 时间更早的排前面。
3. 同一天无具体时分的安排再按关注分排序。
4. 最多展示 2 条。

这样用户感受到的是“今天该处理什么”，而不是“系统帮我挑了两个高分项”。

## 8. 与现有功能的关系

这个优化不需要改动：

- `ArrangementItem` 数据模型
- localStorage 存储结构
- 底部导航
- 创建 Sheet
- 详情 Sheet
- 完成/以后再说/恢复/归档状态流转

只需要改：

- 今天区域的筛选和排序规则
- 顶部区域的文案和状态分支

## 9. 验收标准

优化完成后应满足：

- 后天、周末、无明确时间的安排不会出现在「今天值得留意」。
- 今天的 active 安排会出现在「今天值得留意」。
- 全部非归档安排已完成时，顶部显示“今天都处理好了”。
- 还有未来安排但今天没有安排时，顶部显示“今天不用急”。
- 没有任何安排时，顶部显示“还没有安排”并提供新增入口。
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过。

## 10. 推荐下一步

下一轮只做这个聚合逻辑优化，不扩大到 AI 识别、日历或提醒。

优先顺序：

1. 增加 `shouldShowInTodaySpotlight`。
2. 替换 `spotlightArrangements` 的计算规则。
3. 抽出顶部状态组件。
4. 调整文案和按钮跳转。
5. 重新验证。
