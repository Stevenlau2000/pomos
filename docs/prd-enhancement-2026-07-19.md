# POMOS 增强需求 PRD（简单版）

> 文档版本：v1.0 · 日期：2026-07-19
> 作者：产品经理 许清楚（Xu）
> 关联代码：前端 `/Users/mac/WorkBuddy/POMOS/pomos-app/frontend`，文档 `/Users/mac/WorkBuddy/POMOS/pomos-app/docs`
> 技术路线（已与用户确认，本文遵循）：纯前端为主、GitHub Pages 可部署；联网调云端 LLM、断网降级本地启发式；知识库轻量切分+关键词检索（非向量 RAG）；持久化统一迁移至 IndexedDB 并按 student_id 隔离；内置 7 部教材结构化知识源。

---

## 1. 产品目标

本次增强旨在把 POMOS 从「单学生共享视图的演示系统」升级为「多学生隔离、可承载个人知识库、并能生成结构化讲义与跨学科深度题目的物理竞赛辅导操作系统」：在保持纯前端可部署的前提下，通过学生数据隔离与 IndexedDB 持久化打牢基础架构，通过独立对话历史与四模块讲义提升辅导深度，通过学科与知识点双维度的题目深化及内置教材库提升训练专业性，通过前端文档导入的个人知识库让教练「有据可依」。整体目标是让每位竞赛学生（如 Jason）都拥有一套专属、持久、专业、可离线运行的 AI 教练工作台。

---

## 2. 用户故事

1. **新学生首次进入**：导师创建学生「李华」，系统自动分配空白的数字孪生基线、空认知 bug、空对话历史、空个人知识库，且首页不再出现任何「省一 / 省队 / IPhO」备赛表述，避免误导。
2. **学生导入教材让其讲某知识点**：王同学将《力学》PDF 导入自己的个人知识库，对教练说「用我导入的资料讲讲刚体转动」，教练的回答明确引用了 PDF 中的定义与例题。
3. **断网时学生仍可刷题**：Jason 在无网络、未配置 API key 的情况下，仍能按学科（力/热/电/光/近代/高数等）或具体知识点生成带梯度解析的竞赛题，全部数据存本地不丢失。
4. **竞赛导师生成结构化讲义**：在竞赛导师模式下输入「生成讲义：电磁感应」，得到一份含【概念辨析 / 数理推导 / 图像分析 / 逻辑贯通】四个标准模块的 Markdown 讲义。
5. **切换学生互不干扰**：导师在 Jason 与 Emma 之间来回切换，两人的对话历史、数字孪生、认知 bug、个人知识库完全隔离，绝不串台。

---

## 3. 需求池（按 P0 / P1 / P2）

> 优先级定义：**P0 必须（基础架构/阻塞项）** · **P1 应该（核心体验）** · **P2 可选（增值）**
> 现有存储命名空间参考：`offlineApi.ts` 的 `KEYS`（按 student_id 隔离：`history(id)` / `twin(id)` / `mistakes(id)` 等）；当前全部落在 `localStorage`。

### P0 — 基础架构（必做，先落地）

