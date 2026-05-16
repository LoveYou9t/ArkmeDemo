# 「安排」真实 AI 调用接入计划

## 1. 当前状态判断

`docs/arrangements-phase-four-iteration-plan.md` 中第四阶段已经完成了 AI 接入前最关键的验证闭环：候选队列、确认 Sheet、忽略状态、来源追溯和正式入库接口都已经有现成实现。当前尚未完成的是“真实 AI 调用”：候选仍只能由用户在快记、私聊、群聊详情里手动点击「加入安排候选」生成，`createdBy: "ai"`、`confidence`、`reason` 和 `aiSuggestion` 来源类型只是预留，还没有由模型产出。

下一阶段不应重写候选区，也不应改 `ArrangementItem` 主模型。正确路径是新增一层真实 AI 识别服务，把快记 / 私聊 / 群聊上下文发给 AI，得到结构化候选结果后，继续写入现有 `ArrangementCandidate` 队列，让用户用已落地的确认流程决定是否保存为正式安排。

## 2. 阶段目标

- 接入真实 AI 调用，从快记、私聊、群聊内容中识别可能的安排。
- AI 结果只进入「可能是安排」候选队列，不直接写入正式安排。
- 最大化复用现有 `ArrangementCandidate`、`ArrangementSourceDraft`、候选 localStorage、候选区、确认 Sheet、来源追溯和正式安排转换工具。
- 保持底部四标签、安排页主布局、来源筛选、搜索、今日关注和正式安排列表不变。
- 前端必须有失败、无候选、识别中、重复候选的可用状态。

## 3. 推荐复用点

### 3.1 数据模型复用

继续复用：

- `ArrangementCandidate`
- `ArrangementSourceDraft`
- `ArrangementSourceRef`
- `createArrangementFromCandidate`
- `persistArrangementCandidates`
- `updateArrangementCandidateStatus`

需要扩展的是候选创建入口，而不是正式安排模型。

建议新增：

```ts
type AiArrangementCandidateDraft = {
  title: string;
  note?: string;
  confidence?: number;
  reason?: string;
};

type AiArrangementRecognitionResult = {
  candidates: AiArrangementCandidateDraft[];
  rawText?: string;
};
```

然后把 AI 草稿转换为现有候选：

```ts
function createArrangementCandidateFromAiDraft(
  draft: AiArrangementCandidateDraft,
  sourceDraft: ArrangementSourceDraft
): ArrangementCandidate;
```

转换后的候选应设置：

- `createdBy: "ai"`
- `sourceType` 沿用原上下文来源：`sendToSelf` / `privateChat` / `groupChat`
- `sourceRef` 沿用原消息或快记引用
- `confidence` 写入 AI 置信度
- `reason` 写入 AI 识别理由

正式保存时继续由 `createArrangementFromCandidate` 将 `aiCapability` 置为 `aiAssist`。

## 4. AI 调用服务层

新增独立服务文件：

```txt
src/services/arrangementAi.ts
```

职责：

- 组装提示词和上下文
- 调用真实 AI API
- 解析结构化 JSON
- 做最小字段校验
- 将异常统一返回给 UI

建议接口：

```ts
type RecognizeArrangementCandidatesInput = {
  sourceDraft: ArrangementSourceDraft;
  locale?: "zh-CN" | "en-US";
};

async function recognizeArrangementCandidates(
  input: RecognizeArrangementCandidatesInput
): Promise<AiArrangementRecognitionResult>;
```

服务层不要读写 React state，也不要直接操作 Sheet。它只返回结构化候选草稿。

## 5. API 形态

如果项目仍保持纯前端 Demo，不建议把真实 API Key 写进浏览器代码。推荐新增一个轻量后端代理或开发期 API 路由：

```txt
src/server/arrangementAiProxy.ts
```

或在后续框架升级时迁移为：

```txt
api/arrangement-recognize
```

前端只请求本地代理：

