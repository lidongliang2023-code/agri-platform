# 运营端列表页样式规范（admin-list-page-style-guide）

> 适用范围：`agri-sso/ops`（用户中心运营端，端口 8115）的所有列表页。
> 视觉基准：生产管理系统用户端「农场详情」页。
> 本文所有数值、变量名都来自仓库真实代码，不另行造 token。

---

## 1. 基准页面与令牌来源

| 类型 | 文件 |
| --- | --- |
| 基准页面 | `agri-production/frontend/src/pages/user/farms/FarmDetail.tsx` |
| 基准主题样式 | `agri-production/frontend/src/styles/production-member-theme.css` |
| 基准 antd 主题 | `agri-production/frontend/src/styles/productionTheme.ts` |
| 共享设计令牌 | `packages/agri-shared/src/tokens/tokens.css`、`packages/agri-shared/src/tokens/index.ts` |
| 运营端全局样式 | `agri-sso/ops/src/styles.css` |
| 运营端 antd 主题 | `agri-sso/ops/src/App.tsx` |

两端主题主色、文本色、边框色基本一致（`#12764a` / `#0b1a12` / `#e3eae5`），因此运营端直接复用自身变量即可与生产端对齐，不需要跨应用引用 CSS。

---

## 2. 页面骨架

```
PageTitle（眉标 / 标题 / 说明 / 右侧动作）
  └─ 可选：grid-3 统计卡（stat-tile）
  └─ section.surface-card.list-card
        ├─ div.list-toolbar（筛选与搜索）
        └─ Table.agri-list-table（列表 + 分页 + 空态）
```

对应基准页面：`PageContainer`（标题区）→ `Space direction="vertical" size={16}`（16px 间距节奏）→ `Card`（内容容器）。

**间距节奏**

| 位置 | 值 |
| --- | --- |
| 页面内容区 | `.app-content` padding `22px 24px 34px` |
| 区块之间 | `.page-stack` 纵向 gap 16px |
| 卡片内边距 | `.surface-card.list-card` `16px 18px` |
| 筛选区与表格 | `list-toolbar` 下内边距 14px + 下外边距 16px |
| 卡片圆角 | 12px（与基准 `.agri-layout .ant-card` 一致） |

---

## 3. 字号与字重层级（运营端真实变量）

| 用途 | 变量 / 值 | 字重 |
| --- | --- | --- |
| 页面标题 | `--o-fs-23`（23px） | 750 |
| 卡片/区块标题 | `--o-fs-15` ~ `--o-fs-16` | 700 |
| 正文/表格主字段 | `--o-fs-12_5` ~ 14px | 600（关键列）/ 400 |
| 辅助说明/次要信息 | `--o-fs-12`，`--ink-500` | 400 |
| 眉标（eyebrow/kicker） | `--o-fs-micro`（12px），`--green-600` | 700，字距 `.16em` |

---

## 4. 颜色与状态语义

### 4.1 基础色（`agri-sso/ops/src/styles.css` 的 `:root`）

| 变量 | 值 | 用途 |
| --- | --- | --- |
| `--green-600` | `#12764a` | 主色、主按钮、链接 |
| `--green-500` | `#159a5e` | 主按钮渐变第二段 |
| `--green-100` | `#e4f6ec` | 选中底、状态底 |
| `--green-050` | `#f1fbf5` | 表格 hover、菜单级权限底 |
| `--ink-900` | `#0b1a12` | 主文本 |
| `--ink-500` | `#718277` | 次要文本 |
| `--ink-400` | `#93a198` | 占位/禁用文本 |
| `--line` | `#e1e9e3` | 卡片/表头边框（生产端对应 `--prod-line #e3eae5`，视觉几乎一致） |
| `--line-soft` | `#edf2ee` | 表格行分隔线 |
| `--bg` | `#f4f7f5` | 页面背景、表头底色 |

### 4.2 状态色语义

