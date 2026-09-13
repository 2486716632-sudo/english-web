# Phase 2 审核记录

**日期:** 2026-07-29
**审核方式:** 外部独立审核（审核包 v1）

> **最终状态：✅ Approved** — 2026-07-29 通过最终外部审核（Blocking Issues: None）。
> 详细结论见文末《最终外部审核结果（Phase 2 关闭）》。

---

## 审核对象

- `docs/refactor/tasks/phase-2-task.md` — 任务定义
- `docs/refactor/EVALUATION_BASELINE.md` — 评估基线
- `docs/refactor/TEST_STRATEGY.md` — 测试策略
- `docs/refactor/handoffs/phase-2-handoff.md` — 交接文档
- `docs/refactor/PHASE_STATUS.md` — 阶段状态
- 全部 5 个测试文件、Fixture、冒烟脚本、配置
- `tmp/phase-2-review-pack/` — 审核包

---

## 最终结论

**Review Status: Changes Requested**

**Phase 3 Release Decision: Not Approved**

整体方向正确：建立了 Vitest 测试框架、SM-2 表征测试、AI 离线评估 Fixture 和测试策略文档，为后续 Phase 提供了必要的质量基线。

但当前评估基线存在以下三类问题，需要在 Phase 2 修正后方可进入 Phase 3：

---

## 阻断问题

### B-01: API 冒烟脚本尚未形成可信的可执行基线

**问题:**
1. POST 检查实际发送的是 GET 请求（`check` 函数始终使用 `curl -s` 无 `-X POST`）
2. `check_json` 对同一个 URL 发送两次请求（一次获取 body，一次获取 status），多余且低效
3. `expected_key` 为空时仍尝试查找空 key
4. 缺少对 POST 类请求的正确 body 和 Content-Type 支持
5. `/api/assistant` 的处理方式未明确说明（直接 POST 会调用真实 DeepSeek，不应执行）

**要求:**
1. 为 `check` 和 `check_json` 添加 `-X` / `--request` 和 body 参数支持
2. 每个 URL 只请求一次
3. `expected_key` 为空时不执行 key 检查
4. 没有 `jq` 时明确输出"未执行结构校验"
5. `/api/assistant` 如果无法在不调用真实模型的情况下测试，必须在文档中明确记录原因和推迟到 Phase 3

---

### B-02: 测试数量、Fixture 数量和 Build 结果在文档中不一致

**问题:**
1. 多处写"80 tests / 81 assertions"而非基于测试框架准确输出
2. Fixture 数量在文档中写"32 个"但未明确区分静态 fixture 和动态生成函数
3. Phase 0 的冒烟结果被引用为 Phase 2 的结果

**要求:**
1. 测试数量以 `npx vitest run` 的真实输出为唯一口径，不再手工估算
   （原审核给出的 "5 个测试文件、81 个测试" 只是当时的估算，已被真实运行结果取代）
2. Fixture 统计以 `tests/eval/fixtures/ai-responses.ts` 的实际导出为准
   （原审核给出的 "22 个静态 fixture" 同样是估算，已被真实文件计数取代）
3. 区分 Build、HTTP 冒烟、人工交互三种不同验证方式，不混淆

---

### B-03: AI 输出嵌套结构校验不完整，且文档夸大了测试与生产代码的关联

**问题:**
1. `enrichWord` 校验器只检查 `collocations` 是否为数组，未检查每项是否为非空字符串；只检查 `exampleSentences` 是否为数组，未深入校验每项结构
2. `themeWordList` 缺乏独立的可复用校验函数
3. `generateScene` 的字段必填/可选判断未基于实际 Prompt 契约
4. 文档中"5 种 AI 响应类型对应具体调用点"的表述夸大了关联——当前测试只是离线校验，未接入 Production Route 的实际解析代码