```ts
POST /api/arrangement-recognize
{
  "source": {
    "title": "...",
    "excerpt": "...",
    "type": "privateChat",
    "createdAt": 1778950000000
  }
}
```

代理读取环境变量：

```txt
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
```

计划默认使用 Responses API，并要求模型输出 JSON。前端只能接收代理返回的候选数组，不接触密钥。

## 6. 提示词约束

AI 只负责识别“是否值得进入候选确认”，不能替用户创建安排。

输出结构建议固定为：

```json
{
  "candidates": [
    {
      "title": "周五前整理面试复盘",
      "note": "来源消息提到需要在周五前完成整理。",
      "confidence": 0.86,
      "reason": "文本包含明确行动和时间约束。"
    }
  ]
}
```

约束：

- 无安排时返回空数组
- 不得编造来源文本不存在的人名、地点和时间
- 标题控制在 30 字以内
- `confidence` 范围为 `0` 到 `1`
- `reason` 用一句话说明识别依据

## 7. UI 接入方式

优先在已有详情页入口旁边扩展，不新增主页面：

- 快记详情：保留「加入安排候选」，新增或替换为「AI 识别安排」
- 私聊消息详情：同上
- 群聊消息详情：同上

点击后：

1. 当前按钮进入 loading 状态，文案为「识别中」
2. 调用 `recognizeArrangementCandidates`
3. 若返回候选，写入现有候选队列
4. 若无候选，显示轻量提示「没有识别到明确安排」
5. 若失败，显示轻量提示「AI 识别失败，可手动加入候选」

安排页的「可能是安排」区块继续复用现有样式，只需要在候选卡上补充 AI 信息：

- `createdBy === "ai"` 时展示 `AI 建议` Pill
- 有 `confidence` 时展示「可信度 xx%」
- 有 `reason` 时展示识别理由

## 8. 去重策略

现有去重主要按 `sourceRef.messageId || sourceRef.id`。接入 AI 后同一条消息可能识别出多个候选，因此需要把去重 key 扩展为：

```ts
sourceRefKey + normalizedCandidateTitle
```

规则：

- 同一来源 + 同一标题的 pending / confirmed 候选不重复写入
- 同一来源可存在多个不同标题候选
- ignored 候选如果 AI 再次识别到同标题，不自动恢复，除非后续明确增加「重新识别」能力

## 9. 尚不做的事

本计划仍不做：

- 自动后台扫描全部历史消息
- 无用户触发的静默 AI 调用
- AI 直接创建正式安排
- 日历视图
- 系统通知
- 多轮追问补全
- 后端账号同步
- 修改 `ArrangementItem` 主模型

## 10. 推荐实施顺序

1. 在 `src/services/arrangementAi.ts` 定义 AI 识别输入、输出和调用函数。
2. 在数据层新增 `createArrangementCandidateFromAiDraft` 与批量保存 AI 候选工具。
3. 增加真实 AI 代理接口，密钥只从环境变量读取。
4. 在 `RecordDetailSheet` 和 `RecordFullDetailScreen` 加入「AI 识别安排」触发入口与 loading / error / empty 状态。
5. 在 `Home.tsx` 复用现有 `createArrangementSourceDraftFromRecord`，调用 AI 服务并保存候选。
6. 在 `Arrangements.tsx` 候选卡复用现有 Pill 展示 AI 建议、置信度和理由。
7. 更新 `docs/interface_cache.md`。
8. 同步候选人日志与 `src/data/aiConversationLog.ts`。
9. 运行 `C:\nvm4w\nodejs\pnpm.CMD verify:answer`。

## 11. 验收标准

- 快记 / 私聊 / 群聊详情能触发真实 AI 识别。
- 无 API Key 或网络失败时页面不崩溃，并能继续手动加入候选。
- AI 返回候选后，「安排」页出现现有风格的「可能是安排」卡片。
- AI 候选确认后进入正式安排列表，`aiCapability` 为 `aiAssist`。
- 忽略、查看来源、来源筛选、搜索、今日关注和新增安排保持原有行为。
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过。
