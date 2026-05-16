# 「安排」模块第一阶段代码修改计划

## 1. 第一阶段目标

第一阶段只做一个稳定、可体验、可继续扩展的「安排」基础模块。目标是让移动端 Demo 出现真实可用的安排页，并完成最小闭环：

- 新增底部「安排」Tab。
- 展示安排列表和初始示例。
- 支持手动创建安排。
- 支持查看安排详情。
- 支持完成、以后再说、恢复和归档。
- 使用 localStorage 保留用户创建和状态变化。
- 为后续 AI 识别、对话来源、合并、日历、提醒和 API 绑定预留字段。

本阶段不做真实大模型调用，不做真实私聊/群聊自动识别，不做日历月视图，不做通知提醒。

## 2. 已阅读代码结论

当前项目已有足够的移动端基础设施，第一阶段应尽量复用，不另起一套应用架构。

可复用内容：

- `src/layouts/AppShell.tsx`：已有移动端设备壳和状态栏。
- `src/App.tsx`：已有 `PageType` 和主页面切换状态。
- `src/pages/Home.tsx`：已有底部导航、主内容分支、侧边栏、搜索、快记和本地状态模式。
- `src/components/RecordDetailSheet.tsx`：已有底部详情 Sheet 样式和遮罩交互。
- `src/components/EmptyState.tsx`：已有空状态组件。
- `src/lib/time.ts`：已有时间展示工具。
- `src/data/testConversations.ts`：已有 localStorage 读写、归一化、存储事件通知模式。
- `src/types/record.ts`：已有来源引用模型，可作为安排来源上下文设计参照。

已按 `Interface & Model Tracking Rule` 将关键复用点记录到 `docs/interface_cache.md`。

## 3. 建议新增文件

### 3.1 `src/types/arrangement.ts`

职责：定义安排模块核心数据模型。

计划新增：

```ts
export type ArrangementStatus = "active" | "done" | "later" | "archived";
export type ArrangementTimeKind = "none" | "deadline" | "timeRange" | "reminder" | "fuzzy";
export type ArrangementSourceType = "manual" | "sendToSelf" | "privateChat" | "groupChat" | "aiSuggestion";
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
```

取舍：

- 字段比第一版 UI 需要的更多，是为了后续 AI 识别和合并不重写数据模型。
- 不引入复杂枚举对象，保持 TypeScript union 简洁。

### 3.2 `src/data/arrangements.ts`

职责：提供初始示例、本地存储、归一化和创建工具。

计划新增内容：

- `arrangementsStorageKey = "arkme-demo.arrangements"`
- `getInitialArrangements(baseTime?: number): ArrangementItem[]`
- `persistArrangements(items: ArrangementItem[]): void`
- `createManualArrangement(input): ArrangementItem`
- `normalizeArrangement(value, index): ArrangementItem | null`
- `arrangementsStorageEvent = "arkme-demo:arrangements-updated"`，可选

复用思路：

- 参考 `src/data/testConversations.ts` 的 `readJsonValue` / `writeJsonValue` / normalize 模式。
- localStorage 失败时不抛错，保持 Demo 可用。
- 初始示例数据放在这里，不散落在页面组件里。

### 3.3 `src/pages/Arrangements.tsx`

职责：安排模块主页面。

建议暂时放一个页面文件，不在第一阶段拆太多组件。原因是第一阶段交互还会快速调整，过早拆分会增加来回跳转。

页面内部可以先包含：

- `ArrangementCard`
- `ArrangementDetailSheet`
- `ArrangementEditorSheet`
- `SegmentedFilter`

如果文件超过约 450 行，再拆到 `src/components/arrangements/`。

## 4. 建议修改现有文件

### 4.1 `src/App.tsx`

修改：

```ts
export type PageType = "records" | "arrangements" | "insight" | "mine";
```

影响：

- 只扩展 union，不改变现有路由判断。
- 默认页仍保持 `"records"`。

### 4.2 `src/pages/Home.tsx`

修改点：

1. 引入 `Arrangements` 页面：

```ts
import Arrangements from "@/pages/Arrangements";
```

