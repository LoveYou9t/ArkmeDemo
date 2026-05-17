# AI 识别自动填充安排规划案

## Summary

目标是让 AI 识别不只是判断“可能是安排”，而是能从同一聊天上下文中自动分析并预填完整安排信息：内容、时间、地点、相关人和备注。正式安排仍必须经过用户确认 Sheet，AI 只生成候选草稿，不直接创建正式安排。

当前代码已经具备基础字段：`AiArrangementRecognitionResult` 支持 `title/timeDraft/location/people/note/confidence/reason`，`ArrangementCandidate` 支持 `timeDraft/location/people/note`，确认 Sheet 也能从候选预填。后续重点是把 AI 任务定义、上下文输入、结果校验、兜底合并和 UI 呈现做稳定。

## Key Changes

### 1. 明确 AI 自动分析任务

- AI 输入不只传当前消息，而是传本地回溯后的 `ArrangementSourceDraft`：原始安排消息、确认回复、改期消息、来源会话、候选语义 key、本地时间草稿。
- AI 输出必须是结构化 JSON，字段固定为：
  - `hasArrangement`: 是否存在明确安排。
  - `title`: 安排内容，需总结成可执行标题，例如“明天下午到公司面试”。
  - `timeDraft`: 使用现有 `ArrangementTimeDraft`，支持 `none / relativeDay / weekday / date`，可带 `part` 和 `clock`。
  - `location`: 地点，文本中没有则为空字符串。
  - `people`: 相关人数组，只提取文本或上下文中出现的人。
  - `note`: 备注，记录确认回复、改期信息、限制条件或 AI 判断依据。
  - `confidence` / `reason`: 用于候选卡展示可信度和理由。

### 2. 强化提示词和 Schema

- 系统提示词明确要求 AI 分析“谁、什么时间、在哪里、做什么、备注”，并禁止编造未出现的信息。
- 用户提示词应包含当前日期、会话来源、原始消息、确认回复、改期消息、本地规则识别出的时间草稿。
- JSON Schema 保持严格模式；建议把 `timeDraft` 统一为固定对象字段，减少 Responses API 对 `anyOf` 的兼容风险。
- `normalizeResult()` 继续做安全裁剪：标题最长 60，地点最长 40，备注最长 240，相关人最多 6 个。

### 3. AI 结果作为候选主数据

- AI 配置完整时，`recognizeArrangementCandidate(localDraft)` 的结果优先写入候选：
  - `title` 用 AI 总结后的可执行安排标题。
  - `timeDraft` 用 AI 返回值；AI 未返回时才使用本地规则时间草稿兜底。
  - `location/people/note` 直接进入候选并预填确认 Sheet。
- AI 失败、未配置或跨域失败时，继续保存本地规则候选，保证 Demo 流程不中断。
- 候选保存继续使用本地 `semanticKey`，AI 标题变化不影响同一安排合并。

### 4. UI 与确认流程

- “可能是安排”卡片展示 AI 总结标题、地点/相关人、备注摘要、AI 建议标签和可信度。
- 点击确认时，确认 Sheet 自动带入：
  - 内容：AI 标题。
  - 时间：`timeDraft` 转换后的时间控件状态。
  - 地点：`location`。
  - 相关人：`people.join("、")`。
  - 备注：`note`。
- 用户仍可编辑所有字段，确认后才创建正式 `ArrangementItem`。

### 5. 去重与改期

- 同一安排继续以 `semanticKey = conversationId + 原始安排消息 uid` 合并。
- 简短确认、改期确认、AI 结果都写入同一候选，不新增第二张卡。
- 改期消息优先更新 `timeDraft`，备注中保留“改期请求”和“确认回复”摘要。
- 快速扫描计数按唯一候选 ID 统计，避免同一安排重复计数。

## Test Plan

- AI 开启且配置完整：
  - 群聊：“明天下午能来公司面试吗” + “能的” 生成一条候选，内容类似“明天下午到公司面试”，时间为明天下午，地点为公司，备注包含确认回复。
  - 改期：“改到晚上可以吗” + “可以的” 更新同一候选时间为晚上，不新增候选。
  - 复杂场景：“下周三 10:30 和小李在会议室复盘项目，记得带方案”能预填时间、地点、相关人和备注。
  - AI 返回空地点或空相关人时，UI 留空，不填假数据。

- AI 关闭或失败：
  - 仍走本地规则候选，至少保证标题、来源、时间草稿和去重正常。
  - `Failed to fetch` 或 401/429 不阻断本地候选保存。

- 验证命令：
  - `C:\nvm4w\nodejs\pnpm.CMD lint`
  - `C:\nvm4w\nodejs\pnpm.CMD build`
  - `C:\nvm4w\nodejs\pnpm.CMD verify:codex-log`
  - `C:\nvm4w\nodejs\pnpm.CMD verify:answer`

## Assumptions

- 本轮规划继续沿用当前浏览器直连 OpenAI 的设置方式，不切换回同源代理。
- AI 只生成候选草稿，不直接创建正式安排。
- 未在文本或上下文中出现的地点、人物、精确时间不能由 AI 编造。
- 本地规则继续负责上下文回溯、`semanticKey`、失败兜底和去重合并。
