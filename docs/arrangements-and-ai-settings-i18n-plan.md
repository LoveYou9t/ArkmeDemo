# 安排页与 AI 设置页多语言适配方案

## 背景

当前项目已经有一套集中式多语言机制，入口在 `src/settings/preferences.ts`：

- `PreferencesProvider` 负责读取语言偏好、解析系统语言、写入 `document.documentElement.lang/dir`。
- `usePreferences()` 暴露 `t(key)` 给页面组件使用。
- 底部 Tab、设置页、快记页、我的页等已有页面已经通过 `t("...")` 读取文案。

新增加的「安排」页面和「AI 接入设置」页面仍存在大量页面内硬编码中文文案，因此切换语言后不会跟随变化。目标是先补齐完整适配计划，后续实现时尽量复用现有 `usePreferences/t` 机制，不引入新的 i18n 库。

## 影响范围

### 需要重点适配的文件

- `src/pages/Arrangements.tsx`
  - 安排页标题、副标题、搜索、筛选、候选区、列表空状态、卡片状态、详情 Sheet、编辑/确认 Sheet、时间选择器、操作按钮。
- `src/pages/Home.tsx`
  - `AiApiSettingsScreen`
  - `AiRecognitionSwitch`
  - `AiRecognitionDiagnosticsPanel`
  - `getAiDiagnosticStageLabel`
  - `formatAiDiagnosticTime`
- `src/components/RecordDetailSheet.tsx`
  - 「加入安排候选」「AI 识别安排」「先配置 AI」等安排识别入口文案。
- `src/components/RecordFullDetailScreen.tsx`
  - 全屏详情中的同类安排识别入口文案。
- `src/data/arrangements.ts`
  - `getSourceTypeLabel`
  - `getArrangementTimeFieldsFromDraft`
  - `formatTimeDraftLabel`
  - demo 数据中的系统生成标签和示例展示文案。
- `src/services/arrangementAi.ts`
  - 用户可见错误提示、诊断摘要，以及传给 AI 的中文上下文提示。
- `src/settings/preferences.ts`
  - 新增翻译 key；优先补 `zh-CN`、`zh-TW`、`en-US`，其他语言可先回退英文。

### 不建议适配的内容

- 用户自己输入的安排标题、备注、地点、相关人。
- 聊天消息原文、来源摘录、历史 AI 对话日志。
- API Key、Base URL、Model 等技术字段名本身。

这些内容属于用户数据或技术专名，不应该被语言切换自动翻译。

## 现有问题清单

### 安排页

`src/pages/Arrangements.tsx` 中存在以下硬编码文案类型：

- 页面级：`安排`、`未来的事，轻一点放在这`。
- 搜索级：`搜索安排`、`搜索安排、地点、相关人`、`取消`、`清除`。
- 筛选级：`全部`、`近期`、`以后再说`、`已完成`、`全部来源`、`来源：...`。
- 候选级：`可能是安排`、`条候选`、`AI 建议`、`理由`、`可信度`、`来源`、`确认`、`忽略`、`查看来源`。
- 今日聚焦：`今天值得留意`、`今天不用急`、`今天都处理好了`、`还没有安排` 等状态文案。
- 空状态：`没有匹配的安排`、`这里还没有安排`、`换个关键词或来源试试`、`新增安排`。
- 卡片/详情：`完成安排`、`恢复安排`、`状态`、`时间`、`地点`、`相关人`、`AI 能力`、`相关上下文`。
- 编辑器：`新增安排`、`编辑安排`、`确认候选安排`、`保存安排`、`保存修改`、`保存为安排`、`内容`、`写下接下来可能要做的事`。
- 时间选择器：`无时间`、`今天`、`明天`、`本周`、`具体日期`、`选择日期`、`选择星期`、`不限时段`、`上午`、`下午`、`晚上`、`具体时间`。
- 状态与能力：`进行中`、`已归档`、`AI 可协助`、`AI 可执行`、`需要自己完成`。

