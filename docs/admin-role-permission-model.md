# 运营端角色与权限模型说明（admin-role-permission-model）

> 适用范围：用户中心运营端（`agri-sso/ops`）的角色管理、权限矩阵。
> 代码实现：`core-platform/mod-platform/.../internal/permission/` 与 `agri-sso/ops/src/pages/RolePages.tsx`。

---

## 1. 领域概念与职责

| 概念 | 载体 | 职责 | 不负责 |
| --- | --- | --- | --- |
| 平台级角色 Role | `platform_role` | 平台运营人员的职责集合，编码 `code` 为业务主键，一个角色一套权限码 | 不表达组织/租户归属，不承载成员明细 |
| 用户-角色绑定 | `platform_user_role` | 记录「用户 × 角色 × 市场」四维绑定，成员数由此统计 | 不存权限码 |
| 权限点 Permission Point | `platform_role.permissions` 中的字符串 | 授权最小单元，格式 `module:action`，如 `trade:read`、`uc:admin` | 不描述菜单层级外观 |
| 菜单 Menu | 前端 `AppShell.tsx` 的静态菜单配置 | 页面入口骨架（分组、标题、路由） | 不作为授权数据源，不单独建表 |
| 通配权限 `*` | `platform_role.permissions` | 超级管理员拥有全部权限 | 不建议分配给日常运营角色 |
| 组织级角色 | `agri_master_data.agri_md_role`（主数据域） | 企业/组织内部的角色，按 `tenant_id` 隔离 | 不在运营端创建、编辑、删除 |

### 1.1 为什么运营端只有平台级角色

`platform_role` 是平台域表，按表前缀隔离纪律（ADR-001）只能由 `mod-platform` 写入。组织级角色涉及租户数据权限、组织结构、企业侧菜单，属于主数据域 `agri_md_*` 体系，两套模型**不互相写入、不共享主键**。

运营端角色列表的「适用层级」列固定展示「平台级」，这是模型事实，不是缺失字段。

---

## 2. 数据关系

```
platform_user ──< platform_user_role >── platform_role
                                              │
                                              └─ permissions: JSON 数组 ["trade:read","trade:write",...]
                                              │
                                              └─ status: enabled / disabled
                                              └─ description / created_at / updated_at

前端菜单(AppShell，静态)  ──映射──>  权限码前缀(module)
                                       └─ 菜单级: module:read
                                       └─ 操作级: module:write / delete / export / audit / admin
```

- 权限码存在 `platform_role.permissions`（TEXT，JSON 数组），一个角色一份快照。
- 没有 `platform_role_permission` 关联表；写入是**整体覆盖**，不是增量追加。
- 菜单不是数据表，也不存在 `platform_menu` / `platform_role_menu`。运营端菜单由前端静态配置决定，按权限码过滤入口。

---

## 3. 权限点分层

| 层级 | 权限码 | 含义 | 页面承载 |
| --- | --- | --- | --- |
| 菜单级 | `<module>:read` | 能进入业务域、看到列表 | 权限矩阵每个模块折叠面板第一行「菜单级」 |
| 操作级 | `<module>:write` | 新增/编辑 | 同一面板第二行「操作级」 |
| 操作级 | `<module>:delete` | 删除 | 同上 |
| 操作级 | `<module>:export` | 导出 | 同上 |
| 操作级 | `<module>:audit` | 审核 | 同上 |
| 操作级 | `<module>:admin` | 管理（配置类动作） | 同上 |
| 身份型权限 | 如 `finance:borrower`、`trade:consumer` | 不是 CRUD，属于业务身份能力 | 矩阵下方「其它权限码」区，可单独移除 |

**约束**：新增权限码必须为 `module:action` 形式；`module` 需登记到 `RolePages.tsx` 的 `MODULE_LABEL`，否则矩阵显示原始前缀（有意的兜底，不猜中文）。

---

## 4. 接口契约

| 方法 | 路径 | 说明 | 落库 |
| --- | --- | --- | --- |
| GET | `/api/v1/admin/roles` | 角色列表，回填 `memberCount`、默认 `status`、`updatedAt` | 读 |
| POST | `/api/v1/admin/roles` | 新建角色 `{code,name,description}`；编码重复返回 409 | 写 `platform_role` |
| PUT | `/api/v1/admin/roles/{code}` | 编辑 `{name,description,status}`；编码不可改 | 写 `platform_role` |
| DELETE | `/api/v1/admin/roles/{code}` | 删除；内置角色/仍被用户绑定会明确阻断 | 写 `platform_role` |
| GET | `/api/v1/admin/roles/{code}/permissions` | 读取权限码（回读校验） | 读 |
| PUT | `/api/v1/admin/roles/{code}/permissions` | 覆盖写入 `{permissions:[...]}`，同时兼容 `permissionIds` | 写 `platform_role.permissions` |

**没有**菜单 CRUD 接口：核心平台不存在菜单表。运营端不提供"菜单管理"页面，避免出现只改前端、刷新即丢的假落库。

