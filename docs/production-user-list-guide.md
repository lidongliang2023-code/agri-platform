# 生产管理用户端列表组件

用户端查询区统一使用 `ProductionListFilters`，列表统一通过
`ProductionRequestTable` 或 `BusinessRecordList` 复用共享 Vue 列表组件。

## 查询区

- 每个直接子节点是一个筛选字段，可使用 `Form.Item` 或带标签的控件容器。
- 传入 `form` 时保留现有 `FormModel` 的字段绑定、校验及初始值，通过 `onFinish` 查询。
- 受控控件不传 `form`，通过 `onSearch` 查询，通过 `onReset` 保留页面原有的重置逻辑。
- 查询、重置按钮由组件统一生成，不再在页面里单独拼接；回车仅通过表单提交。
- 默认四个及以上字段可展开、收起，初次收起；三个及以下字段直接展示。
- 查询条件以农事计划为基准：内容区宽度达到 1040px 时四列、800–1039px 时三列，更窄时两列或单列。
- 收起时，桌面内容区展示三个字段、更窄内容区展示两个、单列时展示一个；跨列字段按实际可用空间收起。
- 生产端启用等宽列模式，字段数量与展开状态改变时不重新分配已有字段宽度。
- 查询表单项的下边距在组件内归零，避免全局表单样式的 24px 下边距破坏按钮对齐。
- 折叠通过 CSS 隐藏字段，不卸载控件，不丢失输入值或字段注册。
- 跨两列的字段使用 `production-filter-span-2`；容器宽度不足时自动降为单列。
- `loading` 同时禁用查询和重置，阻止加载期间重复提交。
- 在已有卡片内使用默认的 `embedded`；独立查询卡片使用 `embedded={false}`。

```tsx
<ProductionListFilters
  form={filterForm}
  onFinish={handleSearch}
  onReset={handleReset}
  loading={listQuery.isFetching}
>
  <Form.Item name="keyword" label="关键字">
    <Input allowClear placeholder="名称 / 编号" />
  </Form.Item>
  <Form.Item name="status" label="状态">
    <Select allowClear placeholder="全部状态" options={statusOptions} />
  </Form.Item>
</ProductionListFilters>
```

## 列表布局

- 查询区、工具栏、表格、分页保持四段式结构，保留原有业务卡片及视图切换。
- 请求型列表根据列定义生成查询字段，并复用同一个 `ProductionListFilters`。
- 手动列表继续使用原有数据源和分页回调；查询、重置时由页面重置至第一页。
- 在已有业务卡片内不重复显示表格卡片的边框与内边距。
- 操作列、数值列、编码列不压成多行；长文本沿用列定义的省略与提示。
- 横向溢出在表格内部滚动，工具栏和分页在窄屏换行，不撑宽整个页面。
