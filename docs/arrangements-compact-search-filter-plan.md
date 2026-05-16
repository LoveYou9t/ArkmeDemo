# 「安排」模块搜索与来源过滤紧凑化修改方案

## 1. 问题背景

第三阶段完成后，安排页新增了搜索框和来源过滤 chips，但当前两者都是常驻展开状态：

- 搜索框固定显示在标题区下方，占用一整行。
- 来源 chips 固定显示在今日区域和状态筛选段之间，占用额外纵向空间。

在移动端 Demo 中，这会挤压「今天值得留意」和安排列表的首屏空间。用户提出的方向是：

- 在创建加号左边设置一个搜索按钮，点击后再出现搜索框。
- 来源 chips 改成展开栏，不默认铺开。

这个方向符合当前产品低负担、移动端优先的体验目标。

## 2. 修改目标

修改后应达到：

- 默认状态下，安排页顶部更紧凑。
- 搜索能力仍然保留，但从常驻输入框改成按需展开。
- 来源过滤仍然保留，但从常驻 chips 改成可展开栏。
- 已有搜索词或来源过滤生效时，用户能看到明确状态，并能快速清除。
- 不改变底部主导航，不改变 `ArrangementItem`，不迁移 localStorage。
- 继续复用现有主题 token、圆角、按钮和 Sheet 风格。

## 3. 推荐界面结构

### 3.1 顶部标题区默认状态

在「安排」标题区右侧保留新增加号按钮，并在加号左边新增搜索按钮：

```text
安排                         [搜索] [+]
未来的事，轻一点放在这
```

建议布局：

- 左侧仍为标题和副标题。
- 右侧按钮组从单个 `+` 改为 `搜索按钮 + 新增按钮`。
- 搜索按钮放在 `+` 左边，尺寸建议与加号按钮接近，例如 `h-9 w-9`。
- 搜索按钮默认使用 `bg-surface text-text-tertiary`，展开或有搜索词时使用 `bg-primary-soft text-primary`。
- `+` 按钮保持当前 `bg-primary text-on-primary` 风格不变。
- 如果有搜索词，搜索按钮旁显示关键词摘要。

默认不展示完整搜索输入框，也不展示所有来源 chips。

### 3.2 搜索展开状态

点击标题区右侧的搜索按钮后，在标题区下方、今日区域上方展开搜索输入框：

```text
[搜索输入框........................] [取消]
```

交互规则：

- 展开后自动聚焦输入框。
- 输入框占据一整行，但只在搜索状态打开时出现。
- 点击「取消」时：
  - 如果没有搜索词，直接收起搜索框。
  - 如果已有搜索词，清空搜索词并收起搜索框。
- 当存在搜索词时，即使用户收起搜索框，也要在工具栏显示关键词摘要，例如：

```text
安排                         [搜索] [+]
搜索：早餐
```

关键词摘要建议放在搜索展开区域收起后的一行轻量文案中，或放在搜索按钮的 `aria-label` / 小徽标中。为了避免右侧按钮组拥挤，第一版推荐在标题区下方显示轻量摘要行。

### 3.3 来源过滤默认状态

来源过滤不放在标题区右侧，避免和搜索、新增按钮挤在一起。建议在「今天值得留意」区域下方、状态筛选段上方放一个单行展开栏按钮：

```text
来源：全部来源  ⌄
```

交互规则：

- 默认只显示这一行来源展开按钮，不显示所有 chips。
- 如果来源不是 `all`，按钮显示当前来源，例如「来源：私聊  ⌄」。
- 这个按钮高度控制在 32px 左右，视觉上比状态筛选段更轻。

### 3.4 来源展开状态

点击「全部来源 v」或当前来源按钮后，在工具栏下方展开来源 chips：

```text
全部来源  手动  发给自己  私聊  群聊  AI 建议
```

交互规则：

- 来源 chips 默认不展示。
- 点击来源按钮展开，再次点击收起。
- 选择某个来源后：
  - 更新 `sourceFilter`。
  - 自动收起来源栏。
  - 工具栏按钮显示当前来源，例如「私聊 v」。
- 当来源不是 `all` 时，工具栏上提供一个小型清除入口，或点击「全部来源」恢复。

## 4. 推荐实现方式

### 4.1 新增 UI 状态

在 `Arrangements.tsx` 内新增两个局部状态：

```ts
const [showSearchBar, setShowSearchBar] = React.useState(false);
const [showSourceFilters, setShowSourceFilters] = React.useState(false);
```

保留已有：

```ts
const [searchQuery, setSearchQuery] = React.useState("");
const [sourceFilter, setSourceFilter] = React.useState<ArrangementSourceFilter>("all");
```

这两个新增状态只控制 UI 展开/收起，不参与数据持久化。

### 4.2 修改标题区按钮组

当前标题区右侧只有新增按钮：

```tsx
<button aria-label="新增安排">+</button>
```

建议改为右侧按钮组：

```tsx
<div className="flex shrink-0 items-center gap-2">
  <button aria-label="搜索安排">搜索图标或“搜”</button>
  <button aria-label="新增安排">+</button>
</div>
```

搜索按钮只控制 `showSearchBar`，不直接清空搜索词。

### 4.3 替换现有两个常驻组件

当前：

