package com.agri.masterdata.controller.user;

import com.agri.admin.service.AnnouncementService;
import com.agri.common.constant.ErrorCode;
import com.agri.common.entity.ApiResponse;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.masterdata.entity.Customer;
import com.agri.masterdata.entity.CustomerSupplierRelation;
import com.agri.masterdata.entity.Department;
import com.agri.masterdata.entity.OperationLog;
import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.entity.Position;
import com.agri.masterdata.entity.ProductCategory;
import com.agri.masterdata.entity.MemberProfile;
import com.agri.masterdata.entity.Role;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.mapper.AnnouncementMapper;
import com.agri.masterdata.mapper.CustomerMapper;
import com.agri.masterdata.mapper.CustomerSupplierRelationMapper;
import com.agri.masterdata.mapper.DepartmentMapper;
import com.agri.masterdata.mapper.MemberProfileMapper;
import com.agri.masterdata.mapper.OperationLogMapper;
import com.agri.masterdata.mapper.OrganizationMapper;
import com.agri.masterdata.mapper.PositionMapper;
import com.agri.masterdata.mapper.PermissionMapper;
import com.agri.masterdata.mapper.PermissionRequestMapper;
import com.agri.masterdata.mapper.ProductCategoryMapper;
import com.agri.masterdata.mapper.ProductMapper;
import com.agri.masterdata.mapper.RoleMapper;
import com.agri.masterdata.mapper.RolePermissionMapper;
import com.agri.masterdata.mapper.SupplierMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.mapper.UserRoleMapper;
import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.entity.PermissionRequest;
import com.agri.masterdata.entity.RolePermission;
import com.agri.masterdata.entity.UserRole;
import com.agri.masterdata.service.IPermissionService;
import com.agri.masterdata.vo.PermissionVO;
import com.agri.masterdata.vo.ProductVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.springframework.jdbc.core.JdbcTemplate;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.time.LocalDateTime;

/**
 * 企业端工作区接口。
 *
 * <p><b>为什么单独一组 {@code /api/user/**}</b>：运营端接口（{@code /admin/masterdata/**}）接受
 * {@code tenantId} 参数，谁都能传别人的主体；企业端必须**只按令牌 + 已验证的主体上下文**取数，
 * 不接受任何调用方指定的租户。</p>
 *
 * <p>主体上下文由 {@code AuthenticationInterceptor} 从请求头 {@code X-Agri-Merchant} 解析，
 * 并回源 core-platform 校验归属；这里再从 {@link SecurityUtils#getTenantId()} 取，取不到就直接拒绝，
 * 绝不在"没有主体"时退化成全量查询。</p>
 */
@RestController
@RequestMapping("/api/user")
@RequiredArgsConstructor
public class UserWorkspaceController {

    private final OrganizationMapper organizationMapper;
    private final UserMapper userMapper;
    private final ProductMapper productMapper;
    private final DepartmentMapper departmentMapper;
    private final PositionMapper positionMapper;
    private final RoleMapper roleMapper;
    private final ProductCategoryMapper productCategoryMapper;
    private final CustomerSupplierRelationMapper relationMapper;
    private final OperationLogMapper operationLogMapper;
    private final CustomerMapper customerMapper;
    private final AnnouncementService announcementService;
    private final SupplierMapper supplierMapper;
    private final MemberProfileMapper memberProfileMapper;
    private final UserRoleMapper userRoleMapper;
    private final RolePermissionMapper rolePermissionMapper;
    private final PermissionMapper permissionMapper;
    private final PermissionRequestMapper permissionRequestMapper;
    private final IPermissionService permissionService;
    /** 仅用于生成业务编码时取已有最大序号（需要 LIKE 前缀匹配，用 Mapper 写起来更绕） */
    private final JdbcTemplate jdbcTemplate;