| 状态 | 展示 | 色 |
| --- | --- | --- |
| 启用 / 已认证 / 已通过 | `soft-tag tone-green` + 文案 | 绿 `--green-100 / --green-700` |
| 待处理 / 待审核 / 待认证 | `soft-tag tone-amber` + 文案 | 琥珀 `--amber-100 / --amber-700` |
| 驳回 / 失败 / 危险 | `soft-tag tone-red` + 文案 | 红 `--red-100 / --red-700` |
| 停用 / 中性 / 未知 | `soft-tag tone-gray` + 文案 | 灰 `#eef2ef / --ink-500` |
| 信息 / 层级标识（平台级） | `soft-tag tone-blue` | 蓝 `--tech-100 / --tech-700` |

**要求**：状态必须同时有文字，不得只靠颜色区分；未知枚举保留原值并在旁边标明，不擅自猜中文。

---

## 5. 表格规范（`.agri-list-table`）

| 项 | 规范 |
| --- | --- |
| 表头 | 背景 `#f4f7f5`，文字 `#4b5d53`，字重 600，底边框 `--line` |
| 单元格 | `padding: 11px 12px`，底边框 `--line-soft` |
| 行 hover | 背景 `#f1fbf5` |
| 斑马纹 | 不使用（与基准一致） |
| 主字段 | 第一列 `b` + 第二行 `.small.muted` 展示编码/单号等辅助信息 |
| 空态 | `Empty` + `Empty.PRESENTED_IMAGE_SIMPLE`，有筛选时提供「清空筛选」 |
| 加载态 | `Table loading`，不要额外盖全屏 loading |
| 分页 | 右下角，`showTotal`、`showSizeChanger`、`pageSizeOptions`，上边距 16px |
| 横向滚动 | 列较多时 `scroll={{ x: 1180 }}`，避免挤压关键列 |
| 列宽 | 操作列固定宽度；文本列不设死宽，允许换行 |

### 权限预览类"长文本列"专项约定

1. 不要把更多信息塞进固定窄列并 `nowrap` 截断。
2. 展示最多 3 个可读项 + `等 N 项`，整列允许换行。
3. 提供点击/悬浮查看全部（`Popover` 或 `title`），列表容器设置 `max-height` + 滚动。
4. 权限项必须显示可读名称（`信息资讯·查看`），不能直接展示 `info:read` 原始码。

实现参考：`agri-sso/ops/src/pages/RolePages.tsx` 中的 `PermissionPreview`。

---

## 6. 筛选与操作区（`.list-toolbar`）

- 布局：`display:flex; flex-wrap:wrap; align-items:center; gap:8px`。
- 顺序：关键字输入（宽 260–280）→ 主按钮「搜索」→ 下拉筛选（宽 140–160）→ 条件生效时「清空筛选」文字按钮。
- 回车即搜索（`onPressEnter`），不要求用户必须点按钮。
- 筛选条件与页码联动：任何筛选变化都把 `pageNum` 重置为 1。
- 窄屏（≤900px）：输入/下拉 `flex:1 1 100%` 独占一行（见 `styles.css` 媒体查询）。

按钮层级：

| 层级 | 用法 |
| --- | --- |
| 主按钮 `type="primary"` | 页面唯一主行为：搜索、新建、保存 |
| 次按钮（默认） | 重置、关闭、全选/反选 |
| 文字按钮 `type="link"` | 行内详情、编辑、清空筛选 |
| 危险按钮 `danger` | 删除；必须套 `Popconfirm` 并说明后果 |

---

## 7. 空态、加载态与错误态

- **空态**：说明当前是"没有数据"还是"筛选无结果"，两者文案不同；无数据时给主操作入口。
- **加载态**：列表用 `Table loading`；保存类按钮用 `loading`，防止重复提交。
- **错误态**：统一 `ErrorBlock`（`components/ui.tsx`），带重试回调；不要只弹一次 `message` 后页面空白。
- **保存回读**：写操作成功后必须重新拉取（列表接口或详情接口），再更新界面；不以本地 state 为准。

---

## 8. 可访问性

