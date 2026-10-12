# legacy-prototype —— 暂存的界面实现（不参与构建与路由）

## 这里放的是什么

原先 `src/views/masterdata/` 下有 8 个页面，它们**都不调用任何后端接口**，
数据全来自页面内的写死数组。运营端侧边栏的入口指向的是另一套已经接上真数据的页面，
于是这 8 个页面只在手工输入 URL 时才可达 —— 同一批功能存在两套界面，
一套是真的、一套是假的，长期放着必然有人照假的那套改。

按"合并"处理的原则：**已接线的页面为唯一实现**。处理结果如下。

## 一、已合并（界面能力搬进已接线页面，原文件删除）

| 原页面 | 去向 | 说明 |
| :-- | :-- | :-- |
| `OrganizationManagement.vue` | 合并进 `src/views/org/OrgList.vue` | 它唯一多出的能力是"按层级看组织"。已搬入组织页左侧的**组织架构树**，并改为读真实接口 `GET /org/tree`；原来写死的三层嵌套改成按 children 递归拍平，层数不再受限于三层。 |
| `UserManagement.vue` | 删除 | 列表 / 分页 / 筛选 / 增删改由 `views/user/UserList.vue` 覆盖，详情由 `views/user/UserDetail.vue`（路由 `/user/detail/:id`）覆盖。 |
| `CustomerSupplierManagement.vue` | 删除 | 客户与供应商两个页签分别由 `views/customer/CustomerList.vue` 与 `views/customer/SupplierList.vue` 覆盖。 |

## 二、暂存待搬（本目录下的 5 个文件）

这 5 个页面的界面比已接线的版本丰富，但**它们多出来的能力需要先有后端接口**，
否则搬过去也只是把假数据从一个文件挪到另一个文件。因此先停在这里，
等对应接口落地后再搬进 `src/views/` 并接上真实数据。

| 文件 | 多出的能力 | 搬进去需要什么 |
| :-- | :-- | :-- |
| `ProductManagement.vue` | 左侧"商品分类"面板（分类树 + 分类增删改） | admin 族的商品分类接口（`agri_md_product_category` 表与实体已存在，缺 `/admin/masterdata/product/category/*`） |
| `RoleManagement.vue` | 角色的"权限配置"面板（按模块勾选权限点、保存） | 角色-权限关联接口（`agri_md_role_permission` / `agri_md_permission` 表已存在，缺读写端点） |
| `AddressManagement.vue` | 行政区划树 + 地址标准化配置 + 处理日志 | admin 族的地区接口（`agri_md_address_region` 表与 `AddressRegion` 实体已存在，只有旧 `/api/master-data/address` 族） |
| `DataStandardManagement.vue` | "数据标准"与"变更审核"两个页签 | 数据标准表；`standard/change-approve` 目前是空壳（恒返回空数组） |
| `DataQualityManagement.vue` | 质量规则 / 检测任务 / 问题工单 三合一 | 质量规则与检测任务两张表；`quality/*` 目前全是空壳 |

## 三、注意

- 本目录**不在 `src/` 之下**，`vite` 的入口与 `import.meta.glob('../views/**/*.vue')` 都扫不到它，
  因此这些页面既不参与构建、也不会被登记成路由。
- 文件里保留的是界面与交互实现（表格、弹窗、表单校验、树展开等），
  搬用时**只复用界面**，数据层必须改成调接口 —— 它们原先是写死的假数组。
