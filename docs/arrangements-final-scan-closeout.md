# 安排模块收尾扫描报告

## 扫描时间

2026-05-18 CST (+0800)

## 扫描范围

- 安排模块页面：`src/pages/Arrangements.tsx`
- 安排模块数据层：`src/data/arrangements.ts`
- 安排识别服务：`src/services/arrangementAi.ts`
- 同源 AI 代理：`server/arrangementRecognitionProxy.ts`
- 识别诊断日志：`src/data/aiRecognitionDiagnostics.ts`
- 多语言入口与安排相关翻译：`src/settings/preferences.ts`
- 记录详情安排入口：`src/components/RecordDetailSheet.tsx`、`src/components/RecordFullDetailScreen.tsx`
- 首页/快记/测试聊天自动识别入口：`src/pages/Home.tsx`
- Codex 会话与日志前置检查文件：`.codex/candidate-session.json`、`docs/codex-logs/`

## 已确认通过项

- `lint` 通过，当前没有 ESLint 阻塞问题。
- `build` 通过，当前没有 TypeScript 编译阻塞问题。
- `verify:codex-log` 通过，当前候选人 Markdown 日志格式有效。
- 安排模块主流程具备完整闭环：手动创建、候选确认、忽略、完成、恢复、以后再说、归档、搜索、来源筛选、详情查看。
- AI 识别已改为同源 `/api/arrangement-recognition`，浏览器不再直接向第三方 `/responses` 发送带 Key 请求。
- 自动识别已覆盖快记、私聊、群聊测试数据，并通过候选队列进入用户确认流程。
- 跨聊天同一安排关联已有基础字段：`sourceRefs`、`eventFingerprint`、`matchedCandidateId`、`linkedCandidateIds`、`globalMergeConfidence`。
- 安排页与 AI 设置页已接入现有 `usePreferences()/t()` 多语言机制。

## 已修复问题

- `.codex/candidate-session.json` 原文件因候选人姓名字段编码和引号损坏，无法被标准 JSON 解析。已修复为合法 JSON，并继续指向当前候选人个人日志 `docs/codex-logs/candidate-王俊杰-local-20260516-155105-manual.md`。

## 发现的非阻塞风险

- `src/data/arrangements.ts` 和 `src/services/arrangementAi.ts` 中仍存在一批历史乱码展示文案，主要集中在本地候选备注生成、默认 Demo 安排、AI 错误提示、时间/来源兜底标签。它们不影响编译和核心状态流，但会影响用户看到的兜底文案质量。
- `src/data/aiConversationLog.ts` 与当前个人 Markdown 日志中存在大量历史乱码记录。当前验证脚本只校验结构，不校验历史内容语义；若要彻底恢复，需要单独做一轮日志内容迁移。
- 安排模块目前仍以 localStorage 为持久化边界，多标签页通过 storage event 和自定义 event 同步，适合 Demo，但不是多端实时同步实现。
- AI 自动识别的节流为前端 1200ms debounce，适合测试聊天和快记场景；真实生产环境还需要后端队列、幂等任务 ID 和失败重试策略。
- AI 代理接收前端传入的 Base URL/API Key/Model，满足当前本地设置页需求；如果后续变成正式服务，应改为服务端托管密钥或更严格的凭据策略。

## 结论

安排模块当前没有发现阻塞运行的编译级 BUG。作为 Demo，核心体验已经可以收尾：用户可以从手动输入、快记、私聊和群聊中生成候选安排，再确认进入正式安排列表，并查看多个来源上下文。

建议收尾后只做两类小修：一是清理安排数据层和 AI 服务里的历史乱码展示文案；二是补一个轻量单元测试或脚本用例，覆盖候选合并、跨来源 `sourceRefs` 去重、确认候选生成正式安排这三条核心状态转换。
