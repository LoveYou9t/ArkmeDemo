# 「安排」模块第三阶段迭代方案

## 1. 阶段目标

第三阶段开始扩展更多可用功能，但仍保持移动端 Demo 的轻量边界。建议优先实现“编辑已有安排 + 搜索/过滤”，让第一、二阶段已经创建出来的安排可以被持续维护、快速查找和按上下文定位。

本阶段不直接进入 AI 识别、日历月视图、浏览器通知或真实后端 API。原因是当前安排模块的手动闭环已经可用，但缺少修改和查找能力；先补齐这层基础，可以为后续 AI 识别、消息转安排和日历提醒提供更稳定的数据入口。

## 2. 当前基础

第二阶段完成后，当前模块已经具备：

- 主标签页「安排」入口。
- `ArrangementItem` 数据模型和 localStorage 持久化。
- 手动创建安排。
- 顶部“今天值得留意”今日聚合逻辑。
- 全部 / 近期 / 以后再说 / 已完成筛选。
- 详情 Sheet。
- 创建 Sheet。
- 完成、以后再说、恢复、归档状态流转。

第三阶段应继续复用这些能力，不改底部导航、不改主数据模型、不迁移 localStorage key。

## 3. 推荐第三阶段范围

### 3.1 编辑已有安排

为详情 Sheet 增加「编辑」入口，点击后打开与创建 Sheet 风格一致的编辑 Sheet。

编辑字段沿用当前创建字段：

- 标题，必填。
- 时间快捷项，可选。
- 地点，可选。
- 相关人，可选。
- 备注，可选。

保存后更新当前安排，并写回 localStorage。编辑不改变当前安排状态，除非用户只是在详情里继续点击完成、以后再说、恢复或归档。

### 3.2 搜索安排

在安排页顶部标题区下方、今日区域上方新增搜索输入。

搜索范围建议包括：

- 标题。
- 备注。
- 地点。
- 相关人。
- 来源上下文标题。
- 来源上下文摘要。

搜索只影响列表区域和筛选结果，不影响「今天值得留意」顶部区域。顶部区域仍表达今天状态，避免搜索后顶部语义混乱。

### 3.3 增加轻量上下文过滤

在现有筛选段下方或搜索框附近增加一组轻量过滤 chips：

- 全部来源。
- 手动。
- 快记。
- 私聊。
- 群聊。

第三阶段只做来源过滤，不做人物/地点多维高级筛选。人物和地点搜索可以先通过搜索框覆盖。

过滤与现有状态筛选叠加：

```text
最终列表 = 非归档安排
  -> 状态筛选
  -> 搜索词筛选
  -> 来源筛选
```

## 4. 建议交互设计

### 4.1 顶部结构

安排页顶部保持现有标题与新增按钮。

标题区下面新增搜索框：

```text
搜索安排、地点、相关人
```

视觉上复用现有输入框 token：

- `bg-surface`
- `text-text`
- `placeholder:text-input-placeholder`
- `rounded-[12px]`
- `shadow-soft`

不要加入新的搜索页面或桌面端弹窗。

### 4.2 来源过滤 chips

来源过滤使用横向滚动 chips 或紧凑分段按钮，优先复用当前筛选段的圆角、字号和 `primary-soft` 激活态。

默认选中「全部来源」。如果没有匹配来源，列表区域展示空状态。

### 4.3 编辑入口

详情 Sheet 底部按钮区增加「编辑」。

推荐按钮顺序：

- active：`完成` / `以后再说` / `编辑` / `归档`
- later：`重新放回安排` / `编辑` / `归档`
- done：`重新放回安排` / `编辑` / `归档`

如果按钮数量导致移动端拥挤，可以改成两列网格自动换行，继续复用当前 `ActionButton`。

### 4.4 编辑 Sheet

编辑 Sheet 复用创建 Sheet 的结构、字段和关闭行为。建议将当前 `ArrangementEditorSheet` 改造成同时支持创建和编辑：

```ts
type EditorMode = "create" | "edit";

type ArrangementEditorSheetProps = {
  mode: EditorMode;
  initialValue?: EditorForm;
  onClose: () => void;
  onSubmit: (form: EditorForm) => void;
};
```

创建时标题为「新增安排」，按钮为「保存安排」。

编辑时标题为「编辑安排」，按钮为「保存修改」。

## 5. 数据与状态策略

### 5.1 不改 `ArrangementItem`

第三阶段不新增字段。编辑直接更新已有字段：

- `title`
- `timeKind`
- `startAt`
- `endAt`
- `fuzzyTimeLabel`
- `location`
- `people`
- `note`
- `updatedAt`

