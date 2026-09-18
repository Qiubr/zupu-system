# 族谱管理系统 · 数据模型定稿 v1.0

> 定稿 2026-09-17 ｜ 存储 IndexedDB ｜ 五实体：`Person` / `Marriage` / `Branch` / `Photo` / `Meta`
> 配套代码：`src/db/schema.js`（表结构与派生函数）、`src/db/seed.js`（示例数据）

---

## 一、设计原则

1. **五实体分离**，关系可遍历（父子边 + 婚姻边构成图，支撑称谓推算）
2. **血亲与嗣亲分离**存储，互不覆盖
3. **婚姻独立成表**，支撑多配偶与入赘 / 出赘
4. **世次（数字）与字辈（字）分离**
5. **排序键预计算**，千级节点渲染 O(1)

---

## 二、五项决策落地

| # | 决策 | 落地方式 |
|---|------|----------|
| 1 | 女儿 / 外嫁女子女**可选入谱** | `Person.lineageType`：`clan` 本宗 / `outMarried` 外嫁女 / `external` 外系后代；外嫁女子女允许**仅挂 `motherId`**（无父也可），入谱与否由 `lineageType` 控制 |
| 2 | 过继**归嗣父**，备注血亲 | 世系树渲染优先用 `adoptiveFatherId`；存在嗣父时，节点自动展示血亲备注「本生父：XXX」（由 `fatherId` 派生，不额外存字段） |
| 3 | 字辈**不强校验** | `generationName` 仅作展示与筛选，录入不做一致性拦截 |
| 4 | 配氏记 **「王氏梅花」** | `Person.surname` 存姓；配偶展示名由派生函数生成 `${surname}氏${name}`（如 `王氏梅花`）；谱中关系前缀「配」→「配王氏梅花」 |
| 5 | 在世 / 已故**不区分视觉** | 不做样式分支；仅当 `deathDate` 有值时，在属性栏以文字标注「已故」 |

---

## 三、实体与字段

### 3.1 `Person` 成员

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` | string | ✓ | 唯一 ID（建议 `B01-G03-002` = 房支-世次-序号） |
| `surname` | string | ✓ | 姓（配偶记娘家姓） |
| `name` | string | ✓ | 名 |
| `namePinyin` | string | | 拼音，供检索 |
| `gender` | M / F | ✓ | 性别 |
| `category` | clan / spouse | ✓ | 本族成员 / 配偶 |
| `lineageType` | clan / outMarried / external | ✓ | 谱系归属，默认 clan |
| `generation` | int | | 世次（始祖 = 1） |
| `generationName` | string | | 字辈字（不强校验） |
| `birthOrder` | int | | 排行 |
| `birthDate` | string | | 出生（允许只到年，如 `1932`） |
| `deathDate` | string | | 卒；有值即视为已故 |
| `fatherId` | string | | 生父 |
| `motherId` | string | | 生母 |
| `adoptiveFatherId` | string | | 嗣父（过继） |
| `adoptiveMotherId` | string | | 嗣母（过继） |
| `branchId` | string | | 所属房支 |
| `nativePlace` | string | | 籍贯 |
| `occupation` | string | | 职业 |
| `education` | string | | 学历 |
| `bio` | string | | 简介 / 传记 |
| `portraitId` | string | | 主肖像（引用 `Photo`） |
| `sortKey` | string | | 预计算排序键：房支>世次>[本族0\|配偶9]>排行，例 `B01-G003-0002` |
| `notes` | string | | 备注 |
| `createdAt` / `updatedAt` | number | ✓ | 时间戳 |

**派生字段（不落库）**
- `displayName`：本族 → `name`；配偶 → `${surname}氏${name}`（如 `李氏秀英`）
- `spouseLabel`：谱中标注 → `配${displayName}`（如 `配李氏秀英`）
- `bloodRemark`：有嗣父时 → `本生父：{father.name}`

### 3.2 `Marriage` 婚姻

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` | string | ✓ | |
| `husbandId` / `wifeId` | string | ✓ | 夫 / 妻（引用 `Person`） |
| `type` | marry / ruzhui / chuzhui | ✓ | 嫁娶 / 入赘 / 出赘 |
| `order` | int | | 第几任（多配偶排序） |
| `status` | current / divorced / widowed | | 婚姻状态 |
| `startYear` / `endYear` | string | | 存续年份 |
| `notes` | string | | 备注 |