2. 顶部 `tabs` 增加：

```ts
const tabs: TabItem[] = [
  { key: "records" },
  { key: "arrangements" },
  { key: "insight" },
  { key: "mine" },
];
```

3. `renderMainContent` 增加分支：

```tsx
if (currentPage === "arrangements") {
  return <Arrangements />;
}
```

4. `getTabLabel` 增加：

```ts
if (page === "arrangements") return t("tabs.arrangements");
```

5. 底部导航保持现有 `MobileBottomNavigation`，不新写导航。

注意：

- 不改现有侧边栏和快记入口。
- 不让安排页参与 `recordDetail`、`showSearch` 等快记状态。
- 底部导航隐藏条件沿用现状。

### 4.3 `src/settings/preferences.ts`

修改：

- `zh-CN` 增加 `"tabs.arrangements": "安排"`。
- `zh-TW` 增加 `"tabs.arrangements": "安排"` 或 `"安排"`。
- `en-US` 增加 `"tabs.arrangements": "Plans"` 或 `"Arrangements"`。

第一阶段安排页主体可以先使用中文静态文案。若时间充足，再补完整多语言 key。

### 4.4 `docs/interface_cache.md`

如果新增 `ArrangementItem`、`getInitialArrangements`、`Arrangements` 等关键模型和状态流，编码时继续补充该文件。

## 5. 第一阶段页面结构

`Arrangements` 页面建议结构：

```tsx
export default function Arrangements() {
  const [arrangements, setArrangements] = React.useState(getInitialArrangements);
  const [activeFilter, setActiveFilter] = React.useState<ArrangementFilter>("all");
  const [selectedArrangement, setSelectedArrangement] = React.useState<ArrangementItem | null>(null);
  const [showEditor, setShowEditor] = React.useState(false);

  return (
    <div className="flex h-full flex-col bg-bg">
      <header>...</header>
      <main>...</main>
      <ArrangementDetailSheet />
      <ArrangementEditorSheet />
    </div>
  );
}
```

页面层负责：

- 读取和持久化 arrangements。
- 处理状态流转。
- 计算筛选和分组。
- 打开/关闭详情和创建弹层。

卡片和弹层只负责展示和触发回调。

## 6. 第一阶段状态流转

### 6.1 创建

触发：右上角 `+`。

流程：

1. 打开创建 Sheet。
2. 用户输入标题，可选时间、地点、相关人、备注。
3. 点击保存。
4. 创建 `ArrangementItem`，状态为 `active`。
5. 写入 state 和 localStorage。
6. 关闭 Sheet。

### 6.2 完成

触发：

- 卡片左侧圆圈。
- 详情 Sheet 主按钮。

状态变化：

```ts
status: "active" | "later" -> "done"
completedAt: Date.now()
updatedAt: Date.now()
```

### 6.3 以后再说

触发：

- 详情 Sheet 次按钮。
- 第一阶段也可以在卡片上放一个轻按钮，先不做右滑。

状态变化：

```ts
status: "active" -> "later"
laterAt: Date.now()
updatedAt: Date.now()
```

### 6.4 恢复

触发：详情 Sheet 中 `重新放回安排`。

状态变化：

```ts
status: "later" | "done" -> "active"
completedAt: undefined
laterAt: undefined
updatedAt: Date.now()
```

### 6.5 归档

触发：详情 Sheet 中 `归档`。

状态变化：

```ts
status: "archived"
updatedAt: Date.now()
```

归档项第一阶段不在列表展示。

## 7. 第一阶段筛选与分组

筛选：

- `all`：展示 active、later、done，不展示 archived。
- `near`：展示 active 且有明确近期时间或较高 attentionScore。
- `later`：展示 later。
- `done`：展示 done。

分组：

- `今天值得留意`：取 active 中 attentionScore 高或 startAt 接近的 1-2 条。
- `近期`：active。
- `以后再说`：later。
- `已完成`：done。

第一阶段可以不用做复杂“今天/明天/本周”日期算法，避免过度开发。卡片上显示时间标签即可。

## 8. 第一阶段 UI 草案

页面：