**要求:**
1. 加强对 `enrichWord` 嵌套字段的类型和内容校验
2. 为 `themeWordList` 建立独立、可复用的校验函数
3. 基于实际 Prompt 输出契约确认 `generateScene` 各字段的实际必填性
4. 明确说明当前 AI Evaluation 是离线契约和评估基线，尚未接入生产代码

---

## 已完成修正

### 修正 F-01: API 冒烟脚本增强

- `check` 和 `check_json` 支持 HTTP method (-X)、body (-d)、Content-Type (-H)
- POST 检查发送真实 POST
- `check_json` 通过 temp 文件实现单次请求获取 status + body
- 无 jq 时明确标注"未执行结构校验"
- `/api/assistant` 记录为推迟到 Phase 3

### 修正 F-02: 文档统计统一

- 测试数量不再手工估算，统一以 `npx vitest run` 的真实输出为准（本轮为 92 tests；最终修正后为 95 tests）
- Fixture 统一以 `tests/eval/fixtures/ai-responses.ts` 的实际导出为准（本轮为 32 静态 + 1 动态；最终修正后为 33 静态 + 1 动态）
- 区分 Build、HTTP 冒烟、人工交互三种验证层级

### 修正 F-03: 嵌套校验增强

- `enrichWord` 校验器增加 nested 字段逐项检查（collocations 每项、exampleSentences 每项的 sentence/translation）
- `themeWordList` 建立独立校验函数
- `generateScene` 按实际 Prompt 契约分三种类型（对话/C1/C2）分别校验
- 文档明确 AI Evaluation 当前为离线基线

---

## v3 复审记录

**日期:** 2026-07-29
**审核方式:** 外部独立审核（审核包 v3）

> **包内版本说明：** `phase-2-review-pack-v3.zip` 生成于修正落盘**之前**，
> 因此包内的 `tests/smoke/api-smoke.sh` 仍是"一次取 body、再一次取 status"的两次请求版本，
> `tests/eval/structured-output.test.ts` 也只校验 speaker 为非空字符串。
> 这正是本次复审判定"check_json 仍发送两次请求、generateScene 校验过于宽松"的原因。
> 工作区随后已修正，见下方《最终修正记录》。

### 复审结论

| 项目 | 状态 |
|------|------|
| 哈希验证 | ✅ 6 个关键文件与 v3 包副本一致（针对 v3 包内容） |
| POST 真实发送 | ✅ `check` / `check_json` 均使用 `-X POST` |
| check_json 单次请求 | ❌ v3 包内仍为两次请求 → 已在工作区修正 |
| 场景类型特定校验 | ✅ 对话/C1/C2 使用独立 validate 函数 |
| generateScene 角色校验 | ⚠️ v3 包内只校验 speaker 为非空字符串，未校验角色归属 → 已在工作区修正 |
| 文档统计 | ⚠️ v3 包内统计已过期（92 tests / 32+1 fixtures）→ 最终值见《最终修正记录》 |

### v3 包内运行结果（历史记录）

- `npx vitest run` → ✅ 92 passed (5 files)
- `npx tsc --noEmit` → ✅ 0 errors
- `npx next build` → ✅ 31 routes
- `npx eslint tests/` → ✅ 0 errors
- `npx eslint src/lib/__tests__/` → ✅ 0 errors
- Dev server + `bash tests/smoke/api-smoke.sh` → ✅ 14/14 passed

### 剩余说明

1. `POST /api/words` missing wordId → 500 已标记为"输入校验技术债"，Phase 2 不修改 Route 逻辑
2. 人工浏览器交互仍引用 Phase 0 基线，本阶段未重新手动验证
3. Phase 3 需为 `/api/assistant` 建立可测试接缝

---

## 最终修正记录（v3 复审后续修正）

**日期:** 2026-07-29
**范围:** 仅测试与文档（未修改业务代码、未调用真实 AI/TTS、未进入 Phase 3）

### 修正项