### 4.1 已修正的落库问题

1. **角色无法新建**：原先只有 GET / GET permissions / PUT permissions，前端也就没有新建入口。已补 POST。
2. **角色无法编辑/启停/删除**：已补 PUT 与 DELETE，并在删除前检查 `platform_user_role` 绑定数。
3. **权限列宽不足**：`platform_role.permissions` 原为 `VARCHAR(1000)`，12 域 × 6 动作序列化后约 1300 字符，勾满会报「权限码过多」。V57 迁移改为 `TEXT`，服务端上限放宽到 60000 字符，仅用于拦截异常 payload。
4. **列表数据陈旧**：角色列表不刷新导致「权限数」不更新。现所有写操作成功后重新拉取列表；权限保存后另外回读 `GET /{code}/permissions` 并比对集合，不一致直接报错。
5. **新角色看不到**：历史上主数据域另有一套 `agri_md_role`，在别的后台建的角色不会出现在 `platform_role` 列表。本模型明确两域隔离：运营端只管 `platform_role`；组织级角色请在主数据域维护（后续如需统一入口，需单独做跨域只读聚合，不允许双写）。

---

## 5. 前端页面承载

| 页面 | 路由 | 职责 |
| --- | --- | --- |
| 角色管理 `RoleListPage` | `#/role-list` | 列表、搜索/状态筛选、分页、新建、编辑、启停、删除、详情（成员与已分配权限）、权限预览 |
| 权限矩阵 `PermMatrixPage` | `#/perm-matrix` | 按模块折叠分组，菜单级/操作级分层勾选；全选/反选/清空；保存后回读 |
| 菜单管理 | 不存在 | 菜单为静态骨架；不提供 CRUD |

### 5.1 权限矩阵交互约定

- 行：业务模块；列/行内选项：菜单级 `read` 与操作级其余动作。
- 每个模块面板支持「全选 / 清空」；页面级支持「全选 / 反选 / 清空矩阵 / 重置 / 保存」。
- 通配 `*` 时所有勾选只读，需先点「转为细粒度」再编辑。
- 切换角色若有未保存改动，先二次确认，避免丢失。
- 保存流程：`PUT` → `GET` 回读 → 集合比对 → 一致才提示成功。

---

## 6. 后续扩展约束

1. **不把组织级字段塞进 `platform_role`**（如 `tenant_id`、`org_id`）。需要组织级角色时扩展 `agri_md_role`，保持两域独立。
2. **不新增 `platform_menu` / `platform_role_menu`**，除非有新的 ADR 明确平台菜单模型；菜单骨架与权限码保持"菜单是壳、权限是挂载点"的关系。
3. **新增权限动作**先在 `ACTION_LABEL` 注册，再扩展矩阵；未登记的动作仍可作为"其它权限码"保留，不会丢失。
4. **权限写入只能整体覆盖**，避免增量合并产生"删不掉的旧权限"。
5. **删除角色前必须校验**：内置角色、仍被 `platform_user_role` 绑定的角色一律阻断。
6. **停用角色不等于删权限**：`status=disabled` 保留配置，恢复启用即可；权限判定方需自行过滤停用角色。
7. **不要在运营端创建组织级角色**，也不要在主数据域写 `platform_role`。

---

## 7. 网关与权限拦截层清单（`/api/v1/admin/**`）

结论先行：**新增的 `POST/PUT/DELETE /api/v1/admin/roles` 不需要改任何白名单或网关配置**，现有拦截层已按前缀覆盖全部方法。

| 层 | 位置 | 规则 | 对 `/api/v1/admin/roles` 的影响 |
| --- | --- | --- | --- |
| Spring Security | 不存在 | 核心平台未引入 starter-security，`core-infra` 只用 `spring-security-crypto`（BCrypt），全仓无 `SecurityFilterChain` | 不涉及 |
| JWT 认证过滤器 | `core-platform/mod-platform/.../auth/JwtAuthFilter.java` | `/api/v1/admin/` 必须带 Bearer；`SUPER_ADMIN_ONLY` 含 `/api/v1/admin/roles/**`，要求权限含 `*` | 已覆盖 POST/PUT/DELETE（AntPathMatcher 只看 URI，不看 method） |
| 权限服务 | `.../permission/UserPermissionService.java` | 通配 `*`；操作员角色 `SUPER_ADMIN`/`MARKET_OPS` | 角色管理不对 `MARKET_OPS` 开放，保持现状 |
| 业务过滤器 | `core-infra/.../web/RequestIdFilter` | 仅注入 traceId | 不涉及 |
| 网关 nginx | `ops/gateway/conf/conf.d/20-prod.conf`、`30-mdm.conf`、`73-user-center-ops.conf`、`70-admin-entry.conf` | `location /api/v1/admin/ { proxy_pass ... }`，无 method 限制、无 IP 白名单 | 整段前缀转发，DELETE 同样可达 |
| CORS | `core-app/.../config/WebConfig.java` | 允许方法已含 `DELETE`；来源白名单来自 `AGRI_CORS_ORIGINS` | 不涉及 |
| 前端 | `agri-sso/ops/src/sso.tsx`、`api.ts` | 401 跳转 SSO；**403 现在会把后端 `message` 透出**（如「角色编码已存在」），不再显示 axios 原文 | 只影响提示文案 |