| 编号 | 描述 | 涉及模块 / 页面 | 验收标准 | 优先级 |
|------|------|----------------|----------|--------|
| REQ-ISO-01 | **学生数据隔离**：新建学生时，自动初始化其专属存储（数字孪生基线、能力总览、认知 bug、对话历史、个人知识库）为空/基线，不读任何其它学生数据；切换学生严格按 `student_id` 加载对应数据，互不串台。 | `lib/offlineApi.ts`（KEYS 命名空间）、`components/layout/StudentSwitcher.tsx`、`app/page.tsx` 切换逻辑 | 新建 A、B 两生；A 做题/对话后切到 B，B 的雷达/bug/对话均为空基线；删除 A 后其数据彻底清除且不影响 B。 | P0 |
| REQ-UI-01 | **删除「备赛情况」栏**：从 Overview 页移除「备赛就绪度」卡片（省一/省队/IPhO 三档概率）及 `ReadinessGauge` 引用与相关数据字段。 | `components/views/OverviewView.tsx`（~L166–190）、`components/dashboard/ReadinessGauge.tsx`、`lib/pomosData.ts`（`SAMPLE_READINESS`）、`lib/api.ts`（`Readiness` 类型） | Overview 页面不再出现「省一 / 省队 / IPhO」任何字样与图表；其余卡片布局正常上移填补。 | P0 |
| REQ-PERS-01 | **IndexedDB 持久化**：将当前 localStorage 的学生数据（数字孪生、能力总览、认知 bug、对话历史、设置、个人知识库文档）迁移到 **IndexedDB**，按 `student_id` 隔离；提供 localStorage→IndexedDB 一次性迁移；`api.ts` 对外接口签名不变。 | `lib/offlineApi.ts`（替换 `lsGet/lsSet` 为 idb 封装）、`app/page.tsx`（异步加载改 `await`）、`lib/i18n.tsx`（语言偏好可保留 localStorage） | 刷新/重开浏览器后数据不丢；大文档（如教材文本）可存储不触发 localStorage 5MB 限制；多学生数据隔离无冲突。 | P0 |
| REQ-CHAT-01 | **独立对话历史（巩固）**：为每位学生维护独立对话历史。现状已按 `id` 隔离（`pomos_offline_history_${id}`，上限 200），需正式化：切换学生加载对应历史、新消息正确归属、上限可调（建议 500）。 | `lib/offlineApi.ts`（`getHistory/setHistory`）、`components/views/ChatView.tsx`、`app/page.tsx` | 切到某生后 ChatView 显示该生历史；发送消息只写入该生存储；切换不串台。 | P0 |
| REQ-KB-02 | **内置教材库（结构化预置）**：将需求列出的 7 部教材（舒幼生《力学》、秦允豪《热学》、叶邦角《电磁学101》、赵凯华《新概念物理教程》、钟锡华《光学》、杨福家《原子物理学》、梁昆淼《理论力学》）核心知识点/例题结构化预置为前端可检索知识源，供题目与讲义参考。 | 新增 `lib/textbooks.ts`（7 教材结构化数据）、`physicsKB.ts`（学科枚举扩展） | 前端可按学科/知识点检索到教材条目并用于题目/讲义生成；开箱即有内容，无需用户导入。 | P0 |

### P1 — 核心体验（应该做）