### AI 设置页

`src/pages/Home.tsx` 的 `AiApiSettingsScreen` 目前仍是页面内文案：

- 页面标题：`AI 接入设置`。
- 开关区：`启用 AI 识别`、`本地规则`、`已启用`、`待补全`、说明文案。
- 快速扫描：`快速扫描近期对话`、`扫描中`、`快速扫描`、扫描说明。
- 安全提示：`API Key 仅保存在当前浏览器本地...`。
- 保存区：`保存`、`重置`、保存成功/恢复默认提示。
- 诊断区：`识别诊断日志`、`清空`、`暂无日志...`。
- 诊断阶段：`配置检查`、`请求已发出`、`AI 成功`、`无安排`、`HTTP 错误`、`网络/CORS`、`解析失败`、`未配置`、`本地回退`。
- 诊断字段：`浏览器`、`代理目标`、`模型`、`状态`、`耗时`、`已回退本地规则`、`未生成请求地址`、`未命名来源`、`未填写`。

## Key 命名方案

延续现有 `tabs.*`、`settings.*`、`recordDetail.*` 风格，新增以下命名空间。

### `arrangements.*`

```ts
"arrangements.title": "安排"
"arrangements.subtitle": "未来的事，轻一点放在这"
"arrangements.searchLabel": "搜索安排"
"arrangements.searchPlaceholder": "搜索安排、地点、相关人"
"arrangements.searchActivePrefix": "搜索：{keyword}"
"arrangements.clear": "清除"
"arrangements.filter.all": "全部"
"arrangements.filter.near": "近期"
"arrangements.filter.later": "以后再说"
"arrangements.filter.done": "已完成"
"arrangements.source.all": "全部来源"
"arrangements.source.manual": "手动创建"
"arrangements.source.sendToSelf": "发给自己"
"arrangements.source.privateChat": "来自私聊"
"arrangements.source.groupChat": "来自群聊"
"arrangements.source.aiSuggestion": "AI 建议"
"arrangements.sourcePrefix": "来源：{source}"
"arrangements.empty.noMatches": "没有匹配的安排"
"arrangements.empty.noItems": "这里还没有安排"
"arrangements.empty.noMatchesDesc": "换个关键词或来源试试。"
"arrangements.empty.noItemsDesc": "把接下来可能要做的事先放进来，不确定时间也没关系。"
"arrangements.action.create": "新增安排"
"arrangements.action.complete": "完成"
"arrangements.action.moveLater": "以后再说"
"arrangements.action.restore": "重新放回安排"
"arrangements.action.edit": "编辑"
"arrangements.action.archive": "归档"
```

### `arrangements.candidate.*`

```ts
"arrangements.candidate.title": "可能是安排"
"arrangements.candidate.count": "{count} 条候选"
"arrangements.candidate.reason": "理由：{reason}"
"arrangements.candidate.confidence": "可信度 {percent}%"
"arrangements.candidate.source": "来源：{excerpt}"
"arrangements.candidate.confirm": "确认"
"arrangements.candidate.ignore": "忽略"
"arrangements.candidate.openSource": "查看来源"
```

### `arrangements.detail.*`

```ts
"arrangements.detail.title": "安排详情"
"arrangements.detail.close": "关闭安排详情"
"arrangements.detail.status": "状态"
"arrangements.detail.time": "时间"
"arrangements.detail.location": "地点"
"arrangements.detail.people": "相关人"
"arrangements.detail.source": "来源"
"arrangements.detail.aiCapability": "AI 能力"
"arrangements.detail.context": "相关上下文"
"arrangements.detail.noLocation": "暂未设置"
"arrangements.detail.noPeople": "暂无"
```

### `arrangements.editor.*`