时间快捷项仍复用当前 `ArrangementTimePreset` 和 `createManualArrangement` 中的时间生成规则。为避免重复逻辑，建议在数据层抽出一个内部工具用于把表单转换成时间字段。

### 5.2 编辑状态

在 `Arrangements` 页面中新增：

```ts
const [editingArrangementId, setEditingArrangementId] = React.useState<string | null>(null);
```

当 `editingArrangementId` 有值时，打开编辑 Sheet，并用该安排填充初始表单。

保存编辑后：

1. patch 对应安排。
2. 更新 `updatedAt`。
3. 写入 localStorage。
4. 关闭编辑 Sheet。
5. 保留当前筛选和搜索状态。

### 5.3 搜索与过滤状态

新增页面状态：

```ts
const [searchQuery, setSearchQuery] = React.useState("");
const [sourceFilter, setSourceFilter] = React.useState<ArrangementSourceFilter>("all");
```

推荐类型：

```ts
type ArrangementSourceFilter =
  | "all"
  | "manual"
  | "record"
  | "privateChat"
  | "groupChat";
```

## 6. 实现拆分建议

### 6.1 数据层复用

优先在 `src/data/arrangements.ts` 中抽出表单时间解析工具，供创建和编辑复用。不要迁移 localStorage 数据。

如果为了避免跨层耦合，也可以在 `Arrangements.tsx` 内实现 `getEditorFormFromArrangement` 和 `getArrangementPatchFromEditorForm`，但时间字段转换不要复制两份。

### 6.2 页面组件复用

建议继续在 `src/pages/Arrangements.tsx` 内实现第三阶段，避免过早拆成多个文件。

可新增内部组件：

- `ArrangementSearchBar`
- `ArrangementSourceFilterBar`

继续复用：

- `ArrangementCard`
- `ArrangementDetailSheet`
- `ArrangementEditorSheet`
- `ActionButton`
- `TextField`
- `EmptyState`

### 6.3 列表派生逻辑

把列表计算改为明确的派生流水线：

```ts
const visibleArrangements = React.useMemo(
  () =>
    arrangements
      .filter((item) => isVisibleForFilter(item, activeFilter))
      .filter((item) => matchesSearchQuery(item, searchQuery))
      .filter((item) => matchesSourceFilter(item, sourceFilter)),
  [activeFilter, arrangements, searchQuery, sourceFilter]
);
```

顶部 `TodaySpotlightSection` 不接入搜索和来源过滤。

## 7. 不做内容

第三阶段明确不做：

- 不接入真实 AI API。
- 不做私聊/群聊自动识别。
- 不做日历月视图。
- 不做浏览器通知。
- 不做循环提醒。
- 不做撤销归档。
- 不做批量操作。
- 不做复杂高级筛选面板。

## 8. 验收标准

第三阶段完成后应满足：

- 详情 Sheet 中可以进入编辑。
- 编辑 Sheet 与创建 Sheet 风格一致。
- 编辑标题、时间、地点、相关人、备注后，列表和详情立即更新。
- 刷新页面后编辑结果仍保留。
- 搜索标题、备注、地点、相关人、来源上下文均能过滤列表。
- 来源过滤能按手动、快记、私聊、群聊筛选列表。
- 搜索和来源过滤与现有状态筛选可叠加。
- 搜索无结果时显示现有风格的空状态。
- 顶部「今天值得留意」不受搜索和来源过滤影响。
- 创建、详情、完成、以后再说、恢复、归档不回退。
- 底部「快记 / 安排 / 洞见 / 我的」样式不变。
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过。

## 9. 推荐实施顺序

1. 改造 `ArrangementEditorSheet` 支持 create/edit 两种模式。
2. 增加编辑入口和 `editingArrangementId` 状态。
3. 实现安排编辑保存与 localStorage 持久化。
4. 增加搜索框 UI 和 `searchQuery` 状态。
5. 增加来源过滤 chips 和 `sourceFilter` 状态。
6. 改造 `visibleArrangements` 派生逻辑。
7. 补齐空状态文案。
8. 更新 `docs/interface_cache.md`。
9. 运行完整验证和浏览器烟测。

## 10. 第四阶段预留

第三阶段完成后，第四阶段可以进入“来源转安排”和“AI 候选识别”：

- 从快记手动转成安排。
- 从消息测试后台选择消息生成安排。
- 增加 AI 候选安排确认队列。
- 给每条候选安排展示识别来源和置信提示。

这些能力会依赖第三阶段的编辑能力，因为 AI 或消息生成的安排通常需要用户二次修正。
