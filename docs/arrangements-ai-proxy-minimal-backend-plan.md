# 安排 AI 识别最小后端代理方案

## 背景

当前 `Failed to fetch` 不是按钮位置问题，而是浏览器前端直接请求 `${baseUrl}/responses` 导致的网络边界问题。

前端在浏览器里直连 `https://api.openai.com/v1/responses` 时，会携带 `Authorization` 和 `Content-Type: application/json` 等请求头。该请求属于跨域非简单请求，浏览器会先发起 CORS 预检；真实 OpenAI API 不应作为浏览器直连接口使用，因此前端容易被 CORS/预检拦截，最终只能拿到 `TypeError: Failed to fetch`。同时 API Key 暴露在浏览器本地配置里，也不适合作为最终方案。

## 目标

- 前端不再请求 `${baseUrl}/responses`。
- 前端统一请求同源接口：`POST /api/arrangement-recognition`。
- Node/Vite 中间层在服务端读取 OpenAI API Key，并转发到 OpenAI Responses API。
- 浏览器不再保存或发送 OpenAI API Key。
- 继续复用现有“可能是安排”候选队列和用户确认流程。

## 最小架构

```text
浏览器前端
  POST /api/arrangement-recognition
        |
        v
本地 Node/Vite 中间层
  - 校验请求体
  - 读取 process.env.OPENAI_API_KEY
  - 调用 https://api.openai.com/v1/responses
  - 规范化返回结构
        |
        v
OpenAI Responses API
```

## 接口设计

### Request

```ts
type ArrangementRecognitionApiRequest = {
  sourceDraft: ArrangementSourceDraft;
  model?: string;
};
```

说明：

- `sourceDraft` 继续复用现有安排候选来源结构。
- `model` 可选。前端可传设置页里的模型名；若未传，后端使用 `OPENAI_MODEL` 或默认模型。
- 不包含 `apiKey` 和 `baseUrl`。

### Response

```ts
type ArrangementRecognitionApiResponse =
  | {
      ok: true;
      result: AiArrangementRecognitionResult;
    }
  | {
      ok: false;
      error: string;
    };
```

其中 `AiArrangementRecognitionResult` 继续使用现有结构：

```ts
type AiArrangementRecognitionResult = {
  hasArrangement: boolean;
  title: string;
  note?: string;
  confidence?: number;
  reason?: string;
};
```

## 后端最小实现方式

优先使用 Vite dev server middleware，避免额外引入 Express。

新增文件建议：

- `server/arrangementRecognitionProxy.ts`

职责：

- 暴露 `arrangementRecognitionProxy(req, res)`。
- 只处理 `POST /api/arrangement-recognition`。
- 从请求体读取 `sourceDraft` 和可选 `model`。
- 从环境变量读取：
  - `OPENAI_API_KEY`
  - `OPENAI_BASE_URL`，默认 `https://api.openai.com/v1`
  - `OPENAI_MODEL`，作为前端未传模型时的兜底
- 服务端调用 `${OPENAI_BASE_URL}/responses`。
- 返回统一 JSON，不把 OpenAI 原始错误完整透传给前端。

`vite.config.ts` 中接入：

```ts
server: {
  configureServer(server) {
    server.middlewares.use("/api/arrangement-recognition", arrangementRecognitionProxy);
  },
}
```

如果后续需要生产部署，再把同一段 handler 迁移到轻量 Node 服务或平台 API route；前端协议无需变化。

## 前端改造点

### 1. 调整 `src/services/arrangementAi.ts`

从：

```ts
fetch(getResponsesEndpoint(settings.baseUrl), {
  headers: {
    Authorization: `Bearer ${settings.apiKey.trim()}`,
  },
});
```

改为：

```ts
fetch("/api/arrangement-recognition", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    sourceDraft,
    model: settings.model.trim(),
  }),
});
```

前端只负责：

- 发送待识别的 `sourceDraft`。
- 展示 loading、成功、失败状态。
- 将 `result.hasArrangement === true` 的结果写入现有候选队列。

### 2. 调整 AI 设置页

设置页不再要求用户填写 API Key 和 API Base URL。

最小保留：

- 启用 AI 识别开关。
- Model 输入项，可选。
- 连接状态提示：
  - “本地代理未配置 API Key”
  - “AI 识别已启用”
  - “代理请求失败，请检查服务端环境变量”

### 3. 保留本地兜底规则

当 `/api/arrangement-recognition` 返回不可用、未配置或网络失败时，继续走已有本地候选识别规则。这样 Demo 在没有 API Key 的环境里仍可演示基础流程。

## 环境变量

本地开发使用 `.env.local`：

```sh
OPENAI_API_KEY=sk-...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
```

注意：

- `.env.local` 不提交到仓库。
- 前端代码不能读取 `OPENAI_API_KEY`。
- Vite 中只有 `VITE_` 前缀变量会暴露给浏览器；本方案故意不使用 `VITE_OPENAI_API_KEY`。

## 错误处理

后端统一返回：

```json
{
  "ok": false,
  "error": "AI 代理未配置 API Key"
}
```

前端展示简短中文提示，并允许用户继续使用本地规则生成候选。

建议错误分类：

- `405`：非 POST 请求。
- `400`：请求体缺失或 `sourceDraft` 不合法。
- `500`：服务端未配置 API Key。
- `502`：OpenAI API 调用失败或返回结构无法解析。

## 验收标准

- 浏览器 Network 中只出现同源请求 `/api/arrangement-recognition`。
- 浏览器请求头中不出现 `Authorization: Bearer ...`。
- 浏览器 localStorage 中不再保存 API Key。
- 配置 `OPENAI_API_KEY` 后，AI 识别可以返回安排候选。
- 未配置 `OPENAI_API_KEY` 时，界面不再出现 CORS 型 `Failed to fetch`，而是提示代理未配置，并可继续走本地规则。
- `C:\nvm4w\nodejs\pnpm.CMD lint` 通过。
- `C:\nvm4w\nodejs\pnpm.CMD build` 通过。
- `C:\nvm4w\nodejs\pnpm.CMD verify:answer` 通过。

## 推荐实施顺序

1. 新增 `server/arrangementRecognitionProxy.ts`。
2. 在 `vite.config.ts` 注册 `/api/arrangement-recognition` middleware。
3. 修改 `src/services/arrangementAi.ts`，改为请求同源 API。
4. 修改 AI 设置页，移除浏览器 API Key 配置，保留启用开关和模型配置。
5. 保留并串联本地兜底识别。
6. 跑 lint、build、verify:answer。