```ts
"arrangements.editor.createTitle": "新增安排"
"arrangements.editor.editTitle": "编辑安排"
"arrangements.editor.confirmTitle": "确认候选安排"
"arrangements.editor.save": "保存安排"
"arrangements.editor.saveChanges": "保存修改"
"arrangements.editor.saveCandidate": "保存为安排"
"arrangements.editor.closeCreate": "关闭新增安排"
"arrangements.editor.closeEdit": "关闭编辑安排"
"arrangements.editor.closeConfirm": "关闭确认候选安排"
"arrangements.editor.content": "内容"
"arrangements.editor.contentPlaceholder": "写下接下来可能要做的事"
"arrangements.editor.time": "时间"
"arrangements.editor.timeHint": "不确定时间也可以先放进来。"
"arrangements.editor.location": "地点"
"arrangements.editor.locationPlaceholder": "医院、公司、线上..."
"arrangements.editor.people": "相关人"
"arrangements.editor.peoplePlaceholder": "用空格或顿号分隔"
"arrangements.editor.note": "备注"
"arrangements.editor.notePlaceholder": "补充背景或想法"
```

### `arrangements.time.*`

```ts
"arrangements.time.none": "无时间"
"arrangements.time.noTime": "还没有时间"
"arrangements.time.today": "今天"
"arrangements.time.tomorrow": "明天"
"arrangements.time.weekday": "本周"
"arrangements.time.date": "具体日期"
"arrangements.time.pickDate": "选择日期"
"arrangements.time.pickWeekday": "选择星期"
"arrangements.time.pickPart": "选择时段"
"arrangements.time.pickClock": "具体时间"
"arrangements.time.clockAria": "具体几点"
"arrangements.time.part.any": "不限时段"
"arrangements.time.part.morning": "上午"
"arrangements.time.part.afternoon": "下午"
"arrangements.time.part.evening": "晚上"
"arrangements.time.weekday.0": "周日"
"arrangements.time.weekday.1": "周一"
"arrangements.time.weekday.2": "周二"
"arrangements.time.weekday.3": "周三"
"arrangements.time.weekday.4": "周四"
"arrangements.time.weekday.5": "周五"
"arrangements.time.weekday.6": "周六"
```

### `arrangements.status.*` 与 `arrangements.aiCapability.*`

```ts
"arrangements.status.active": "进行中"
"arrangements.status.done": "已完成"
"arrangements.status.later": "以后再说"
"arrangements.status.archived": "已归档"
"arrangements.aiCapability.userOnly": "需要自己完成"
"arrangements.aiCapability.aiAssist": "AI 可协助"
"arrangements.aiCapability.aiExecutable": "AI 可执行"
```

### `aiSettings.*`

```ts
"aiSettings.title": "AI 接入设置"
"aiSettings.enableTitle": "启用 AI 识别"
"aiSettings.mode.localRules": "本地规则"
"aiSettings.mode.enabled": "已启用"
"aiSettings.mode.incomplete": "待补全"
"aiSettings.enableDesc": "开启后使用下方 API 配置识别安排；关闭时仅使用本地规则。"
"aiSettings.baseUrl": "Base URL"
"aiSettings.apiKey": "API Key"
"aiSettings.model": "Model"
"aiSettings.quickScanTitle": "快速扫描近期对话"
"aiSettings.quickScanDesc": "扫描最近一周可能的安排；未启用或配置不完整时走本地规则。"
"aiSettings.quickScan": "快速扫描"
"aiSettings.scanning": "扫描中"
"aiSettings.localKeyTip": "API Key 仅保存在当前浏览器本地。当前版本会请求同源代理，再由代理转发到配置的服务地址。"
"aiSettings.save": "保存"
"aiSettings.reset": "重置"
"aiSettings.saved": "AI 接入设置已保存"
"aiSettings.resetDone": "已恢复默认设置"
"aiSettings.switchAria": "启用 AI 识别"
```

### `aiSettings.diagnostics.*`