```tsx
<ArrangementSearchBar value={searchQuery} onChange={setSearchQuery} />
...
<ArrangementSourceFilterBar value={sourceFilter} onChange={setSourceFilter} />
```

建议拆成两个位置明确的组件：

```tsx
<ArrangementSearchPanel
  searchQuery={searchQuery}
  showSearchBar={showSearchBar}
  onSearchQueryChange={setSearchQuery}
  onCloseSearch={() => setShowSearchBar(false)}
/>

<ArrangementSourceFilterPanel
  sourceFilter={sourceFilter}
  showSourceFilters={showSourceFilters}
  onSourceFilterChange={setSourceFilter}
  onToggleSourceFilters={() => setShowSourceFilters((value) => !value)}
  onCloseSourceFilters={() => setShowSourceFilters(false)}
/>
```

放置建议：

- `ArrangementSearchPanel` 放在 header 之后、`TodaySpotlightSection` 之前。
- `ArrangementSourceFilterPanel` 放在 `TodaySpotlightSection` 之后、状态筛选段之前。

也可以保留一个聚合组件，但需要明确搜索按钮仍在 header 加号左边，不在聚合组件内部。

原先的聚合工具栏方案不再作为推荐：

```tsx
<ArrangementFilterToolbar
  searchQuery={searchQuery}
  sourceFilter={sourceFilter}
  showSearchBar={showSearchBar}
  showSourceFilters={showSourceFilters}
  onSearchQueryChange={setSearchQuery}
  onSourceFilterChange={setSourceFilter}
  onToggleSearch={() => setShowSearchBar((value) => !value)}
  onToggleSourceFilters={() => setShowSourceFilters((value) => !value)}
  onCloseSearch={() => setShowSearchBar(false)}
  onCloseSourceFilters={() => setShowSourceFilters(false)}
/>
```

如果继续使用该组件名，应只负责展开区域，不负责标题区按钮位置。

### 4.4 视觉建议

标题区右侧按钮组：

- `flex`
- `items-center`
- `gap-2`

搜索按钮：

- 使用圆形按钮。
- 建议 `h-9 w-9 rounded-full`。
- 复用 `bg-surface`、`text-text-tertiary`。
- 激活搜索时使用 `bg-primary-soft text-primary`。
- 可以使用简短文字「搜」或现有轻量图标，不新增图标库。

来源按钮：

- 使用胶囊按钮。
- 默认文案「全部来源」。
- 激活来源时显示当前来源名。
- 展开状态可显示上箭头/下箭头文本符号，例如 `⌄`，不引入新图标体系。

展开区域：

- 搜索框继续复用现有输入框样式。
- 来源 chips 继续复用现有 chip 样式。
- 展开区域和工具栏之间保持小间距，避免像新页面模块。

## 5. 数据逻辑保持不变

下面这些逻辑不需要改变：

- `matchesSearchQuery`
- `matchesSourceFilter`
- `visibleArrangements` 派生流水线
- 顶部 `TodaySpotlightSection`
- 编辑 Sheet
- 创建 Sheet
- 状态筛选段

搜索和来源过滤仍只影响下方列表，不影响「今天值得留意」。

## 6. 空状态与清除策略

当 `searchQuery` 或 `sourceFilter !== "all"` 导致无匹配结果时，继续展示当前空状态：

```text
没有匹配的安排
换个关键词或来源试试。
清除筛选
```

点击「清除筛选」时建议同时：

```ts
setSearchQuery("");
setSourceFilter("all");
setShowSearchBar(false);
setShowSourceFilters(false);
```

这样能把页面恢复到最清爽的默认状态。

## 7. 不做内容

这次只做布局与交互紧凑化，不做：

- 不修改搜索匹配规则。
- 不新增高级筛选。
- 不新增排序。
- 不改变来源类型。
- 不改变安排数据模型。
- 不改底部主导航。
- 不接 AI/API/日历/通知。

## 8. 验收标准

完成后应满足：

- 默认进入「安排」页时，不再常驻显示完整搜索框。
- 搜索按钮位于标题区右侧、创建加号左边。
- 默认进入「安排」页时，不再常驻显示完整来源 chips。
- 点击搜索按钮后出现搜索框。
- 输入搜索词后列表仍能按标题、备注、地点、相关人和来源上下文过滤。
- 收起搜索框后，如果搜索词仍存在，页面能看到搜索状态摘要。
- 点击来源按钮后展开来源 chips。
- 选择来源后来源栏自动收起，并显示当前来源摘要。
- 搜索和来源过滤可叠加。
- 点击空状态「清除筛选」后，搜索、来源和展开状态都复位。
- 顶部「今天值得留意」仍不受搜索和来源过滤影响。
- 底部「快记 / 安排 / 洞见 / 我的」样式不变。
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过。

## 9. 推荐实施顺序

1. 新增 `showSearchBar` 和 `showSourceFilters` 状态。
2. 将 header 右侧改为搜索按钮 + 新增按钮，搜索按钮放在加号左边。
3. 将常驻搜索框改为 header 下方按需展开的搜索面板。
4. 将常驻来源 chips 改为今日区域下方的来源展开栏。
5. 调整「清除筛选」同时复位展开状态。
6. 回归搜索、来源过滤、状态筛选、编辑和创建。
7. 更新 `docs/interface_cache.md`。
8. 运行完整验证和浏览器烟测。