### 3.3 `Branch` 房支

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` | string | ✓ | 如 `B01` |
| `name` | string | ✓ | 房名（长房 / 二房…） |
| `parentBranchId` | string | | 上级房支（支持多层） |
| `founderPersonId` | string | | 房祖 |
| `sortOrder` | int | | 展示排序 |

### 3.4 `Photo` 照片

| 字段 | 类型 | 必填 | 说明 |
|------|------|:--:|------|
| `id` / `personId` | string | ✓ | 引用成员 |
| `data` | Blob | ✓ | 压缩后二进制 |
| `thumbnail` | Blob | | 缩略图 |
| `caption` / `order` | string / int | | 说明 / 同人排序 |

### 3.5 `Meta` 系统配置（key-value 单表）

`version` 数据版本 ｜ `surname` 姓氏 ｜ `clanName` 宗族名 ｜ `generationPoem` 字辈诗 ｜ `lastBackupAt` 最近备份时间

---

## 四、索引设计（IndexedDB）

| 表 | 索引 |
|----|------|
| `persons` | `id`(主), `surname`, `name`, `namePinyin`, `gender`, `category`, `lineageType`, `generation`, `branchId`, `fatherId`, `motherId`, `adoptiveFatherId`, `sortKey` |
| `marriages` | `id`(主), `husbandId`, `wifeId`, `type`, `status` |
| `branches` | `id`(主), `parentBranchId`, `sortOrder` |
| `photos` | `id`(主), `personId` |
| `meta` | `key`(主) |

---

## 五、校验规则

| 规则 | 内容 |
|------|------|
| **防循环** | 插入父 / 母 / 嗣父时回溯检测：A 不能成为自己的祖先（`isAncestor`） |
| **世次一致** | 子女世次 = 父 / 母世次 + 1（过继按嗣父、入赘按母方） |
| **婚姻合法** | 双方须存在；同一对不可重复；性别符合常规（可按实际放宽） |
| **完整性** | 非始祖至少有一个父 / 母 / 嗣父（外嫁女子女除外，可仅挂母） |

---

## 六、宗法场景处理

| 场景 | 处理 |
|------|------|
| **多配偶** | `Marriage` 多条 + `order` 排序；成员不冗余存配偶 |
| **入赘** | `type='ruzhui'`，赘婿记为 `category='spouse'`；子女随母姓、世次挂本族女方支。**建树时若指定父/母为配偶（赘婿），自动回退到本族一方**（`lineageParentId` 主干优先），避免断链成孤根 |
| **出赘** | `type='chuzhui'`，本族男子出赘；本人仍在谱，注明「后代不入本谱主线」，其后代不建支 |
| **过继** | 填 `adoptive*`，世系图归属嗣父，备注生父 |
| **外嫁女** | `lineageType='outMarried'`，其子女 `external`，可选入谱 |
| **称谓推算** | 由 `father/mother` 边 + `Marriage` 边构可遍历图；两人各上行至最近共同祖先，按代数差 + 房支推导（纯算法） |

---

## 七、示例数据与测试基线

`src/db/seed.js` 为开发/演示基线数据（人物与事件均虚构）：

| 项 | 规模 |
|---|---|
| 世代 | 6 世（守 · 德 · 建 · 志 · 承 · 先） |
| 房支 | 3 个（长房 B01 / 二房 B02 / 三房 B03） |
| 成员 | 42 人（本族 27 + 配偶 15） |
| 婚姻 | 15 条 |
| 关系场景 | 嫁娶 · 多配偶（元配/续弦）· 入赘 · 出赘 · 过继 · 外嫁女 · 外嫁女子女入谱 · 离异 · 在世/已故 |

配套测试：

| 脚本 | 覆盖 |
|---|---|
| `tests/smoke.js` | 派生函数 · 防循环 · ID 生成 · 建树归属 · 称谓推算（59 项） |
| `tests/ui-smoke.js` | 启动建库 → 列表 → 表单 → 世系图 → 数据视图全链路（74 项） |
| `tests/create-cases.js` | **单条数据创建场景用例 63 条**，运行后自动输出 `docs/create-cases-report.md` |

运行方式（`NODE_PATH` 指向装了 jsdom / fake-indexeddb 的托管目录）：

```
NODE_PATH=<workspace>/node_modules node tests/smoke.js
NODE_PATH=<workspace>/node_modules node tests/ui-smoke.js
NODE_PATH=<workspace>/node_modules node tests/create-cases.js
```

---

*本文件为数据模型唯一依据；字段变更需同步更新 `src/db/schema.js` 与本文档版本号。*