```ts
"aiSettings.diagnostics.title": "识别诊断日志"
"aiSettings.diagnostics.desc": "记录最近的 AI 请求、错误和本地回退；不会保存完整 API Key。"
"aiSettings.diagnostics.clear": "清空"
"aiSettings.diagnostics.empty": "暂无日志。保存配置后点击“快速扫描”，这里会显示实际连接结果。"
"aiSettings.diagnostics.unnamedSource": "未命名来源"
"aiSettings.diagnostics.browser": "浏览器：{endpoint}"
"aiSettings.diagnostics.noEndpoint": "未生成请求地址"
"aiSettings.diagnostics.target": "代理目标：{endpoint}"
"aiSettings.diagnostics.model": "模型：{model}"
"aiSettings.diagnostics.key": "Key：{key}"
"aiSettings.diagnostics.keyMissing": "未填写"
"aiSettings.diagnostics.status": "状态：{status}"
"aiSettings.diagnostics.duration": "耗时：{duration}ms"
"aiSettings.diagnostics.fallbackUsed": "已回退本地规则"
"aiSettings.diagnostics.stage.configured": "配置检查"
"aiSettings.diagnostics.stage.request": "请求已发出"
"aiSettings.diagnostics.stage.success": "AI 成功"
"aiSettings.diagnostics.stage.empty": "无安排"
"aiSettings.diagnostics.stage.httpError": "HTTP 错误"
"aiSettings.diagnostics.stage.networkError": "网络/CORS"
"aiSettings.diagnostics.stage.parseError": "解析失败"
"aiSettings.diagnostics.stage.unconfigured": "未配置"
"aiSettings.diagnostics.stage.fallback": "本地回退"
"aiSettings.diagnostics.stage.default": "诊断"
```

### `recordDetail.arrangement.*`

```ts
"recordDetail.arrangement.addCandidate": "加入安排候选"
"recordDetail.arrangement.aiRecognize": "AI 识别安排"
"recordDetail.arrangement.recognizing": "识别中"
"recordDetail.arrangement.configureFirst": "先配置 AI"
"recordDetail.arrangement.recognizeAgain": "重新识别安排"
```

## 实施步骤

1. 在 `src/settings/preferences.ts` 补齐 key。
   - 先完整补 `zh-CN` 与 `en-US`。
   - `zh-TW` 可先沿用繁体语义，不确定的专业词保留英文。
   - 其他语言如果当前字典不完整，允许走现有 fallback 到 `en-US`。

2. 为 `t` 增加一个轻量插值助手。
   - 当前 `t(key)` 只返回字符串，项目已有局部 `formatTemplate()`。
   - 建议新增通用 `formatTranslation(template, values)` 或 `tr(key, values)`，避免每个页面重复 `replace(/\{...\}/g)`。
   - 如果想保持改动更小，也可在 `Arrangements.tsx` 和 `Home.tsx` 局部复用现有 `formatTemplate()` 思路。

3. 改造 `Arrangements.tsx`。
   - 在组件顶层调用 `const { t, resolvedLocale } = usePreferences()`。
   - 将 `filters`、`sourceFilters`、`timeQuickOptions`、`weekdayOptions`、`timePartOptions` 从静态 label 数组改为 key 数组，在渲染时 `t(key)`。
   - 子组件需要文案时优先传 `t` 或传已经格式化好的 label，避免子组件各自重新拼硬编码。
   - `formatArrangementTime()` 保留用户存储的 `fuzzyTimeLabel` 兼容旧数据，但对 `timeKind === "none"` 使用 `t("arrangements.time.noTime")`。
   - `getStatusLabel()`、`getAiCapabilityLabel()`、`getGroupTitle()`、`getSourceFilterLabel()` 改为接收 `t`。

4. 改造 `src/data/arrangements.ts` 的显示标签边界。
   - 不建议在数据层直接调用 React hook。
   - 将 `getSourceTypeLabel(type)` 改为以下两种方案之一：
     - 保留函数但只用于中文 fallback，并新增页面层 `getSourceTypeTranslationKey(type)`。
     - 直接导出 `getSourceTypeTranslationKey(type)`，页面负责 `t(key)`。
   - `getArrangementTimeFieldsFromDraft()` 目前会把中文 `fuzzyTimeLabel` 写入本地存储；短期可保留兼容，长期建议只存结构化 `timeDraft/startAt`，显示时再按 locale 格式化。