    /** 当前企业端上下文（前端用来确认主体是否已生效）。 */
    @GetMapping("/context")
    public ApiResponse<Map<String, Object>> context() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("userId", SecurityUtils.getUserId());
        view.put("username", SecurityUtils.getUsername());
        view.put("merchantId", requireTenant());
        return ApiResponse.success(view);
    }

    /** 本主体下的组织（平铺；前端按 parentId 建树）。 */
    @GetMapping("/orgs")
    public ApiResponse<List<Map<String, Object>>> orgs() {
        String tenantId = requireTenant();
        List<Organization> rows = organizationMapper.selectOrgByTenantId(tenantId);
        List<Map<String, Object>> list = new ArrayList<>();
        for (Organization org : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", org.getId());
            item.put("orgCode", org.getOrgCode());
            item.put("orgName", org.getOrgName());
            item.put("orgType", org.getOrgType());
            item.put("parentId", org.getParentId());
            item.put("orgLevel", org.getOrgLevel());
            item.put("orgPath", org.getOrgPath());
            item.put("contactPerson", org.getContactPerson());
            item.put("contactPhone", org.getContactPhone());
            item.put("status", org.getStatus());
            item.put("authStatus", org.getAuthStatus());
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /** 本主体成员（带角色名）。 */
    @GetMapping("/members")
    public ApiResponse<PageResult<Map<String, Object>>> members(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long orgId) {
        String tenantId = requireTenant();
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, tenantId)
                .eq(User::getDelFlag, 0)
                .eq(orgId != null, User::getOrgId, orgId)
                .and(keyword != null && !keyword.isBlank(), w -> w
                        .like(User::getUsername, keyword)
                        .or().like(User::getRealName, keyword)
                        .or().like(User::getPhone, keyword))
                .orderByDesc(User::getId);

        Page<User> page = userMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (User user : page.getRecords()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(user.getId()));
            item.put("username", user.getUsername());
            item.put("realName", user.getRealName());
            item.put("nickName", user.getNickName());
            item.put("phone", user.getPhone());
            item.put("email", user.getEmail());
            item.put("orgId", user.getOrgId() == null ? null : String.valueOf(user.getOrgId()));
            item.put("userStatus", user.getUserStatus());
            item.put("realNameStatus", user.getRealNameStatus());
            item.put("status", user.getStatus());
            item.put("roleNames", userMapper.selectRoleNamesByUserId(user.getId()));
            rows.add(item);
        }
        return ApiResponse.success(PageResult.success(rows, page.getTotal(), pageNum, pageSize));
    }

    /** 本主体商品（SPU）分页。 */
    @GetMapping("/products")
    public ApiResponse<PageResult<ProductVO>> products(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        String tenantId = requireTenant();
        int offset = (pageNum - 1) * pageSize;
        List<ProductVO> list = productMapper.selectAdminProductList(
                offset, pageSize, keyword, keyword, null, null, null, tenantId);
        long total = productMapper.countAdminProductList(keyword, keyword, null, null, null, tenantId);
        return ApiResponse.success(PageResult.success(list, total, pageNum, pageSize));
    }

    /** 本主体的部门（可按组织过滤；orgId 必须属于当前主体）。 */
    @GetMapping("/depts")
    public ApiResponse<List<Map<String, Object>>> depts(@RequestParam(required = false) String orgId) {
        String tenantId = requireTenant();
        if (orgId != null && !orgId.isBlank()) {
            requireOrgInTenant(orgId, tenantId);
        }
        List<Department> rows = departmentMapper.selectList(new LambdaQueryWrapper<Department>()
                .eq(Department::getTenantId, tenantId)
                .eq(orgId != null && !orgId.isBlank(), Department::getOrgId, orgId)
                .orderByAsc(Department::getParentDeptId));
        List<Map<String, Object>> list = new ArrayList<>();
        for (Department dept : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            // id 用数据库数字主键：岗位表 dept_id 是 BIGINT，拿字符串 dept_id 去查岗位会类型不匹配
            item.put("id", dept.getId() == null ? null : String.valueOf(dept.getId()));
            item.put("deptId", dept.getDeptId());
            item.put("deptCode", dept.getDeptCode());
            item.put("deptName", dept.getDeptName());
            item.put("parentDeptId", dept.getParentDeptId());
            item.put("orgId", dept.getOrgId());
            item.put("manager", dept.getDeptManager());
            item.put("contactPhone", dept.getContactPhone());
            item.put("deptCount", dept.getDeptCount());
            item.put("status", dept.getStatus());
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /** 部门下的岗位（deptId 必须属于当前主体）。 */
    @GetMapping("/positions")
    public ApiResponse<List<Map<String, Object>>> positions(@RequestParam String deptId) {
        String tenantId = requireTenant();
        // deptId 传的是部门表的数字主键（岗位表 dept_id 为 BIGINT）；
        // 用 wrapper 按 id 查，避免 @TableId(dept_id) 把 selectById 解释成字符串主键
        List<Department> matched = departmentMapper.selectList(new LambdaQueryWrapper<Department>()
                .eq(Department::getId, deptId)
                .eq(Department::getTenantId, tenantId));
        if (matched.isEmpty()) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "该部门不属于当前主体");
        }
        List<Position> rows = positionMapper.selectList(new LambdaQueryWrapper<Position>()
                .eq(Position::getTenantId, tenantId)
                .eq(Position::getDeptId, deptId)
                .orderByAsc(Position::getPositionLevel));
        List<Map<String, Object>> list = new ArrayList<>();
        for (Position position : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", position.getPositionId());
            item.put("positionCode", position.getPositionCode());
            item.put("positionName", position.getPositionName());
            item.put("deptId", position.getDeptId());
            item.put("positionLevel", position.getPositionLevel());
            item.put("positionDesc", position.getPositionDesc());
            item.put("incumbentCount", position.getIncumbentCount());
            item.put("status", position.getStatus());
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /** 当前主体可见的角色：平台共享角色（tenant 为空）+ 本主体自定义角色。 */
    @GetMapping("/roles")
    public ApiResponse<List<Map<String, Object>>> roles() {
        String tenantId = requireTenant();
        List<Role> rows = roleMapper.selectList(new LambdaQueryWrapper<Role>()
                .and(w -> w.isNull(Role::getTenantId).or().eq(Role::getTenantId, "").or().eq(Role::getTenantId, tenantId))
                .and(w -> w.isNull(Role::getDelFlag).or().eq(Role::getDelFlag, 0))
                .orderByAsc(Role::getRoleLevel));
        List<Map<String, Object>> list = new ArrayList<>();
        for (Role role : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", role.getId() == null ? null : String.valueOf(role.getId()));
            item.put("roleCode", role.getRoleCode());
            item.put("roleName", role.getRoleName());
            item.put("roleType", role.getRoleType());
            item.put("roleLevel", role.getRoleLevel());
            item.put("dataScope", role.getDataScope());
            item.put("status", role.getStatus());
            item.put("isSystem", role.getIsSystem());
            item.put("tenantId", role.getTenantId());
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /** 品类：平台共享分类 + 本主体自定义分类。 */
    @GetMapping("/categories")
    public ApiResponse<List<Map<String, Object>>> categories() {
        String tenantId = requireTenant();
        List<ProductCategory> rows = productCategoryMapper.selectList(new LambdaQueryWrapper<ProductCategory>()
                .eq(ProductCategory::getDelFlag, 0)
                .and(w -> w.isNull(ProductCategory::getTenantId).or().eq(ProductCategory::getTenantId, "")
                        .or().eq(ProductCategory::getTenantId, tenantId))
                .orderByAsc(ProductCategory::getOrderNum));
        List<Map<String, Object>> list = new ArrayList<>();
        for (ProductCategory category : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", category.getId());
            item.put("categoryCode", category.getCategoryCode());
            item.put("categoryName", category.getCategoryName());
            item.put("parentId", category.getParentId());
            item.put("level", category.getAncestors() == null ? 1 : category.getAncestors().split(",").length);
            item.put("status", category.getStatus());
            item.put("tenantId", category.getTenantId());
            item.put("custom", tenantId.equals(category.getTenantId()));
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /** 主数据属性（品类级公共数据，按品类过滤）。 */
    @GetMapping("/relations")
    public ApiResponse<List<Map<String, Object>>> relations() {
        String tenantId = requireTenant();
        List<CustomerSupplierRelation> rows = relationMapper.selectList(
                new LambdaQueryWrapper<CustomerSupplierRelation>()
                        .eq(CustomerSupplierRelation::getTenantId, tenantId)
                        .orderByDesc(CustomerSupplierRelation::getTotalAmount)
                        .last("LIMIT 200"));

        Map<String, String> customerNames = new HashMap<>();
        customerMapper.selectCustomerList(tenantId).forEach(c -> customerNames.put(String.valueOf(c.getId()), c.getCustomerName()));
        Map<String, String> supplierNames = new HashMap<>();
        supplierMapper.selectSupplierList(tenantId).forEach(s -> supplierNames.put(String.valueOf(s.getId()), s.getSupplierName()));

        List<Map<String, Object>> list = new ArrayList<>();
        for (CustomerSupplierRelation relation : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", relation.getRelationId());
            item.put("customerId", relation.getCustomerId());
            item.put("customerName", customerNames.getOrDefault(relation.getCustomerId(), relation.getCustomerId()));
            item.put("supplierId", relation.getSupplierId());
            item.put("supplierName", supplierNames.getOrDefault(relation.getSupplierId(), relation.getSupplierId()));
            item.put("relationType", relation.getRelationType());
            item.put("cooperationLevel", relation.getCooperationLevel());
            item.put("transactionCount", relation.getTransactionCount());
            item.put("totalAmount", relation.getTotalAmount());
            item.put("status", relation.getStatus());
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /** 本主体的操作记录（后端写操作留痕，按主体过滤）。 */
    @GetMapping("/operation-logs")
    public ApiResponse<PageResult<Map<String, Object>>> operationLogs(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "20") Integer pageSize,
            @RequestParam(required = false) String operationType) {
        String tenantId = requireTenant();
        Page<OperationLog> page = operationLogMapper.selectPage(new Page<>(pageNum, pageSize),
                new LambdaQueryWrapper<OperationLog>()
                        .eq(OperationLog::getTenantId, tenantId)
                        .eq(operationType != null && !operationType.isBlank(), OperationLog::getOperationType, operationType)
                        .orderByDesc(OperationLog::getCreateTime));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (OperationLog log : page.getRecords()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(log.getId()));
            item.put("module", log.getModule());
            item.put("operationType", log.getOperationType());
            item.put("operationDesc", log.getOperationDesc());
            item.put("targetId", log.getTargetId());
            // 前端据此把"delete /api/user/customers/123"翻译成「删除客户档案」，
            // 不把类名和 HTTP 方法直接摆给用户看
            item.put("requestUri", log.getRequestUri());
            item.put("operator", log.getOperator());
            item.put("ipAddress", log.getIpAddress());
            item.put("result", log.getResult());
            item.put("createTime", log.getCreateTime());
            rows.add(item);
        }
        return ApiResponse.success(PageResult.success(rows, page.getTotal(), pageNum, pageSize));
    }

    /** 本主体概览与用量计数（套餐额度在订阅计费侧，本接口只给真实计数）。 */
    @GetMapping("/tenant-summary")
    public ApiResponse<Map<String, Object>> tenantSummary() {
        String tenantId = requireTenant();
        long orgCount = organizationMapper.selectCount(new LambdaQueryWrapper<Organization>()
                .eq(Organization::getTenantId, tenantId)
                .eq(Organization::getDelFlag, 0));
        long memberCount = userMapper.selectCount(new LambdaQueryWrapper<User>()
                .eq(User::getTenantId, tenantId)
                .eq(User::getDelFlag, 0));
        long productCount = productMapper.countAdminProductList(null, null, null, null, null, tenantId);
        long customerCount = customerMapper.selectList(new LambdaQueryWrapper<com.agri.masterdata.entity.Customer>()
                .eq(com.agri.masterdata.entity.Customer::getTenantId, tenantId)
                .eq(com.agri.masterdata.entity.Customer::getDelFlag, 0)).size();
        long supplierCount = supplierMapper.selectList(new LambdaQueryWrapper<com.agri.masterdata.entity.Supplier>()
                .eq(com.agri.masterdata.entity.Supplier::getTenantId, tenantId)
                .eq(com.agri.masterdata.entity.Supplier::getDelFlag, 0)).size();

        Map<String, Object> view = new LinkedHashMap<>();
        view.put("merchantId", tenantId);
        view.put("orgCount", orgCount);
        view.put("memberCount", memberCount);
        view.put("productCount", productCount);
        view.put("customerCount", customerCount);
        view.put("supplierCount", supplierCount);
        return ApiResponse.success(view);
    }

    /**
     * 用户端可见的平台公告：已发布且未到期。平台级数据，不按主体过滤，但必须登录。
     *
     * <p>查询与出参形状都在 {@link AnnouncementService#publishedViews(Integer)} 一处，
     * 官网门户的公告块读的是同一份，不会再出现两端口径不一致。</p>
     */
    @GetMapping("/announcements")
    public ApiResponse<List<Map<String, Object>>> announcements(@RequestParam(defaultValue = "20") Integer limit) {
        if (SecurityUtils.getUserId() == null) {
            throw new BusinessException(ErrorCode.USER_NOT_LOGIN);
        }
        return ApiResponse.success(announcementService.publishedViews(limit));
    }

    /** 没有主体上下文时直接拒绝，绝不退化成"查全量"。 */
    /* ==================== 成员任职档案（账号在主体内的组织位置） ==================== */

    /**
     * 本主体全部成员任职档案。
     *
     * <p>只返回「账号 → 组织/部门/岗位」的映射，<b>不含用户名与手机号</b> ——
     * 那些以用户中心为准，前端拿成员列表与本结果按 {@code platformUserId} 连接。
     * 不冗余账号信息，账号改名后这里也不会过期。</p>
     */
    @GetMapping("/member-profiles")
    public ApiResponse<List<Map<String, Object>>> memberProfiles() {
        String tenantId = requireTenant();
        List<MemberProfile> profiles = memberProfileMapper.selectList(
                new LambdaQueryWrapper<MemberProfile>()
                        .eq(MemberProfile::getTenantId, tenantId)
                        .orderByAsc(MemberProfile::getId));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (MemberProfile profile : profiles) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("platformUserId", String.valueOf(profile.getPlatformUserId()));
            row.put("orgId", profile.getOrgId());
            row.put("deptId", profile.getDeptId());
            row.put("positionId", profile.getPositionId());
            // 名称回查：前端拿到的是字符串 ID，展示需要人看得懂的名字
            row.put("orgName", orgNameOf(profile.getOrgId()));
            row.put("deptName", deptNameOf(profile.getDeptId()));
            row.put("positionName", positionNameOf(profile.getPositionId()));
            row.put("jobStatus", profile.getJobStatus());
            row.put("updateTime", profile.getUpdateTime() == null
                    ? null : profile.getUpdateTime().toString());
            rows.add(row);
        }
        return ApiResponse.success(rows);
    }

    /**
     * 给成员分配组织 / 部门 / 岗位（没有档案则新建）。
     *
     * <p><b>关于 platformUserId 的信任边界</b>：主数据库看不到认证库的
     * {@code platform_user_merchant}，无法校验这个账号是否真属于本主体。靠三层兜住：</p>
     * <ol>
     *   <li>记录按 tenant 隔离，不同主体各存一份，互相看不到；</li>
     *   <li>组织/部门/岗位必须属于本主体（下面逐一校验）—— 这条最要紧，
     *       否则企业能把员工挂到别家的部门下；</li>
     *   <li>展示时以用户中心成员列表为主表左连接，孤儿记录（platformUserId 不在成员里）
     *       自然显示不出来。</li>
     * </ol>
     * <p>所以即使有人塞一个伪造的 platformUserId，最多给自己主体留一条显示不出来的空记录。</p>
     */
    @PutMapping("/member-profiles/{platformUserId}")
    public ApiResponse<Map<String, Object>> saveMemberProfile(
            @PathVariable String platformUserId,
            @RequestBody MemberProfileRequest body) {
        String tenantId = requireTenant();
        if (body == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请求体不能为空");
        }
        long userId;
        try {
            userId = Long.parseLong(platformUserId.trim());
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "账号 ID 不合法");
        }

        String orgId = trimOrNull(body.orgId());
        String deptId = trimOrNull(body.deptId());
        String positionId = trimOrNull(body.positionId());
        // 三个都空等于"清空任职"，那是 DELETE 的语义。
        // 不拦的话，前端漏传字段就会静默把人的部门岗位抹掉，而且接口还返回成功。
        if (orgId == null && deptId == null && positionId == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR,
                    "组织、部门、岗位至少填写一项；如需清除任职信息请使用删除操作");
        }

        Department dept = null;
        if (deptId != null) {
            dept = requireOwnedDept(deptId, tenantId);
            if (orgId == null) {
                // 只选了部门没选组织：按部门的所属组织补齐，避免"有部门没组织"的断链
                orgId = dept.getOrgId();
            }
        }
        if (orgId != null) {
            requireOrgInTenant(orgId, tenantId);
        }
        if (positionId != null) {
            Position position = requireOwnedPosition(positionId, tenantId);
            // 岗位挂在部门下：同时选了部门时必须对得上，
            // 否则会出现"在质检部任职、岗位却属于仓储部"这种自相矛盾的档案
            if (dept != null && position.getDeptId() != null
                    && !position.getDeptId().equals(String.valueOf(dept.getId()))) {
                throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR,
                        "所选岗位不属于所选部门，请重新选择");
            }
            if (deptId == null && position.getDeptId() != null) {
                // 只选了岗位：把部门一并补齐
                deptId = position.getDeptId();
            }
        }

        MemberProfile existing = memberProfileMapper.selectOne(
                new LambdaQueryWrapper<MemberProfile>()
                        .eq(MemberProfile::getTenantId, tenantId)
                        .eq(MemberProfile::getPlatformUserId, userId)
                        .last("LIMIT 1"));
        boolean created = existing == null;
        MemberProfile profile = created ? new MemberProfile() : existing;
        profile.setTenantId(tenantId);
        profile.setPlatformUserId(userId);
        profile.setOrgId(orgId);
        profile.setDeptId(deptId);
        profile.setPositionId(positionId);
        profile.setJobStatus(body.jobStatus() == null || body.jobStatus().isBlank()
                ? "active" : body.jobStatus().trim());
        LocalDateTime now = LocalDateTime.now();
        profile.setUpdateTime(now);
        if (created) {
            profile.setCreateTime(now);
            memberProfileMapper.insert(profile);
        } else {
            memberProfileMapper.updateById(profile);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("platformUserId", String.valueOf(userId));
        result.put("created", created);
        result.put("orgId", orgId);
        result.put("deptId", deptId);
        result.put("positionId", positionId);
        return ApiResponse.success(result);
    }

    /** 清除成员任职档案（成员离开组织，或分配错了要重来）。 */
    @DeleteMapping("/member-profiles/{platformUserId}")
    public ApiResponse<Void> deleteMemberProfile(@PathVariable String platformUserId) {
        String tenantId = requireTenant();
        long userId;
        try {
            userId = Long.parseLong(platformUserId.trim());
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "账号 ID 不合法");
        }
        memberProfileMapper.delete(new LambdaQueryWrapper<MemberProfile>()
                .eq(MemberProfile::getTenantId, tenantId)
                .eq(MemberProfile::getPlatformUserId, userId));
        return ApiResponse.success();
    }

    /** 任职档案入参。ID 全部用字符串 —— 雪花 ID 超出 JS 安全整数范围，传数字会被静默截断。 */
    public record MemberProfileRequest(String orgId, String deptId, String positionId,
                                       String jobStatus) {
    }

    /* ---------- 位置名称回查：三张表主键类型不同，各按自己的方式查 ---------- */

    private String orgNameOf(String orgId) {
        if (orgId == null || orgId.isBlank()) {
            return null;
        }
        try {
            Organization org = organizationMapper.selectById(Long.parseLong(orgId));
            return org == null ? null : org.getOrgName();
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String deptNameOf(String deptId) {
        if (deptId == null || deptId.isBlank()) {
            return null;
        }
        try {
            // Department 的 @TableId 是 dept_id（varchar 业务码），按真正主键查必须用 wrapper
            Department dept = departmentMapper.selectOne(new LambdaQueryWrapper<Department>()
                    .eq(Department::getId, Long.parseLong(deptId))
                    .last("LIMIT 1"));
            return dept == null ? null : dept.getDeptName();
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String positionNameOf(String positionId) {
        if (positionId == null || positionId.isBlank()) {
            return null;
        }
        // Position 的 @TableId 就是 position_id，可以直接 selectById
        Position position = positionMapper.selectById(positionId);
        return position == null ? null : position.getPositionName();
    }

    /* ==================== 组织 / 部门 / 岗位 / 角色（主数据职责，可落库） ==================== */

    /**
     * 新增组织节点。
     *
     * <p>编码、层级、路径由服务端算：让前端传 {@code orgCode} 必然重号，
     * 让前端算 {@code orgLevel/orgPath} 必然和父节点对不上。</p>
     */
    @PostMapping("/orgs")
    public ApiResponse<Map<String, Object>> createOrg(@RequestBody OrgSaveRequest body) {
        String tenantId = requireTenant();
        if (body == null || body.orgName() == null || body.orgName().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请填写组织名称");
        }
        Organization parent = null;
        if (body.parentId() != null && !body.parentId().isBlank() && !"0".equals(body.parentId())) {
            // 用 String 接：雪花 ID 超出 JS 安全整数范围，前端传数字会被静默截断
            long parentId;
            try {
                parentId = Long.parseLong(body.parentId().trim());
            } catch (NumberFormatException e) {
                throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "上级组织 ID 不合法");
            }
            parent = requireOwnedOrg(parentId, tenantId);
        }
        Organization org = Organization.builder()
                .orgCode(nextCode("agri_md_organization", "org_code", "ORG" + tenantId + "-", tenantId, 3))
                .orgName(body.orgName().trim())
                .orgType(body.orgType() == null || body.orgType().isBlank() ? "ENTERPRISE" : body.orgType())
                .parentId(parent == null ? 0L : parent.getId())
                .orgLevel(parent == null ? 1 : (parent.getOrgLevel() == null ? 1 : parent.getOrgLevel()) + 1)
                .contactPerson(trimOrNull(body.contactPerson()))
                .contactPhone(trimOrNull(body.contactPhone()))
                .address(trimOrNull(body.address()))
                .intro(trimOrNull(body.intro()))
                .authStatus("unverified")
                .status(1)
                .delFlag(0)
                .tenantId(tenantId)
                .build();
        organizationMapper.insert(org);
        // 路径依赖主键，插入后再回写一次
        org.setOrgPath(parent == null
                ? String.valueOf(org.getId())
                : (parent.getOrgPath() == null ? String.valueOf(parent.getId()) : parent.getOrgPath())
                        + "/" + org.getId());
        org.setAncestors(parent == null ? "0" : (parent.getAncestors() == null ? "0" : parent.getAncestors())
                + "," + parent.getId());
        organizationMapper.updateById(org);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(org.getId()));
        result.put("orgCode", org.getOrgCode());
        return ApiResponse.success(result);
    }

    /** 新增部门（orgId 必须属于当前主体）。 */
    @PostMapping("/depts")
    public ApiResponse<Map<String, Object>> createDept(@RequestBody DeptSaveRequest body) {
        String tenantId = requireTenant();
        if (body == null || body.deptName() == null || body.deptName().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请填写部门名称");
        }
        if (body.orgId() == null || body.orgId().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请选择所属组织");
        }
        requireOrgInTenant(body.orgId(), tenantId);
        // 主键 dept_id 由 MyBatis（ASSIGN_ID）生成，这里不手填 —— 手填会绕过框架的 ID 策略
        Department dept = new Department();
        dept.setDeptCode(nextCode("agri_md_department", "dept_code", "DEPT" + tenantId + "-", null, 2));
        dept.setDeptName(body.deptName().trim());
        dept.setOrgId(body.orgId());
        dept.setParentDeptId(trimOrNull(body.parentDeptId()));
        dept.setDeptManager(trimOrNull(body.deptManager()));
        dept.setContactPhone(trimOrNull(body.contactPhone()));
        dept.setDeptCount(0);
        dept.setStatus("1");
        departmentMapper.insert(dept);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", dept.getDeptId());
        result.put("deptCode", dept.getDeptCode());
        return ApiResponse.success(result);
    }

    /** 编辑部门（归属校验：部门所属组织必须是当前主体的）。 */
    @PutMapping("/depts/{id}")
    public ApiResponse<Void> updateDept(@PathVariable String id, @RequestBody DeptSaveRequest body) {
        String tenantId = requireTenant();
        Department dept = requireOwnedDept(id, tenantId);
        if (body == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请求体不能为空");
        }
        if (body.deptName() != null && !body.deptName().isBlank()) dept.setDeptName(body.deptName().trim());
        if (body.deptManager() != null) dept.setDeptManager(trimOrNull(body.deptManager()));
        if (body.contactPhone() != null) dept.setContactPhone(trimOrNull(body.contactPhone()));
        if (body.parentDeptId() != null) dept.setParentDeptId(trimOrNull(body.parentDeptId()));
        departmentMapper.updateById(dept);
        return ApiResponse.success();
    }

    /** 新增岗位（deptId 必须属于当前主体）。 */
    @PostMapping("/positions")
    public ApiResponse<Map<String, Object>> createPosition(@RequestBody PositionSaveRequest body) {
        String tenantId = requireTenant();
        if (body == null || body.positionName() == null || body.positionName().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请填写岗位名称");
        }
        if (body.deptId() == null || body.deptId().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请选择所属部门");
        }
        requireOwnedDept(body.deptId(), tenantId);
        Position position = new Position();
        String posCode = nextCode("agri_md_position", "position_code", "POS-P-", null, 2);
        position.setPositionCode(posCode);
        // 旧列同步：pos_code 是 NOT NULL + 唯一约束，只填新列会插入失败
        position.setPosCode(posCode);
        position.setPositionName(body.positionName().trim());
        position.setPosName(body.positionName().trim());
        position.setDeptId(body.deptId());
        position.setPositionLevel(body.positionLevel() == null ? 1 : body.positionLevel());
        position.setPositionDesc(trimOrNull(body.positionDesc()));
        position.setIncumbentCount(0);
        position.setStatus("1");
        positionMapper.insert(position);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", position.getPositionId());
        result.put("positionCode", position.getPositionCode());
        return ApiResponse.success(result);
    }

    /** 编辑岗位（归属校验同上）。 */
    @PutMapping("/positions/{id}")
    public ApiResponse<Void> updatePosition(@PathVariable String id, @RequestBody PositionSaveRequest body) {
        String tenantId = requireTenant();
        Position position = requireOwnedPosition(id, tenantId);
        if (body == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请求体不能为空");
        }
        if (body.positionName() != null && !body.positionName().isBlank()) {
            position.setPositionName(body.positionName().trim());
        }
        if (body.positionLevel() != null) position.setPositionLevel(body.positionLevel());
        if (body.positionDesc() != null) position.setPositionDesc(trimOrNull(body.positionDesc()));
        positionMapper.updateById(position);
        return ApiResponse.success();
    }

    /**
     * 新增业务角色。
     *
     * <p>tenantId 强制当前主体；{@code roleCode} 允许前端填（要唯一），不填则自动生成。
     * 全局角色（tenantId 为空）不允许在这里改 —— 那是平台级配置。</p>
     */
    @PostMapping("/roles")
    public ApiResponse<Map<String, Object>> createRole(@RequestBody RoleSaveRequest body) {
        String tenantId = requireTenant();
        if (body == null || body.roleName() == null || body.roleName().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请填写角色名称");
        }
        String code = body.roleCode() == null || body.roleCode().isBlank()
                ? nextCode("agri_md_role", "role_code", "ROLE" + tenantId + "-", tenantId, 2)
                : body.roleCode().trim().toUpperCase();
        Long exists = roleMapper.selectCount(new LambdaQueryWrapper<Role>()
                .eq(Role::getRoleCode, code));
        if (exists != null && exists > 0) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "角色编码已存在：" + code);
        }
        Role role = Role.builder()
                .roleCode(code)
                .roleName(body.roleName().trim())
                .roleKey(body.roleKey() == null || body.roleKey().isBlank() ? code.toLowerCase() : body.roleKey().trim())
                .roleType("business")
                .description(trimOrNull(body.description()))
                .roleLevel(body.roleLevel() == null ? 9 : body.roleLevel())
                .dataScope(body.dataScope() == null || body.dataScope().isBlank() ? "self" : body.dataScope())
                .roleStatus("1")
                .isSystem(0)
                .sortOrder(0)
                .status(1)
                .delFlag(0)
                .tenantId(tenantId)
                .build();
        roleMapper.insert(role);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(role.getId()));
        result.put("roleCode", role.getRoleCode());
        return ApiResponse.success(result);
    }

    /** 编辑业务角色（全局角色与别家角色一律拒绝）。 */
    @PutMapping("/roles/{id}")
    public ApiResponse<Void> updateRole(@PathVariable Long id, @RequestBody RoleSaveRequest body) {
        String tenantId = requireTenant();
        Role role = roleMapper.selectById(id);
        if (role == null || role.getTenantId() == null || !tenantId.equals(role.getTenantId())) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "角色不存在或不属于当前主体");
        }
        if (role.getIsSystem() != null && role.getIsSystem() == 1) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "系统内置角色不允许修改");
        }
        if (body == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请求体不能为空");
        }
        if (body.roleName() != null && !body.roleName().isBlank()) role.setRoleName(body.roleName().trim());
        if (body.description() != null) role.setDescription(trimOrNull(body.description()));
        if (body.dataScope() != null && !body.dataScope().isBlank()) role.setDataScope(body.dataScope());
        if (body.roleLevel() != null) role.setRoleLevel(body.roleLevel());
        roleMapper.updateById(role);
        return ApiResponse.success();
    }

    /* ==================== 组织级角色：成员与权限（租户管理员在本主体内维护） ==================== */

    /**
     * 删除本主体自定义角色。
     *
     * <p>系统内置角色、别家角色一律拒绝；角色下仍有成员时明确阻断 ——
     * 直接删会留下指向不存在角色的 {@code agri_md_user_role} 脏关联。</p>
     *
     * <p>必须用 {@code deleteById}：全局配置了 {@code logic-delete-field: delFlag}，
     * 该字段由 MyBatis-Plus 接管，{@code setDelFlag(1) + updateById} 会被跳过 ——
     * 接口返回 200 而记录仍在（静默失败）。</p>
     */
    @DeleteMapping("/roles/{id}")
    public ApiResponse<Void> deleteRole(@PathVariable Long id) {
        String tenantId = requireTenant();
        Role role = requireOwnedRole(id, tenantId);
        if (role.getIsSystem() != null && role.getIsSystem() == 1) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "系统内置角色不允许删除");
        }
        Long members = userRoleMapper.selectCount(new LambdaQueryWrapper<UserRole>()
                .eq(UserRole::getRoleId, id));
        if (members != null && members > 0) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR,
                    "角色下仍有 " + members + " 名成员，请先移出成员再删除");
        }
        roleMapper.deleteById(id);
        rolePermissionMapper.delete(new LambdaQueryWrapper<RolePermission>()
                .eq(RolePermission::getRoleId, id));
        return ApiResponse.success();
    }

    /** 角色成员（只返回仍属于当前主体的账号，跨租户的一律不展示）。 */
    @GetMapping("/roles/{id}/members")
    public ApiResponse<List<Map<String, Object>>> roleMembers(@PathVariable Long id) {
        String tenantId = requireTenant();
        requireOwnedRole(id, tenantId);
        List<UserRole> links = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>()
                .eq(UserRole::getRoleId, id));
        if (links.isEmpty()) {
            return ApiResponse.success(Collections.emptyList());
        }
        List<Long> userIds = links.stream().map(UserRole::getUserId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        if (userIds.isEmpty()) {
            return ApiResponse.success(Collections.emptyList());
        }
        List<User> users = userMapper.selectList(new LambdaQueryWrapper<User>()
                .in(User::getId, userIds)
                .eq(User::getTenantId, tenantId)
                .and(w -> w.isNull(User::getDelFlag).or().eq(User::getDelFlag, 0)));
        List<Map<String, Object>> list = new ArrayList<>();
        for (User user : users) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("userId", String.valueOf(user.getId()));
            item.put("username", user.getUsername());
            item.put("realName", user.getRealName());
            item.put("phone", user.getPhone());
            item.put("userStatus", user.getUserStatus());
            list.add(item);
        }
        return ApiResponse.success(list);
    }

    /**
     * 把本主体账号加入角色。
     *
     * <p>成员必须是当前主体的账号：传别家的 userId 直接 403，而不是静默跳过 ——
     * 静默跳过会让调用方以为加成功了。</p>
     */
    @PostMapping("/roles/{id}/members")
    public ApiResponse<Void> addRoleMembers(@PathVariable Long id, @RequestBody RoleMemberRequest body) {
        String tenantId = requireTenant();
        Role role = requireOwnedRole(id, tenantId);
        if (role.getIsSystem() != null && role.getIsSystem() == 1) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "系统内置角色的成员由平台维护");
        }
        List<Long> userIds = body == null || body.userIds() == null ? Collections.emptyList()
                : body.userIds().stream().filter(Objects::nonNull).distinct().collect(Collectors.toList());
        if (userIds.isEmpty()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请选择要加入角色的成员");
        }
        List<User> users = userMapper.selectList(new LambdaQueryWrapper<User>()
                .in(User::getId, userIds)
                .eq(User::getTenantId, tenantId)
                .and(w -> w.isNull(User::getDelFlag).or().eq(User::getDelFlag, 0)));
        if (users.size() != userIds.size()) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN,
                    "有 " + (userIds.size() - users.size()) + " 个账号不属于当前主体，不能加入本主体角色");
        }
        Set<Long> exists = userRoleMapper.selectList(new LambdaQueryWrapper<UserRole>()
                        .eq(UserRole::getRoleId, id))
                .stream().map(UserRole::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        for (Long userId : userIds) {
            if (exists.contains(userId)) {
                continue;
            }
            UserRole link = new UserRole();
            link.setUserId(userId);
            link.setRoleId(id);
            link.setTenantId(tenantId);
            userRoleMapper.insert(link);
        }
        return ApiResponse.success();
    }

    /** 把成员移出角色（只允许动本主体角色）。 */
    @DeleteMapping("/roles/{id}/members/{userId}")
    public ApiResponse<Void> removeRoleMember(@PathVariable Long id, @PathVariable Long userId) {
        String tenantId = requireTenant();
        requireOwnedRole(id, tenantId);
        userRoleMapper.delete(new LambdaQueryWrapper<UserRole>()
                .eq(UserRole::getRoleId, id)
                .eq(UserRole::getUserId, userId));
        return ApiResponse.success();
    }

    /**
     * 本主体「可授予」的权限点。
     *
     * <p>口径：平台共享角色（tenant 为空）已持有的点 ∪ 本主体现有角色已持有的点 ∪
     * 运营端已批准给本主体的授权申请点。三者都是"平台已经放到这个主体里"的权限，
     * 租户管理员只能在集合内分配，<b>不能借此自行扩权</b>。</p>
     */
    @GetMapping("/roles/grantable-permissions")
    public ApiResponse<List<PermissionVO>> grantablePermissions() {
        String tenantId = requireTenant();
        Set<Long> allowed = grantablePermIds(tenantId);
        if (allowed.isEmpty()) {
            return ApiResponse.success(Collections.emptyList());
        }
        List<PermissionVO> points = permissionService.listPoints(null, null);
        List<PermissionVO> list = points.stream()
                .filter(point -> point.getId() != null && allowed.contains(Long.valueOf(point.getId())))
                .collect(Collectors.toList());
        return ApiResponse.success(list);
    }

    /** 角色已持有的权限点 ID（与 grantable-permissions 同口径）。 */
    @GetMapping("/roles/{id}/permissions")
    public ApiResponse<List<String>> rolePermissions(@PathVariable Long id) {
        String tenantId = requireTenant();
        requireOwnedRole(id, tenantId);
        return ApiResponse.success(permissionService.pointIdsOfRole(id));
    }

    /**
     * 覆盖写入角色权限点。
     *
     * <p>越权尝试必须显式失败：请求里只要有一个点不在「可授予集合」内，整单 403 并列出编码，
     * 不做"能写的写、不能写的悄悄丢掉"。</p>
     */
    @PutMapping("/roles/{id}/permissions")
    public ApiResponse<Void> assignRolePermissions(@PathVariable Long id,
                                                   @RequestBody RolePermRequest body) {
        String tenantId = requireTenant();
        Role role = requireOwnedRole(id, tenantId);
        if (role.getIsSystem() != null && role.getIsSystem() == 1) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "系统内置角色的权限由平台维护");
        }
        List<String> permIds = body == null || body.permIds() == null ? Collections.emptyList()
                : body.permIds().stream().filter(Objects::nonNull).map(String::trim)
                .filter(item -> !item.isEmpty()).distinct().collect(Collectors.toList());
        List<Long> parsed = new ArrayList<>();
        for (String permId : permIds) {
            try {
                parsed.add(Long.valueOf(permId));
            } catch (NumberFormatException ex) {
                throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "权限点参数不合法：" + permId);
            }
        }
        Set<Long> allowed = grantablePermIds(tenantId);
        List<Permission> requested = parsed.isEmpty() ? Collections.emptyList()
                : permissionMapper.selectList(new LambdaQueryWrapper<Permission>().in(Permission::getId, parsed));
        if (requested.size() != parsed.size()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR,
                    "有 " + (parsed.size() - requested.size()) + " 个权限点不在目录里，请先同步端点目录");
        }
        List<String> denied = requested.stream()
                .filter(point -> !allowed.contains(point.getId()))
                .map(Permission::getPermCode).collect(Collectors.toList());
        if (!denied.isEmpty()) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN,
                    "以下权限点未被平台授予当前主体，不能分配给本主体角色：" + String.join("、", denied));
        }
        permissionService.assignRolePoints(id, permIds, SecurityUtils.getUsername());
        return ApiResponse.success();
    }

    /** 企业端角色成员入参 */
    public record RoleMemberRequest(List<Long> userIds) {
    }

    /** 企业端角色权限点入参 */
    public record RolePermRequest(List<String> permIds) {
    }

    /** 组织入参 */
    public record OrgSaveRequest(String orgName, String orgType, String parentId,
                                 String contactPerson, String contactPhone,
                                 String address, String intro) {
    }

    /** 部门入参 */
    public record DeptSaveRequest(String deptName, String orgId, String parentDeptId,
                                  String deptManager, String contactPhone) {
    }

    /** 岗位入参 */
    public record PositionSaveRequest(String positionName, String deptId, Integer positionLevel,
                                      String positionDesc) {
    }

    /** 角色入参 */
    public record RoleSaveRequest(String roleName, String roleCode, String roleKey,
                                  String description, String dataScope, Integer roleLevel) {
    }

    /* ---------- 归属校验 ---------- */

    private Organization requireOwnedOrg(Long id, String tenantId) {
        Organization org = organizationMapper.selectById(id);
        if (org == null || !tenantId.equals(org.getTenantId())) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "组织不存在或不属于当前主体");
        }
        return org;
    }

    /**
     * 按主键取部门并校验归属。
     *
     * <p>⚠️ 这里必须按 {@code id}（bigint 自增主键）查，不能 {@code selectById}：
     * `Department` 实体的 {@code @TableId} 指向的是 {@code dept_id}（varchar 业务编码，
     * 形如 {@code DEPT-2001-01}），而表里真正的主键是自增列 {@code id}。
     * 岗位表的 {@code dept_id} 是 bigint，指向的正是这个 {@code id} ——
     * 两张表的同名列类型与语义都不一样，按实体主键查会一直查不到。</p>
     */
    private Department requireOwnedDept(String id, String tenantId) {
        long pk;
        try {
            pk = Long.parseLong(id);
        } catch (NumberFormatException e) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "部门 ID 不合法");
        }
        Department dept = departmentMapper.selectOne(new LambdaQueryWrapper<Department>()
                .eq(Department::getId, pk)
                .last("LIMIT 1"));
        if (dept == null) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "部门不存在或不属于当前主体");
        }
        requireOrgInTenant(dept.getOrgId(), tenantId);
        return dept;
    }

    private Position requireOwnedPosition(String id, String tenantId) {
        Position position = positionMapper.selectById(id);
        if (position == null) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "岗位不存在或不属于当前主体");
        }
        requireOwnedDept(position.getDeptId(), tenantId);
        return position;
    }

    /**
     * 生成业务编码：{@code prefix + 补零序号}。
     *
     * <p>序号取同前缀已有最大值 +1（不是 count+1，删过记录会撞号）。
     * tenantId 为 null 时表示该表没有 tenant 维度（部门/岗位），直接按前缀全局取号。</p>
     */
    private String nextCode(String table, String column, String prefix, String tenantId, int width) {
        String where = " WHERE " + column + " LIKE '" + prefix + "%'";
        if (tenantId != null) {
            where += " AND tenant_id = '" + tenantId + "'";
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT " + column + " AS code FROM " + table + where);
        int max = 0;
        for (Map<String, Object> row : rows) {
            Object value = row.get("code");
            if (value == null) continue;
            String code = String.valueOf(value);
            int dash = code.lastIndexOf('-');
            if (dash < 0 || dash == code.length() - 1) continue;
            try {
                max = Math.max(max, Integer.parseInt(code.substring(dash + 1)));
            } catch (NumberFormatException ignored) {
                // 历史脏编码跳过
            }
        }
        return prefix + String.format("%0" + width + "d", max + 1);
    }

    /* ==================== 客户档案（企业自维护，可落库） ==================== */

    /**
     * 本主体客户档案分页。
     *
     * <p>只返回当前主体（tenant）下的未删除记录 —— 归属由服务端从主体上下文取，
     * 不接受前端传 tenantId。</p>
     */
    @GetMapping("/customers")
    public ApiResponse<PageResult<Map<String, Object>>> customers(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword) {
        String tenantId = requireTenant();
        LambdaQueryWrapper<Customer> wrapper = new LambdaQueryWrapper<Customer>()
                .eq(Customer::getTenantId, tenantId)
                .eq(Customer::getDelFlag, 0)
                .and(keyword != null && !keyword.isBlank(), w -> w
                        .like(Customer::getCustomerName, keyword)
                        .or().like(Customer::getCustomerCode, keyword)
                        .or().like(Customer::getContactName, keyword))
                .orderByDesc(Customer::getId);
        Page<Customer> page = customerMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Customer customer : page.getRecords()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(customer.getId()));
            item.put("customerCode", customer.getCustomerCode());
            item.put("customerName", customer.getCustomerName());
            item.put("shortName", customer.getShortName());
            item.put("customerType", customer.getCustomerType());
            item.put("contactName", customer.getContactName());
            item.put("contactPhone", customer.getContactPhone());
            item.put("address", customer.getAddress());
            item.put("creditCode", customer.getCreditCode());
            item.put("legalPerson", customer.getLegalPerson());
            item.put("level", customer.getLevel());
            item.put("status", customer.getStatus());
            item.put("remark", customer.getRemark());
            item.put("createTime", customer.getCreateTime() == null
                    ? null : customer.getCreateTime().toString());
            rows.add(item);
        }
        return ApiResponse.success(PageResult.success(rows, page.getTotal(), pageNum, pageSize));
    }

    /**
     * 新增客户档案。
     *
     * <p>三件事由服务端强制，前端传了也忽略：</p>
     * <ul>
     *   <li><b>tenant_id</b>：取当前主体。否则企业能往别人主体里塞客户。</li>
     *   <li><b>customer_code</b>：按 {@code CUS{主体}-{序号}} 自动生成。让前端手填编码，
     *       必然出现重号与"借用别家编码"。</li>
     *   <li><b>del_flag / status</b>：默认 0 / 1。</li>
     * </ul>
     */
    @PostMapping("/customers")
    public ApiResponse<Map<String, Object>> createCustomer(@RequestBody CustomerSaveRequest body) {
        String tenantId = requireTenant();
        if (body == null || body.customerName() == null || body.customerName().isBlank()) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请填写客户名称");
        }
        if (body.orgId() != null) {
            // 传了归属组织就必须是本主体的组织，防止挂到别家组织下
            requireOrgInTenant(String.valueOf(body.orgId()), tenantId);
        }
        Customer customer = Customer.builder()
                .customerCode(nextCustomerCode(tenantId))
                .customerName(body.customerName().trim())
                .shortName(trimOrNull(body.shortName()))
                .customerType(trimOrNull(body.customerType()))
                .contactName(trimOrNull(body.contactName()))
                .contactPhone(trimOrNull(body.contactPhone()))
                .address(trimOrNull(body.address()))
                .creditCode(trimOrNull(body.creditCode()))
                .legalPerson(trimOrNull(body.legalPerson()))
                .level(trimOrNull(body.level()))
                .remark(trimOrNull(body.remark()))
                .orgId(body.orgId())
                .status(1)
                .delFlag(0)
                .tenantId(tenantId)
                .build();
        customerMapper.insert(customer);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", String.valueOf(customer.getId()));
        result.put("customerCode", customer.getCustomerCode());
        result.put("tenantId", tenantId);
        return ApiResponse.success(result);
    }

    /** 编辑客户档案（校验归属：不是本主体的客户一律拒绝）。 */
    @PutMapping("/customers/{id}")
    public ApiResponse<Void> updateCustomer(@PathVariable Long id, @RequestBody CustomerSaveRequest body) {
        String tenantId = requireTenant();
        Customer customer = requireOwnedCustomer(id, tenantId);
        if (body == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请求体不能为空");
        }
        if (body.customerName() != null && !body.customerName().isBlank()) {
            customer.setCustomerName(body.customerName().trim());
        }
        if (body.shortName() != null) customer.setShortName(trimOrNull(body.shortName()));
        if (body.customerType() != null) customer.setCustomerType(trimOrNull(body.customerType()));
        if (body.contactName() != null) customer.setContactName(trimOrNull(body.contactName()));
        if (body.contactPhone() != null) customer.setContactPhone(trimOrNull(body.contactPhone()));
        if (body.address() != null) customer.setAddress(trimOrNull(body.address()));
        if (body.creditCode() != null) customer.setCreditCode(trimOrNull(body.creditCode()));
        if (body.legalPerson() != null) customer.setLegalPerson(trimOrNull(body.legalPerson()));
        if (body.level() != null) customer.setLevel(trimOrNull(body.level()));
        if (body.remark() != null) customer.setRemark(trimOrNull(body.remark()));
        if (body.status() != null) customer.setStatus(body.status());
        // tenantId 不跟着改：客户归属一旦落定，编辑不该能把它搬到别的主体
        customerMapper.updateById(customer);
        return ApiResponse.success();
    }

    /**
     * 删除客户档案（逻辑删除，校验归属）。
     *
     * <p>必须用 {@code deleteById} 而不是 {@code setDelFlag(1) + updateById}：
     * 全局配置了 {@code logic-delete-field: delFlag}，该字段由 MyBatis-Plus 接管，
     * {@code updateById} 会**跳过它** —— 于是接口返回 200、记录却还在（静默失败）。
     * 这个问题只有直连数据库核对才会发现。</p>
     */
    @DeleteMapping("/customers/{id}")
    public ApiResponse<Void> deleteCustomer(@PathVariable Long id) {
        String tenantId = requireTenant();
        requireOwnedCustomer(id, tenantId);
        customerMapper.deleteById(id);
        return ApiResponse.success();
    }

    /* ==================== 主体联系信息（企业自维护） ==================== */

    /**
     * 更新本主体某个组织的联系信息。
     *
     * <p>只允许改联系类字段（联系人 / 电话 / 地址 / 简介）—— 组织名称、认证状态、
     * 信用代码这些属于认证信息，改它们要走审核，不能在企业端直接落库。</p>
     */
    @PutMapping("/orgs/{id}")
    public ApiResponse<Void> updateOrgContact(@PathVariable Long id,
                                              @RequestBody OrgContactRequest body) {
        String tenantId = requireTenant();
        List<Organization> owned = organizationMapper.selectOrgByTenantId(tenantId);
        Organization target = owned.stream()
                .filter(org -> id.equals(org.getId()))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.PERMISSION_FORBIDDEN,
                        "该组织不属于当前主体"));
        if (body == null) {
            throw new BusinessException(ErrorCode.PARAM_VALIDATE_ERROR, "请求体不能为空");
        }
        if (body.contactPerson() != null) target.setContactPerson(trimOrNull(body.contactPerson()));
        if (body.contactPhone() != null) target.setContactPhone(trimOrNull(body.contactPhone()));
        if (body.address() != null) target.setAddress(trimOrNull(body.address()));
        if (body.intro() != null) target.setIntro(trimOrNull(body.intro()));
        organizationMapper.updateById(target);
        return ApiResponse.success();
    }

    /** 客户档案入参（企业端） */
    public record CustomerSaveRequest(
            String customerName,
            String shortName,
            String customerType,
            String contactName,
            String contactPhone,
            String address,
            String creditCode,
            String legalPerson,
            String level,
            String remark,
            Long orgId,
            Integer status) {
    }

    /** 组织联系信息入参 */
    public record OrgContactRequest(String contactPerson, String contactPhone,
                                    String address, String intro) {
    }

    /**
     * 取本主体下的客户，否则拒绝。
     *
     * <p>不返回"客户不存在"和"无权访问"两种措辞 —— 统一说"客户不存在或不属于当前主体"，
     * 避免用返回文案探测别家客户是否存在。</p>
     */
    private Customer requireOwnedCustomer(Long id, String tenantId) {
        Customer customer = customerMapper.selectById(id);
        if (customer == null || customer.getDelFlag() != null && customer.getDelFlag() == 1
                || !tenantId.equals(customer.getTenantId())) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "客户不存在或不属于当前主体");
        }
        return customer;
    }

    /**
     * 生成客户编码：{@code CUS{主体}-{三位序号}}。
     *
     * <p>序号取本主体已有最大值 +1，而不是 count+1 —— 中间删过记录时 count 会撞号。</p>
     */
    private String nextCustomerCode(String tenantId) {
        List<Customer> existing = customerMapper.selectList(new LambdaQueryWrapper<Customer>()
                .eq(Customer::getTenantId, tenantId)
                .likeRight(Customer::getCustomerCode, "CUS" + tenantId + "-"));
        int max = 0;
        for (Customer customer : existing) {
            String code = customer.getCustomerCode();
            if (code == null) continue;
            int dash = code.lastIndexOf('-');
            if (dash < 0 || dash == code.length() - 1) continue;
            try {
                max = Math.max(max, Integer.parseInt(code.substring(dash + 1)));
            } catch (NumberFormatException ignored) {
                // 历史脏编码跳过，不因为它让整次新增失败
            }
        }
        return String.format("CUS%s-%03d", tenantId, max + 1);
    }

    private static String trimOrNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    /**
     * 角色必须是当前主体自己的、未删除的角色；平台共享角色（tenant 为空）也不允许在这里改。
     *
     * <p>这是组织级角色的租户边界：所有成员/权限写操作都先过这一关，
     * 换个 roleId 就只能撞 403，而不是按 id 直改别家的角色。</p>
     */
    private Role requireOwnedRole(Long roleId, String tenantId) {
        Role role = roleId == null ? null : roleMapper.selectById(roleId);
        boolean deleted = role != null && role.getDelFlag() != null && role.getDelFlag() == 1;
        if (role == null || deleted || role.getTenantId() == null || !tenantId.equals(role.getTenantId())) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "角色不存在或不属于当前主体");
        }
        return role;
    }

    /**
     * 当前主体可授予的权限点集合。
     *
     * <p>平台共享角色（{@code tenant_id} 为空）已持有的点、本主体现有角色已持有的点、
     * 运营端已批准给本主体的授权申请点，三者并集。租户管理员只能在这个集合内做分配，
     * 集合之外的点一律 403 —— 前端隐藏按钮不算数，越权必须由服务端拒绝。</p>
     */
    private Set<Long> grantablePermIds(String tenantId) {
        Set<Long> ids = new HashSet<>();
        List<Role> shared = roleMapper.selectList(new LambdaQueryWrapper<Role>()
                .and(w -> w.isNull(Role::getTenantId).or().eq(Role::getTenantId, ""))
                .and(w -> w.isNull(Role::getDelFlag).or().eq(Role::getDelFlag, 0)));
        List<Role> own = roleMapper.selectList(new LambdaQueryWrapper<Role>()
                .eq(Role::getTenantId, tenantId)
                .and(w -> w.isNull(Role::getDelFlag).or().eq(Role::getDelFlag, 0)));
        List<Long> roleIds = new ArrayList<>();
        shared.forEach(role -> {
            if (role.getId() != null) {
                roleIds.add(role.getId());
            }
        });
        own.forEach(role -> {
            if (role.getId() != null) {
                roleIds.add(role.getId());
            }
        });
        if (!roleIds.isEmpty()) {
            rolePermissionMapper.selectList(new LambdaQueryWrapper<RolePermission>()
                            .in(RolePermission::getRoleId, roleIds)
                            .and(w -> w.isNull(RolePermission::getDelFlag).or().eq(RolePermission::getDelFlag, 0)))
                    .forEach(grant -> {
                        if (grant.getPermId() != null) {
                            ids.add(grant.getPermId());
                        }
                    });
        }
        List<PermissionRequest> approved = permissionRequestMapper.selectList(new LambdaQueryWrapper<PermissionRequest>()
                .eq(PermissionRequest::getTenantId, tenantId)
                .eq(PermissionRequest::getStatus, PermissionRequest.APPROVED)
                .and(w -> w.isNull(PermissionRequest::getDelFlag).or().eq(PermissionRequest::getDelFlag, 0)));
        List<String> codes = approved.stream().map(PermissionRequest::getPermCode)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        if (!codes.isEmpty()) {
            permissionMapper.selectList(new LambdaQueryWrapper<Permission>()
                            .in(Permission::getPermCode, codes)
                            .and(w -> w.isNull(Permission::getDelFlag).or().eq(Permission::getDelFlag, 0)))
                    .forEach(point -> {
                        if (point.getId() != null) {
                            ids.add(point.getId());
                        }
                    });
        }
        return ids;
    }

    private String requireTenant() {
        String tenantId = SecurityUtils.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN,
                    "缺少经营主体上下文：请在请求头携带 X-Agri-Merchant");
        }
        return tenantId;
    }

    /** 组织必须属于当前主体：防止换个 orgId 读到别家的部门。 */
    private void requireOrgInTenant(String orgId, String tenantId) {
        List<Organization> orgs = organizationMapper.selectOrgByTenantId(tenantId);
        boolean owned = orgs.stream().anyMatch(org -> orgId.equals(String.valueOf(org.getId())));
        if (!owned) {
            throw new BusinessException(ErrorCode.PERMISSION_FORBIDDEN, "该组织不属于当前主体");
        }
    }
}