**安全边界**：角色管理仍为「超级管理员专属」。`MARKET_OPS` 或其他运营账号调用会得到 403，前端只是隐藏按钮、不是判据。没有把 `/api/v1/admin/**` 整体放宽，也没有新增 `role:read/write/delete` 权限码——沿用既有 `platform_role.permissions` 的 `module:action` 口径，避免出现第二套角色管理授权模型。

---

## 8. 组织级角色归属（企业端 + 租户管理员）

### 8.1 归属边界

- 数据归属 `agri_md_role` / `agri_md_user_role` / `agri_md_role_permission`（主数据域），保持不动，不迁入 `platform_role`。
- **企业端**（`agri-master-data/web` 的 `/user` 端）承载组织级角色的列表、新建/编辑、成员管理、权限授权；页面 `views/userportal/UserRoles.vue`，路由 `/user/roles`。
- **运营端**不再提供组织级角色的增删改入口：`agri-master-data/web` 的 `/permission/matrix`（`RoleMatrix.vue`）已改为只读并加归属说明，仍保留授权申请审批与全景对照。
- 其他子系统（生产/交易/金融/资讯/政务/服务/物联网/s2b2c）经盘点**没有租户级成员-角色模型**，不新建页面，避免造出没有后端落库的空壳。
- agri-portal 用户中心已有可用的「成员管理 / 角色与权限」页（`#/account/team`、`#/account/roles`），当前落在生产域 `agri_prod_role`。**保持现状不改**；若要统一到 `agri_md_role` 属于数据迁移项目，需单独确认后再做。

### 8.2 企业端接口（增量，不改既有契约）

| 方法 | 路径 | 说明 | 落库 |
| --- | --- | --- | --- |
| GET | `/api/user/roles` | 平台共享角色 + 本主体角色（既有） | 读 |
| POST | `/api/user/roles` | 新建本主体角色（既有） | 写 `agri_md_role` |
| PUT | `/api/user/roles/{id}` | 改名称/数据范围/说明（既有） | 写 `agri_md_role` |
| DELETE | `/api/user/roles/{id}` | 新增；内置/共享/有成员的角色阻断 | 软删 `agri_md_role` + 清 `agri_md_role_permission` |
| GET | `/api/user/roles/{id}/members` | 新增；只返回本主体账号 | 读 `agri_md_user_role` |
| POST | `/api/user/roles/{id}/members` | 新增；`{userIds:[]}`，跨主体账号 403 | 写 `agri_md_user_role` |
| DELETE | `/api/user/roles/{id}/members/{userId}` | 新增 | 删 `agri_md_user_role` |
| GET | `/api/user/roles/grantable-permissions` | 新增；可授予权限点目录 | 读 |
| GET | `/api/user/roles/{id}/permissions` | 新增；角色已持有权限点 | 读 |
| PUT | `/api/user/roles/{id}/permissions` | 新增；`{permIds:[]}`，越界整单 403 | 写 `agri_md_role_permission` |

### 8.3 租户边界校验落在哪一层

服务端 `UserWorkspaceController`（`com.agri.masterdata.controller.user`）：

1. `requireTenant()`：tenantId 只从令牌/`X-Agri-Merchant` 解析结果取，绝不从请求体取。
2. `requireOwnedRole(id, tenantId)`：角色必须存在、未删除、`tenant_id` 等于当前主体；平台共享角色（tenant 为空）也拒绝写入。换 `roleId` 只能拿到 403。
3. 成员写入：先按 `user_id in (...)` + `tenant_id = 当前主体` 查账号，数量对不上直接 403，并说明有几个账号不属于本主体；不做静默跳过。
4. 权限写入：`grantablePermIds(tenantId)` 计算可授予集合 =
   平台共享角色已持有的点 ∪ 本主体现有角色已持有的点 ∪ 运营端已批准给本主体的授权申请点。
   请求中只要有一个点在集合外，整单 403 并列出 `permCode`，不做部分写入。
5. 前端 `v-point` 只是隐藏入口；越权判定全部在服务端。

### 8.4 已知缺口（需产品确认）

- 平台尚无「租户套餐 → 权限点」的显式授权表；当前用「共享角色已持有的点 + 已批准的授权申请点 + 既有角色基线」近似"平台已授予集合"。若要做套餐级授权，应新增 `tenant_id → perm_id` 关系表并由平台维护，而不是放宽校验。
- 门户角色页仍在生产域；与 `agri_md_role` 的双数据源需要在后续单独收敛。