1. 对比度：正文 `--ink-900` 对白底、次要文字 `--ink-500` 对白底均满足常规可读性；状态标签不得仅用色块。
2. 键盘：搜索支持回车；`Checkbox`/按钮保持原生可聚焦；弹窗关闭支持 Esc（antd 默认）。
3. 图标按钮必须有 `aria-label` 或可见文字；本规范要求行内操作优先用文字。
4. 表格：金额/数量右对齐、状态列居中或左对齐保持一致；空态文案可被读屏识别。
5. 动效：只使用 antd 默认过渡，不额外加长动画；尊重 `prefers-reduced-motion`（如需自定义动画必须加媒体查询）。

---

## 9. 如何照着规范写一个新列表页

1. 用 `PageTitle` 写页头，说明里写清数据范围与关键规则。
2. 需要概览时加 `grid-3` + `stat-tile`，指标最多 3 个。
3. 内容区用 `<section className="surface-card list-card">`。
4. 筛选区用 `<div className="list-toolbar">`，遵守第 6 节顺序。
5. `Table` 加 `className="agri-list-table"`，用 `ColumnsType` 明确列类型。
6. 写 `locale.emptyText`，区分"无数据"与"筛选无结果"。
7. 分页交给 `Table.pagination`，不要自己拼 `Pagination`。
8. 写操作全部走 `ucApi`，成功后重新拉取列表。

代码骨架：

```tsx
<PageTitle
  eyebrow="组织管理"
  title="组织列表"
  description="平台组织与账号是多对多关系，认证状态决定能否参与业务"
/>

<div className="grid-3">
  <div className="stat-tile">
    <span className="stat-label">组织总数</span>
    <b className="stat-value">{total}<small>家</small></b>
    <span className="stat-note">当前筛选条件下的全部组织</span>
  </div>
</div>

<section className="surface-card list-card">
  <div className="list-toolbar">
    <Input
      value={draft}
      placeholder="搜组织名称 / 编码 / 信用代码"
      style={{ width: 260 }}
      onChange={(event) => setDraft(event.target.value)}
      onPressEnter={applySearch}
    />
    <Button type="primary" onClick={applySearch}>搜索</Button>
    <Select value={status} style={{ width: 150 }} options={statusOptions} onChange={applyStatus} />
  </div>

  <Table
    className="agri-list-table"
    rowKey="id"
    size="middle"
    loading={loading}
    columns={columns}
    dataSource={rows}
    scroll={{ x: 1180 }}
    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无组织数据" /> }}
    pagination={{
      current: pageNum,
      pageSize,
      total,
      showSizeChanger: true,
      showTotal: (count) => `共 ${count} 家组织`,
      onChange: (next, nextSize) => { /* 重置页码/页大小 */ },
    }}
  />
</section>
```

---

## 10. 已按本规范改造的页面

| 页面 | 文件 | 状态 |
| --- | --- | --- |
| 组织列表 | `agri-sso/ops/src/pages/OrgPages.tsx` | 已对齐：页头 + 3 统计卡 + `list-toolbar` + `agri-list-table` + 空态/分页/清空筛选 |
| 身份申请审核 | `agri-sso/ops/src/pages/AuditPages.tsx` | 已对齐：筛选条、申请详情弹窗、空态、分页 |
| 角色管理 | `agri-sso/ops/src/pages/RolePages.tsx` | 已对齐：页头 + 统计卡 + 筛选 + 权限预览 + 分页 |
| 权限矩阵 | `agri-sso/ops/src/pages/RolePages.tsx` | 复用同一套卡片/间距，矩阵内按「菜单级 / 操作级」分层 |

---

## 11. 不要做的事

- 不要新造一套圆角/阴影/字号变量；优先用 `styles.css` 的 `:root` 变量。
- 不要给列表加斑马纹、重阴影、彩色卡片背景。
- 不要用 `nowrap + ellipsis` 隐藏关键信息而不给查看全部的入口。
- 不要只改前端 state 制造"保存成功"；写操作必须回读。
- 不要把状态只做成颜色点，必须带文字。