```text
安排                                      +
未来的事，轻一点放在这

今天值得留意
[ ○ 后天去医院复查             ]
[   后天 · 医院 · 爸爸、姐姐    ]
[   合并了 3 段上下文           ]

全部  近期  以后再说  已完成

近期
[ ○ 明天到公司帮小李带早餐      ]
[   明天上午 · 公司 · 来自私聊   ]
[   AI已识别  可提醒            ]

[ ○ 整理安排模块第一版交互      ]
[   还没有时间 · AI可协助       ]
```

视觉规则：

- 页面背景使用 `bg-bg`。
- 卡片使用 `bg-surface`、`rounded-[12px]`、轻边框或轻阴影。
- 主操作使用 `text-primary` 或 `bg-primary`。
- 不使用大面积红色。
- 标签使用浅底色，如 `bg-fill-3`、`bg-primary-soft`。

## 9. 第一阶段尽量复用策略

必须复用：

- 继续由 `AppShell` 提供移动端壳。
- 继续使用 `Home` 的底部导航。
- 继续使用 `usePreferences` 获取 tab 文案和主题状态。
- 继续使用 `cn` 拼 className。
- 时间展示优先用 `formatTimeLabel`、`formatBubbleTime`。
- 空状态使用 `EmptyState`。
- localStorage 容错模式参考 `testConversations.ts`。

建议复用但不强行抽象：

- `RecordDetailSheet` 的底部弹层结构和 DetailRow 视觉。
- `ChatInput` 的输入体验作为创建弹层参考。
- `RecordSourceConversation` 的来源结构作为 `ArrangementSourceRef` 设计参考。

暂不复用：

- `components/ui/Modal`：当前是桌面居中弹窗，不适合移动端安排创建。
- `components/ui/Card`：默认带 `bg-white/80` 和 hover 阴影，和当前移动端页面卡片风格不完全一致；安排卡片直接用 Tailwind 和 token 更稳。

## 10. 第一阶段风险与规避

风险 1：`Home.tsx` 已经很大。

规避：

- 安排页面放到 `src/pages/Arrangements.tsx`。
- `Home.tsx` 只做 tab、分支和导入改动。

风险 2：新增四个底部 Tab 后拥挤。

规避：

- 复用现有 flex 均分。
- 文案都保持 2-4 字。
- 不在第一阶段加复杂图标。

风险 3：状态变更后 localStorage 和 UI 不一致。

规避：

- 所有变更走统一 `updateArrangements` 包装函数。
- 每次 setState 前计算 next，并立即 `persistArrangements(next)`。

风险 4：后续 AI 接入时数据结构不够。

规避：

- 第一阶段就保留 `sourceRefs`、`sourceType`、`aiCapability`、`attentionScore`。
- 示例数据覆盖手动、私聊、合并、AI 可协助。

## 11. 编码顺序

建议下一步按这个顺序改：

1. 新增 `src/types/arrangement.ts`。
2. 新增 `src/data/arrangements.ts`，包含示例和 localStorage。
3. 新增 `src/pages/Arrangements.tsx`，先写静态列表和状态按钮。
4. 在 `src/App.tsx` 增加 `"arrangements"`。
5. 在 `src/pages/Home.tsx` 接入 Tab 和页面分支。
6. 在 `src/settings/preferences.ts` 增加 tab 文案。
7. 回到 `Arrangements.tsx` 完成创建 Sheet 和详情 Sheet。
8. 补充 `docs/interface_cache.md` 中新增 Arrangement 模型记录。
9. 运行 `C:\nvm4w\nodejs\pnpm.CMD verify:answer`。

## 12. 验收清单

开发完成后至少检查：

- 打开 `http://127.0.0.1:5173/` 能看到底部「安排」Tab。
- 点击「安排」后页面不影响快记、洞见、我的。
- 初始示例安排展示正常。
- 新建安排后列表立即出现。
- 刷新页面后新建安排仍存在。
- 点击安排能打开详情。
- 完成后进入已完成筛选。
- 以后再说后进入以后再说筛选。
- 恢复后回到近期/全部。
- 归档后从列表消失。
- `verify:answer` 通过。