| # | 问题 | 修正 | 验证方式 |
|---|------|------|---------|
| 1 | `check_json` 每次检查发送 2 个 HTTP 请求 | 改为单请求：`curl -o <tmpfile> -w "%{http_code}"` 一次同时取得 body 与 status | dev server 日志计数：`/api/warmup` 3 次检查 = 3 次请求；`POST /api/words` 4 次检查 = 4 次请求 |
| 2 | 无 jq 时把"未做结构校验"记为 PASS | 无 jq 时明确输出 `SKIP` 并计入 skipped，不计入 PASS，摘要中显式声明结构未校验 | 无 jq 运行输出：12 passed / 0 failed / 2 skipped |
| 3 | `check_json` 不支持 Content-Type 参数 | 新增可选第 7 参数（缺省 `application/json`），保留 GET/POST + body + 期望状态支持 | `tests/smoke/api-smoke.sh` |
| 4 | 对话场景未校验 speaker 归属 | `line.speaker` 必须属于 `speakerA` / `speakerB`（接受 token `"A"`/`"B"` 或已声明的显示名） | 新增 `dialogueWrongLineSpeakerResponse` fixture，对话测试 5 → 7 |
| 5 | C2 访谈未按 host/guest 校验 speaker 归属 | `line.speaker` 必须属于 `host` / `guest` | `c2WrongLineSpeakerResponse` 复用，C2 测试 4 → 5 |
| 6 | 文档统计过期 | 全部改为真实运行结果（见下表），移除旧版本统计 | `npx vitest run` + fixture 文件计数 |

### 最终验证结果（真实命令输出）

| 命令 | 结果 |
|------|------|
| `npx vitest run` | ✅ 95 passed（5 files） |
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx next build` | ✅ 通过 — 41 routes，33/33 静态页面，2 warnings（`public/listening/` 文件模式过宽） |
| `npx eslint tests/` | ✅ 0 errors, 0 warnings |
| `npx eslint src/lib/__tests__/` | ✅ 0 errors, 0 warnings |
| dev server + `bash tests/smoke/api-smoke.sh`（jq 可用） | ✅ 14 passed / 0 failed / 0 skipped |
| dev server + `bash tests/smoke/api-smoke.sh`（无 jq） | ✅ 12 passed / 0 failed / 2 skipped |

### 已知遗留 API 行为（仅记录，未修改）

| 请求 | 当前实测行为 | 定性 |
|------|-------------|------|
| `POST /api/words` 不存在的 wordId | **404** | 期望行为 |
| `POST /api/words` 缺少 wordId | **500** | ⚠️ 遗留行为 / 输入校验技术债 — Phase 2 只作为 characterization baseline 记录，不修改生产 Route，也不视为正确 API 设计 |

---

## 最终外部审核结果（Phase 2 关闭）

**日期:** 2026-07-29
**审核方式:** 外部独立最终审核

| 项目 | 结果 |
|------|------|
| Review Status | ✅ **Approved** |
| Blocking Issues | ✅ **None** |
| Phase 3 Release Decision | ✅ **Approved** — Phase 2 正式关闭后可启动 Phase 3 |
| 是否需要进一步的 Phase 2 技术改动 | 不需要 |

### 最终证据（Final evidence）

| 证据项 | 结果 |
|--------|------|
| Vitest | ✅ 95 passed |
| TypeScript | ✅ passed |
| Build | ✅ passed |
| ESLint（Phase 2 测试范围：`tests/`、`src/lib/__tests__/`） | ✅ passed |
| Smoke test | ✅ 14 passed / 0 failed / 0 skipped（jq 可用） |
| 业务逻辑修改 | ✅ 无 |
| 真实 AI / TTS 调用 | ✅ 无 |

### 关闭结论

Phase 2（建立评估基线）通过最终外部审核，正式关闭。
本阶段建立的测试与评估基线现在是后续重构的**受保护基线（protected baseline）**；
Phase 3 必须用它检测回归。

---

## 当前状态

**Phase 2: ✅ Completed / Approved**
**Phase 3: Ready / Not Started**