| 编号 | 描述 | 涉及模块 / 页面 | 验收标准 | 优先级 |
|------|------|----------------|----------|--------|
| REQ-CHAT-02 | **讲义四模块**：支持生成知识点学习讲义，讲义**必须**含【概念辨析 / 数理推导 / 图像分析 / 逻辑贯通】四个模块；可引用专业教材与习题集提升深度。 | `ChatView` 竞赛模式生成意图识别、`lib/offlineGen.ts`（新增 `generateLecture(topic, context)`） | 输入「生成讲义：xxx」返回 Markdown，含四个二级标题且内容非空；联网走云端 LLM、断网降级本地启发式。 | P1 |
| REQ-CHAT-03 | **对话深度专业化**：对话内容参考专业教材与习题集，提升深度、广度与专业性。 | `lib/offlineGen.ts`、`lib/textbooks.ts`、`lib/physicsKB.ts` | 同一问题，接入教材库后回答出现教材风格的概念辨析与例题引用；离线下引用 `physicsKB`/教材核心知识点。 | P1 |
| REQ-PROB-01 | **题目学科扩展**：按学科方向生成，除力/热/电/光/近代外，扩展至**高等数学、矢量分析、线性代数、理论力学、电动力学**等。 | `physicsKB.ts`（`KG_BOARDS` 扩展学科枚举）、`lib/offlineGen.ts`/m09 题源库、内置教材库对应章节 | 选题器可勾选新学科并生成对应题目；题目术语/符号符合该学科规范（如电动力学用张量/矢量微积分记法）。 | P1 |
| REQ-PROB-02 | **按知识点生成 + 梯度**：支持按**具体知识点**（而非仅学科）生成题目；难度梯度清晰且多元（建议 1–5 ★ 档位，单知识点给 ≥3 道梯度题）。 | `physicsKB.ts` 知识点节点、`lib/offlineGen.ts` 选题维度 | 选「刚体转动·平行轴定理」能定向出题；同一知识点返回梯度题并附阶梯提示。 | P1 |
| REQ-PROB-03 | **教材题源深化**：参考列出的 7 部教材及对应习题，全面深化题目难度与专业性，解析引用教材。 | `lib/textbooks.ts`、`lib/offlineGen.ts` | 生成的题目/解析标注参考教材出处（如「参考：舒幼生《力学》第 X 章」），难度显著高于现有 demo 题。 | P1 |
| REQ-KB-01 | **前端文档导入**：开发前端文档导入功能，访问本地文件并导入至**指定学生**的个人知识库（建议支持 PDF/TXT/MD）。 | 新增导入 UI（设置或学生面板入口）、File API 读取、文本抽取（PDF 用 pdf.js 或纯文本兜底） | 选择文件→解析→存入该生 IndexedDB 知识库；可查看已导入列表并删除。 | P1 |
| REQ-KB-03 | **知识库解析与引用**：对导入文档做轻量切分（按段落/章节）+ 关键词检索（纯前端零依赖），并在对话/讲义/题目中作为参考依据注入相关片段。 | `lib/offlineApi.ts` 或新增 `lib/knowledgeBase.ts` | 导入「导数」讲义后，提问「导数」能召回该文档片段并在回答中引用；检索为关键词匹配、无外部依赖。 | P1 |
| REQ-LLM-01 | **云端 LLM 接入 + 降级**：联网时调用云端 LLM（如腾讯混元 Hunyuan）做深度生成（讲义/题目/参考教材）；断网或 API 不可达时降级本地启发式；前端预留 LLM API 接入点，API key 由用户配置存浏览器。 | `lib/api.ts`（新增 `MODE=llm` 路由）、`components/settings/SettingsPanel.tsx`（key/endpoint 配置）、`offlineApi.ts`（fallback） | 配置 key 后生成内容显著更深；拔网/错误 key 时自动回退本地且不抛错、不卡死。 | P1 |

### P2 — 可选增值（nice to have）

| 编号 | 描述 | 涉及模块 / 页面 | 验收标准 | 优先级 |
|------|------|----------------|----------|--------|
| REQ-CHAT-04 | **对话/讲义导出**：支持将某生对话历史、生成的讲义导出为 Markdown/JSON 备份。 | `ChatView`、`offlineApi.ts` | 点击导出得到文件；可再导入恢复。 | P2 |
| REQ-KB-04 | **知识库云同步/导出**：个人知识库支持导出与（可选的）跨设备同步。 | `lib/knowledgeBase.ts` | 导出成功；同步为可选扩展。 | P2 |
| REQ-UI-02 | **讲义四模块可交互**：四模块支持折叠/分卡片切换、一键复制。 | `ChatView`/讲义渲染组件 | 模块可独立折叠；复制按钮可用。 | P2 |

---

## 4. 关键 UI 调整设计

### 4.1 删除「备赛情况」栏后布局变化
- **OverviewView**：移除「备赛就绪度」卡片（原 ~L166–190，含 `ReadinessGauge` 与省一/省队/IPhO 三行说明）。其下方卡片（能力总览图、认知 bug、错题本、训练计划）按 Grid 顺序自动上移填补空位，整体两/三栏网格不变。
- **ReadinessGauge.tsx**：从 Overview 解除引用；组件可整体删除，或保留为未引用文件（建议删除以减少歧义）。
- **顶栏/侧栏/StudentSwitcher**：无变化。

### 4.2 学生「个人知识库」入口与导入交互
- **入口**：在 `StudentSwitcher`（顶栏学生切换处）旁新增「📚 知识库」按钮；或在学生详情/设置面板内新增「个人知识库」Tab。点击打开右侧抽屉/弹窗。
- **导入交互**：抽屉内列出当前学生的已导入文档（文件名、大小、导入时间、删除按钮）；提供「导入文件」按钮，`<input type="file" accept=".pdf,.txt,.md">`；选择后前端解析（PDF 走 pdf.js / 文本直读）→ 切分 → 存入该生 IndexedDB 知识库 → 列表刷新并提示成功。
- **隔离**：知识库严格按 `student_id` 归属，切换学生即切换知识库视图。

