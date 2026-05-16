# 「安排」模块第四阶段最终计划：AI 候选验证准备

## 1. 阶段目标

第四阶段不接入真实 AI，也不做本地关键词自动识别。它只负责把“AI 候选安排验证”这条链路搭起来，为下一阶段接入 AI 预留稳定入口、候选队列、确认流程、忽略状态、来源追溯和正式入库接口。

本阶段保持底部「快记 / 安排 / 洞见 / 我的」完全不变，不新增主标签，不迁移现有 `localStorage` 主体数据，也不修改 `ArrangementItem` 主模型。新标签/新入口的视觉都必须复用现有安排页的卡片、Pill、Sheet、按钮、筛选和详情风格，做到“像原来页面自然长出来的一部分”，而不是另起一套 UI。

## 2. 核心策略

- 视觉统一：候选区、候选卡、确认 Sheet、来源跳转都复用当前安排页现有 token、间距、卡片边框、Pill 和底部 Sheet 交互。
- 结构统一：候选不是新模块页，而是安排页里的一个轻量状态区，位置放在「今天值得留意」下方、状态筛选段上方，仅在有候选时显示。
- 数据统一：正式安排继续走现有 `ArrangementItem`，候选走独立队列，二者通过明确转换工具衔接。
- 入口统一：候选只从现有内容详情里模拟生成，不做自动识别，不新增主导航，不增加新桌面 Modal。
- 复用优先：能复用现有创建/编辑 Sheet、详情 Sheet、来源过滤、时间字段处理、持久化工具的地方，一律复用。

## 3. 候选来源与展示

### 3.1 候选来源

本阶段只保留验证入口，不接真实 AI：

- 快记详情中的「加入安排候选」
- 私聊消息详情中的「加入安排候选」
- 群聊消息详情中的「加入安排候选」

这些入口只负责把当前上下文整理成 `ArrangementSourceDraft`，不直接写入正式安排。

### 3.2 候选展示

在「安排」页新增一个「可能是安排」区块，仅在存在 `pending` 候选时展示。区块样式沿用现有安排页的卡片体系：

- 标题、Pill、按钮、列表密度都与现有安排页一致
- 卡片布局尽量复用 `ArrangementCard` 的排版
- 不做新色板，不做新导航，不做桌面浮层

候选卡仅提供三个操作：

- `确认`
- `忽略`
- `查看来源`

## 4. 候选状态与转换

### 4.1 候选状态

```ts
type ArrangementCandidateStatus = "pending" | "confirmed" | "ignored";

type ArrangementCandidate = {
  id: string;
  title: string;
  note?: string;
  sourceType: ArrangementSourceType;
  sourceRef: ArrangementSourceRef;
  status: ArrangementCandidateStatus;
  confidence?: number;
  reason?: string;
  createdBy: "validation" | "ai";
  createdAt: number;
  updatedAt: number;
};
```

### 4.2 来源草稿

```ts
type ArrangementSourceDraft = {
  title: string;
  note?: string;
  sourceType: ArrangementSourceType;
  sourceRef: ArrangementSourceRef;
};
```

### 4.3 转换工具

```ts
function createArrangementCandidateFromSourceDraft(
  draft: ArrangementSourceDraft
): ArrangementCandidate;

function createArrangementFromCandidate(
  candidate: ArrangementCandidate,
  form: ManualArrangementInput
): ArrangementItem;
```

转换原则：

- 候选默认不进正式列表
- 候选确认时复用现有安排创建/编辑 Sheet
- 确认后再把候选信息折叠进正式 `ArrangementItem`
- 正式安排仍然通过现有 `sourceType` 和 `sourceRefs` 承载来源

## 5. 数据与接口

### 5.1 候选本地存储

新增独立候选存储，不影响正式安排存储：

```ts
const arrangementCandidatesStorageKey =
  "arkme-demo.arrangementCandidates";

const arrangementCandidatesStorageEvent =
  "arkme-demo:arrangement-candidates-updated";
```

### 5.2 数据层职责

`src/data/arrangements.ts` 负责：

- 候选 normalize
- 候选读取与持久化
- 候选状态更新
- 候选到正式安排的转换
- 去重判断

`Home.tsx` 只负责：

- 从快记 / 消息详情构造 `ArrangementSourceDraft`
- 调用候选创建工具
- 不承载候选业务规则

`Arrangements.tsx` 负责：

- 读取 `pending` 候选
- 展示候选区块
- 调起确认 Sheet
- 处理忽略与查看来源

## 6. 交互设计

### 6.1 确认流程

用户点击候选的 `确认` 后：

1. 打开复用现有安排创建 / 编辑风格的底部 Sheet
2. 预填候选标题、时间、地点、相关人、备注
3. 用户可继续修改
4. 保存后生成正式安排
5. 候选转为已确认或从 pending 中移出

### 6.2 忽略流程

用户点击 `忽略` 后：

- 候选进入 ignored 状态
- 刷新后不再展示
- 不影响正式安排列表

### 6.3 查看来源

用户点击 `查看来源` 后：

- 回到对应快记、私聊或群聊上下文
- 复用现有来源跳转逻辑
- 不新增独立来源浏览页

## 7. 去重与边界

去重规则保持简单明确：

- 同一 `sourceRef.messageId` 已存在 pending / confirmed 候选时，不重复创建
- 同一 `sourceRef.id` 已存在 pending / confirmed 候选时，不重复创建
- 候选不自动合并相似项
- 不做批量候选确认

本阶段明确不做：

- 真实 AI API
- 本地关键词自动识别
- 自动合并相似安排
- 日历视图
- 系统通知
- 循环提醒
- 后端同步
- 底部导航改版

## 8. 验收标准

完成后应满足：

- 底部四个标签样式不变
- 候选只在安排页内容区出现，不破坏原有信息层级
- 快记 / 私聊 / 群聊详情都能加入候选
- 候选确认时复用现有安排 Sheet 风格
- 正式安排列表可看到确认结果
- 来源追溯可回到原上下文
- 忽略后的候选刷新后不再展示
- `ArrangementItem` 主模型不变
- `localStorage` 正式安排存储结构不变
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过

## 9. 推荐实施顺序

1. 在 `src/data/arrangements.ts` 增加候选数据结构、持久化和转换工具
2. 在 `RecordDetailSheet` 和消息详情入口补上「加入安排候选」
3. 在 `Home.tsx` 只做草稿构造与入口转发
4. 在 `Arrangements.tsx` 复用现有样式搭建候选区块
5. 增加确认、忽略、查看来源和去重逻辑
6. 更新 `docs/interface_cache.md`
7. 同步候选人日志与 `src/data/aiConversationLog.ts`
8. 跑完整验证

