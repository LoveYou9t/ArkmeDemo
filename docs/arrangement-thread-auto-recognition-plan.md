# 多人同一安排关联与新对话自动识别规划

## Summary

当前系统已经能把同一会话里的“原始安排消息 + 简短确认/改期回复”合并为一条候选，但还没有真正的多人讨论事件级归并机制，也没有新消息进入后自动识别安排的机制。

本阶段目标是新增“会话事件簇”识别链路：当多人在同一聊天里围绕同一件事补充时间、地点、参与人、确认或改期时，AI 和本地规则都归并到同一条安排候选；同时新增新消息自动识别，让候选生成不再完全依赖手动点击或快速扫描。

## Current Findings

- `Home.tsx` 中的 `getLocalArrangementSemanticResult()` 目前只处理同一会话内的短确认和改期回溯，核心是找到原始安排消息作为 `baseRecord`。
- `deriveLocalArrangementCandidateDraft()` 会用 `conversationId + ":" + baseRecord.uid` 生成 `semanticKey`，适合“提问 + 回复”场景，但不能表达多名用户多条消息共同构成一个安排。
- `arrangements.ts` 中的保存层已支持按 `semanticKey` 合并，并有“短确认标题 vs 原始安排标题”的同会话兜底合并，可以继续复用。
- `ArrangementCandidate` 目前只有单个 `sourceRef`，而正式安排 `ArrangementItem` 才有 `sourceRefs[]`。这意味着候选阶段还无法完整保存“多条消息共同指向同一安排”的来源集合。
- `createTestReply()` 新增消息后只保存到 `testMessages`，不会自动触发 `recognizeArrangementCandidateFromRecord()` 或快速扫描。
- `scanRecentConversationsForArrangements()` 是手动快速扫描入口，不是实时自动识别机制。

## Key Changes

### 1. 新增会话级识别上下文

新增轻量上下文构造函数，例如 `buildArrangementThreadContext(record, contextRecords)`，为 AI 和本地规则提供同一份会话视图：

- 当前消息。
- 同一 `conversationId` 下最近若干条消息。
- 每条消息的发送人、发送时间、文本、消息 id。
- 已识别到的原始安排消息、改期消息、确认回复。
- 当前会话已有 pending/confirmed 候选摘要。

AI 开启且配置完整时，请求 `/api/arrangement-recognition` 时携带该上下文；AI 关闭、失败或配置不完整时，继续使用本地规则兜底。

### 2. 引入事件级归并 key

保留现有 `semanticKey` 兼容逻辑，同时新增更适合多人讨论的归并策略：

- 同一会话内优先锚定最早的安排定义消息。
- 如果后续消息只是补充地点、参与人、时间或确认，继续使用同一个 `semanticKey`。
- AI 可返回 `relatedMessageIds` 或 `eventFingerprint`，用于辅助判断当前消息属于哪个已有安排。
- 保存层先按 `semanticKey` 合并，再按同会话、相近时间、相同主题/地点/参与人的近似规则兜底合并。

第一版建议只做同一 `conversationId` 内的事件归并，不做跨私聊、群聊或不同会话的全局合并，避免误合并。

### 3. 扩展候选来源模型

扩展 `ArrangementCandidate`：

```ts
type ArrangementCandidate = {
  sourceRef: ArrangementSourceRef;
  sourceRefs?: ArrangementSourceRef[];
};
```

兼容策略：

- `sourceRef` 保留为主来源，用于现有“查看来源”和旧缓存兼容。
- `sourceRefs` 存放所有关联消息来源。
- 读取旧候选时，如果没有 `sourceRefs`，自动用 `[sourceRef]` 补齐。
- 合并候选时合并并去重 `sourceRefs`。
- 用户确认候选创建正式安排时，将 `candidate.sourceRefs ?? [candidate.sourceRef]` 写入 `ArrangementItem.sourceRefs`。

### 4. 新消息自动识别

在新测试消息写入后增加自动识别队列：

- 按 `conversationId` 做 debounce，避免连续多条消息触发多次 AI 请求。
- 只处理最近未识别消息，避免每次重复扫描全部历史。
- 自动识别仍然只生成或更新“可能是安排”候选，不直接创建正式安排。
- 识别状态写入本地记录，例如 `arkme-demo.arrangementRecognitionState`，保存已处理 message id、最近处理时间和失败摘要。
- 保留快速扫描入口，用于补扫历史消息、调试诊断和手动兜底。

建议触发点：

- 用户在测试会话中回复后。
- 新的对方消息进入 `testMessages` 后。
- 未来如果接入真实消息源，也走同一个队列入口。

### 5. AI 自动填充复用现有链路

不重写候选闭环，继续复用现有能力：

- `deriveLocalArrangementCandidateDraft()` 继续负责本地回溯和基础 `semanticKey`。
- `recognizeArrangementCandidate()` 继续请求同源 `/api/arrangement-recognition`。
- `saveArrangementCandidateFromAiDraft()` 继续负责保存和合并。
- `getEditorFormFromCandidate()` 继续负责确认 Sheet 预填。

AI 负责根据会话上下文输出：

- 内容。
- 时间。
- 地点。
- 相关人。
- 一句话备注。
- 置信度和理由。
- 关联消息 id 或事件指纹。

### 6. UI 展示保持克制

候选区仍然只展示一张合并后的候选卡：

- 标题展示 AI 或本地规则总结后的安排内容。
- 标签继续复用现有 `MetaPill` / 胶囊风格。
- 来源区域可显示主来源，详情或“查看来源”中展示多条关联消息。
- 不新增大面积说明卡，不改变正式安排确认流程。

## Test Plan

### 多人讨论同一安排

群聊中依次发送：

1. 面试官：`明天下午能来公司面试吗`
2. 用户：`能的`
3. 用户A：`到 3 楼会议室`
4. 面试官：`改到晚上可以吗`
5. 用户：`可以的`

预期：

- “可能是安排”只出现一条候选。
- 候选标题是可执行安排，而不是某条短回复。
- 时间更新为晚上。
- 地点包含公司或 3 楼会议室。
- 备注是一句话总结。
- 来源能追溯到多条相关消息。

### 新消息自动识别

- 新增安排消息后，不点击“快速扫描”，候选区也能自动出现候选。
- 新增确认回复后，更新同一候选，不新增第二张卡。
- 新增地点或参与人补充后，更新同一候选的地点或相关人。
- 新增无关闲聊，不生成候选。

### AI 失败或未配置

- AI 未启用、代理失败或模型错误时，本地规则仍能处理短确认和改期。
- 诊断日志记录自动识别阶段、AI 成功/失败、本地回退。
- 自动识别失败不阻塞聊天消息发送和展示。

### 回归验证

- 手动“加入安排候选”仍可用。
- 快速扫描仍可用。
- 候选确认 Sheet 仍能预填内容、时间、地点、相关人和备注。
- 已有旧候选缓存能正常读取，缺失 `sourceRefs` 时自动兼容。

## Assumptions

- 第一版只处理同一会话内的多人讨论归并，不做跨会话全局关联。
- 自动识别采用 debounce 后台触发，不阻塞发消息体验。
- AI 只生成或更新候选，不直接创建正式安排。
- 候选 UI 继续复用现有“可能是安排”区域、`MetaPill`、确认 Sheet 和来源查看能力。
- 本轮规划不改变正式安排的数据主模型，只扩展候选阶段的来源承载能力。