### 4.3 「独立对话历史」的切换方式
- 在 `StudentSwitcher` 切换 `student_id` 时，`app/page.tsx` 调用 `offlineApi.getChatHistory(id)` 异步加载该生历史，注入 `ChatView` 的 `messages`；发送消息经 `offlineApi.sendChat` 写入 `KEYS.history(id)`。
- 新学生首次进入对话为空；切换学生后 ChatView 立即反映该生历史，不残留上一学生消息。
- 受 REQ-PERS-01 影响，历史读取改为 await IndexedDB。

### 4.4 「讲义四模块」展示形态
- 生成讲义以 Markdown 渲染（复用现有 markdown + KaTeX 管线），四个模块用二级标题固定呈现：
  `## 概念辨析` · `## 数理推导` · `## 图像分析` · `## 逻辑贯通`。
- 在竞赛导师模式下，输入「生成讲义：<知识点>」或「讲讲 <知识点> 并生成讲义」触发 `offlineGen.generateLecture`。
- （P2）可进一步将四模块渲染为可折叠卡片，便于逐模块学习。

---

## 5. 待确认问题（PRD 阶段无法确定的决策点）

| # | 问题 | 建议选项（供决策） |
|---|------|--------------------|
| Q1 | **云端 LLM 具体用哪家 / API key 管理** | 默认接入腾讯混元 Hunyuan（用户已提及）；前端预留可配置 endpoint，支持 OpenAI/DeepSeek 兼容接口更优。key 存浏览器 IndexedDB 加密字段，绝不落服务器。需确认：是否本期必须支持多供应商？ |
| Q2 | **教材库是预置结构化数据还是需用户导入** | 建议双轨：7 部教材核心知识点**结构化预置**（P0，开箱即用）+ 支持用户导入补充（P1）。需确认预置深度——仅目录/知识点，还是含例题全文？建议至少含「知识点 + 典型例题题干 + 出处」。 |
| Q3 | **IndexedDB 与现有 localStorage 数据迁移策略** | 建议首次启动检测 localStorage 旧数据，自动迁移到 IndexedDB 后清理；迁移失败兜底保留 localStorage 副本并提示。需确认：是否保留向下兼容回退？ |
| Q4 | **独立对话历史是否需导出** | 建议提供导出/导入 JSON（P2）便于备份。需确认是否本期必须，还是后续迭代。 |
| Q5 | **PDF 解析是否必须零依赖** | 纯前端解析 PDF 需 pdf.js（增加包体）；或本期限制导入为 `.txt/.md`（零依赖），PDF 列为 P2 可选依赖。需确认导入格式范围与包体预算。 |
| Q6 | **新增学科是否纳入九维 twin 评估** | 新增学科（高数/线代/电动力学等）建议**先作为题目/讲义来源**，暂不强行并入现有九维能力画像；需确认是否要扩展 `NINE_DIMS` 或新建学科能力维度。 |

---

## 附：与现有代码的对应速查（供架构师）

- 备赛情况：`components/dashboard/ReadinessGauge.tsx`、`OverviewView.tsx` L166–190、`lib/pomosData.ts` `SAMPLE_READINESS`、`lib/api.ts` `Readiness`
- 对话历史隔离：`lib/offlineApi.ts` `KEYS.history(id)` / `getHistory` / `setHistory`（上限 200→建议 500）
- 持久化：`lib/offlineApi.ts` `lsGet/lsSet`（localStorage）→ 拟替换为 IndexedDB 封装；`app/page.tsx` L36–274 学生加载/切换
- 学科枚举：`lib/physicsKB.ts` `KG_BOARDS`（现：力学/电磁学/热学/光学/近代物理）
- 生成引擎：`lib/offlineGen.ts`（题目/训练/讲义生成，现仅离线启发式）
- 学生切换 UI：`components/layout/StudentSwitcher.tsx`
- 设置面板：`components/settings/SettingsPanel.tsx`（API key/endpoint 配置入口）