5. 改造 `Home.tsx` 中的 AI 设置页。
   - `AiApiSettingsScreen` 内调用 `const { t, resolvedLocale } = usePreferences()`。
   - `enabledLabel`、保存提示、重置提示、快速扫描按钮和安全提示全部改为 `t`。
   - `AiRecognitionSwitch` 增加 `ariaLabel` prop 或内部调用 `usePreferences()`。
   - `AiRecognitionDiagnosticsPanel` 使用 `t` 和 `resolvedLocale`，时间格式从固定 `zh-CN` 改成 `resolvedLocale`。
   - `getAiDiagnosticStageLabel(stage)` 改为 `getAiDiagnosticStageLabel(stage, t)`。

6. 改造快记详情中的安排识别入口。
   - `RecordDetailSheet.tsx` 和 `RecordFullDetailScreen.tsx` 已经有 `usePreferences()`，直接补 `recordDetail.arrangement.*` key。
   - `getArrangementAiActionLabel(state)` 改为接收 `t`。

7. 处理 AI 服务错误提示。
   - `src/services/arrangementAi.ts` 中抛出的错误是用户可见信息，应避免长期硬编码中文。
   - 最小改法：服务层抛 `code`，页面层根据 `code` 翻译。
   - 若要少改架构：先在服务层保留中文错误，同时新增英文 fallback 会比较别扭，不推荐。

8. 手动检查 RTL。
   - 现有 `PreferencesProvider` 已支持 `dir="rtl"`。
   - 安排页大量 `left/right`、`text-left/text-right` 类名短期可接受，但如果阿拉伯语要可用，需要把关键布局替换为 `start/end` 思路或条件 class。
   - 本轮建议只保证不会崩、不会明显遮挡；完整 RTL 另开任务。

## 验证清单

1. 切换到 `English` 后：
   - 底部 `Plans` 已存在。
   - 安排页标题、筛选、搜索、空状态、候选区、详情 Sheet、编辑 Sheet、时间选择器均为英文。
   - AI 设置页标题、开关、快速扫描、诊断日志、保存/重置均为英文。
   - 用户输入的安排内容、来源摘录不被翻译。

2. 切换回 `简体中文` 后：
   - 原有中文语义恢复。
   - 已存在的本地安排数据可以继续显示，不因旧 `fuzzyTimeLabel` 中的中文而报错。

3. 切换到 `繁體中文` 后：
   - 关键页面不回退到硬编码简体。
   - 如果个别 key 未补齐，fallback 行为可被识别并补充。

4. 切换到 `Arabic` 后：
   - 页面 `dir="rtl"` 生效。
   - 安排页和设置页不出现严重重叠、按钮文字不溢出。

5. 运行验证：
   - `C:\nvm4w\nodejs\pnpm.CMD lint`
   - `C:\nvm4w\nodejs\pnpm.CMD build`
   - `C:\nvm4w\nodejs\pnpm.CMD verify:codex-log`
   - `C:\nvm4w\nodejs\pnpm.CMD verify:answer`

## 建议实施顺序

第一轮只做显示层多语言：

1. `preferences.ts` 补 key。
2. `Arrangements.tsx` 和 `Home.tsx` 页面文案改为 `t`。
3. `RecordDetailSheet.tsx`、`RecordFullDetailScreen.tsx` 补入口按钮文案。
4. 不改本地存储结构，不迁移旧数据。

第二轮再做数据层和 AI 错误语义整理：

1. 把 `getSourceTypeLabel()` 改为 translation key。
2. 把 AI 服务错误从直接中文字符串改为错误码 + 页面翻译。
3. 评估 `fuzzyTimeLabel` 是否继续持久化中文，或改为纯结构化显示。

这样风险最低，也最符合当前 Demo 迭代节奏。
