package com.agri.admin.service.impl;

import com.agri.admin.client.CoreTenantSubjectClient;
import com.agri.admin.service.IAdminPermissionService;
import com.agri.admin.vo.OperationLogVO;
import com.agri.admin.vo.OperationLogSummaryVO;
import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.admin.vo.RoleSummaryVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.entity.Menu;
import com.agri.masterdata.entity.OperationLog;
import com.agri.masterdata.entity.Permission;
import com.agri.masterdata.entity.Role;
import com.agri.masterdata.mapper.MenuMapper;
import com.agri.masterdata.mapper.OperationLogMapper;
import com.agri.masterdata.mapper.PermissionMapper;
import com.agri.masterdata.mapper.RoleMapper;
import com.agri.masterdata.mapper.UserRoleMapper;
import com.agri.masterdata.vo.RoleVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * 权限审计。
 *
 * <p>本类原先有三处空壳：{@code getChangeLogs} 返回空列表、{@code getAnomalies} 返回空列表、
 * {@code getOperationLogs} 返回空列表 —— 于是「操作日志」页永远空白，
 * 而且它的返回类型是 {@code PermissionChangeLogVO}，字段名（{@code operator / changeType}）
 * 与页面读的（{@code username / operationType}）完全对不上，就算填了数据也一列都显示不出来。</p>
 *
 * <p>现在操作日志族统一以 {@code agri_md_operation_log} 为唯一数据源
 * （由 {@code AdminOperationLogAspect} 写入），用 {@link OperationLogVO} 对外。</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminPermissionServiceImpl implements IAdminPermissionService {

    /** 角色增删改所在控制器的 Swagger Tag，也是 agri_md_operation_log.module 的取值。 */
    private static final String PERMISSION_MODULE = "权限审计";

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RoleMapper roleMapper;
    private final OperationLogMapper operationLogMapper;
    private final PermissionMapper permissionMapper;
    private final UserRoleMapper userRoleMapper;
    private final MenuMapper menuMapper;
    private final CoreTenantSubjectClient coreTenantSubjectClient;
    private final com.agri.admin.service.PermissionAnomalyScanner permissionAnomalyScanner;
    private final com.agri.masterdata.service.IPermissionService permissionService;
    private final com.agri.masterdata.service.PermissionPointCatalogService permissionPointCatalogService;
    private final com.agri.common.security.PermissionPointGuard permissionPointGuard;
    private final com.agri.masterdata.service.IPermissionRequestService permissionRequestService;

    @Override
    public PageResult<RoleVO> getRoleList(Integer pageNum, Integer pageSize, String keyword, String roleName,
                                          String roleType, Integer status, String tenantId, String ownership) {
        int safePage = pageNum == null || pageNum < 1 ? 1 : pageNum;
        int safeSize = pageSize == null || pageSize < 1 ? 10 : Math.min(pageSize, 200);
        int offset = (safePage - 1) * safeSize;
        String normalizedRoleType = normalizeRoleTypeFilter(roleType);
        String normalizedOwnership = normalizeOwnership(ownership);
        List<RoleVO> list = roleMapper.selectAdminRoleList(
                offset, safeSize, trimToNull(keyword), trimToNull(roleName), normalizedRoleType,
                status, trimToNull(tenantId), normalizedOwnership);
        long total = roleMapper.countAdminRoleList(
                trimToNull(keyword), trimToNull(roleName), normalizedRoleType,
                status, trimToNull(tenantId), normalizedOwnership);
        enrichRoles(list, new HashMap<>());
        return PageResult.success(list, total, safePage, safeSize);
    }

    @Override
    public RoleSummaryVO getRoleSummary(String keyword, String roleName, String roleType, Integer status,
                                        String tenantId, String ownership) {
        return roleMapper.selectAdminRoleSummary(
                trimToNull(keyword), trimToNull(roleName), normalizeRoleTypeFilter(roleType), status,
                trimToNull(tenantId), normalizeOwnership(ownership));
    }

    @Override
    public RoleVO getRoleDetail(Long id) {
        RoleVO role = roleMapper.selectAdminRoleDetail(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        enrichRole(role, new HashMap<>());
        role.setMenuIds(roleMapper.selectMenuIdsByRoleId(id));
        return role;
    }

    @Override
    @Transactional
    public Long createRole(RoleSaveDTO dto) {
        String tenantId = trimToNull(dto.getTenantId());
        if (tenantId != null) {
            requireSubject(tenantId);
        }
        String roleCode = normalizeRoleCode(dto.getRoleCode());
        String roleKey = normalizeRoleKey(dto.getRoleKey());
        ensureRoleCodeUnique(roleCode, null);
        ensureRoleKeyUnique(roleKey, null);
        int status = normalizeStatus(dto.getStatus());
        Role role = Role.builder()
                .roleName(dto.getRoleName().trim())
                .roleCode(roleCode)
                .roleKey(roleKey)
                .roleType("custom")
                .roleStatus(status == 1 ? "ACTIVE" : "INACTIVE")
                .isSystem(0)
                .description(trimToNull(dto.getDescription()))
                .roleDesc(trimToNull(dto.getDescription()))
                .dataScope(normalizeDataScope(dto.getDataScope()))
                .sortOrder(dto.getRoleSort() == null ? 0 : dto.getRoleSort())
                .status(status)
                .delFlag(0)
                .tenantId(tenantId)
                .build();
        role.setRemark(trimToNull(dto.getRemark()));
        roleMapper.insert(role);
        return role.getId();
    }

    @Override
    @Transactional
    public void updateRole(Long id, RoleSaveDTO dto) {
        Role role = requireEditableRole(id);
        String requestTenant = trimToNull(dto.getTenantId());
        String existingTenant = trimToNull(role.getTenantId());
        if (!java.util.Objects.equals(requestTenant, existingTenant)) {
            throw new BusinessException("角色创建后不能更换所属主体");
        }
        String roleCode = normalizeRoleCode(dto.getRoleCode());
        if (!roleCode.equals(role.getRoleCode())) {
            throw new BusinessException("角色编码创建后不可修改");
        }
        String roleKey = normalizeRoleKey(dto.getRoleKey());
        ensureRoleKeyUnique(roleKey, id);
        role.setRoleName(dto.getRoleName().trim());
        role.setRoleKey(roleKey);
        role.setDescription(trimToNull(dto.getDescription()));
        role.setRoleDesc(trimToNull(dto.getDescription()));
        role.setDataScope(normalizeDataScope(dto.getDataScope()));
        role.setSortOrder(dto.getRoleSort() == null ? 0 : dto.getRoleSort());
        role.setStatus(normalizeStatus(dto.getStatus()));
        role.setRoleStatus(role.getStatus() == 1 ? "ACTIVE" : "INACTIVE");
        role.setRemark(trimToNull(dto.getRemark()));
        roleMapper.updateById(role);
    }

    @Override
    @Transactional
    public void deleteRole(Long id) {
        Role role = requireEditableRole(id);
        long userCount = userRoleMapper.selectCount(
                new LambdaQueryWrapper<com.agri.masterdata.entity.UserRole>()
                        .eq(com.agri.masterdata.entity.UserRole::getRoleId, role.getId()));
        if (userCount > 0) {
            throw new BusinessException("该角色已绑定 " + userCount + " 个用户，请先解除成员绑定");
        }
        roleMapper.deleteById(id);
    }

    @Override
    @Transactional
    public void updateRoleStatus(Long id, Integer status) {
        Role role = requireEditableRole(id);
        int normalized = normalizeStatus(status);
        role.setStatus(normalized);
        role.setRoleStatus(normalized == 1 ? "ACTIVE" : "INACTIVE");
        roleMapper.updateById(role);
    }

    @Override
    @Transactional
    public int assignRoleMenus(Long roleId, List<Long> menuIds) {
        requireEditableRole(roleId);
        List<Long> ids = menuIds == null
                ? Collections.emptyList()
                : menuIds.stream().filter(id -> id != null && id > 0).distinct().toList();
        if (!ids.isEmpty()) {
            Long existing = menuMapper.selectCount(new LambdaQueryWrapper<Menu>()
                    .in(Menu::getId, ids)
                    .eq(Menu::getDelFlag, 0));
            if (existing == null || existing.longValue() != ids.size()) {
                throw new BusinessException("提交的权限点里有不存在的项，请刷新后重试");
            }
        }
        roleMapper.deleteRoleMenus(roleId);
        for (Long menuId : ids) {
            roleMapper.insertRoleMenu(roleId, menuId);
        }
        return ids.size();
    }

    @Override
    public PageResult<PermissionChangeLogVO> getChangeLogs(Integer pageNum, Integer pageSize, String changeType, String operator, String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OperationLog::getModule, PERMISSION_MODULE);
        if (hasText(changeType)) {
            wrapper.eq(OperationLog::getOperationType, changeType.trim());
        }
        if (hasText(operator)) {
            wrapper.like(OperationLog::getOperator, operator.trim());
        }
        applyTimeRange(wrapper, startTime, endTime);
        wrapper.orderByDesc(OperationLog::getCreateTime).orderByDesc(OperationLog::getId);

        IPage<OperationLog> page = operationLogMapper.selectPage(buildPage(pageNum, pageSize), wrapper);
        List<PermissionChangeLogVO> list = page.getRecords().stream()
                .map(AdminPermissionServiceImpl::toChangeLogVO)
                .toList();
        return PageResult.success(list, page.getTotal(), (int) page.getCurrent(), (int) page.getSize());
    }

    @Override
    public List<PermissionStatisticsVO.AnomalyItem> getAnomalies(String status) {
        // 以前这里固定 return Collections.emptyList()，并注释说"缺的是规则表 + 扫描任务"。
        // 那两样本轮补齐了（agri_md_permission_rule / agri_md_role_mutex + PermissionAnomalyScanner），
        // 所以现在读的是扫描结果表：有就有、没有就没有。
        return toAnomalyItems(permissionAnomalyScanner.list(status));
    }

    @Override
    public Map<String, Object> scanAnomalies() {
        return permissionAnomalyScanner.scan();
    }

    @Override
    public List<com.agri.masterdata.entity.PermissionRule> listRules() {
        return permissionAnomalyScanner.enabledRules();
    }

    @Override
    public java.time.LocalDateTime lastScanAt() {
        return permissionAnomalyScanner.lastScanAt();
    }

    @Override
    public PermissionStatisticsVO getStatistics(String tenantId) {
        long totalRoles = tenantId == null || tenantId.isBlank()
                ? roleMapper.countAdminRoleList(null, null, null, null, null, null)
                : roleMapper.countAdminRoleList(null, null, null, null, tenantId, null);
        // 权限点取菜单目录里真带 perms 的那些。agri_md_permission 是历史遗留的空表，
        // 拿它的行数当"权限点总数"会让页面显示 0，而库里实际有 43 个权限串。
        long permissionPoints = menuMapper.selectCount(new LambdaQueryWrapper<Menu>()
                .isNotNull(Menu::getPerms).ne(Menu::getPerms, ""));
        return PermissionStatisticsVO.builder()
                .totalRoles(totalRoles)
                .totalPermissions(permissionPoints)
                // 接口级权限点是另一套数（由端点同步而来），与"页面权限点"分开显示，
                // 免得矩阵上勾的是接口、统计卡说的是页面，两个数互相解释不了
                .totalApiPoints(permissionMapper.selectCount(new LambdaQueryWrapper<Permission>()
                        .eq(Permission::getPermType, "API")))
                .totalRoleAssignments(countRoleMenuGrants())
                .totalUserRoles(userRoleMapper.selectCount(null))
                .anomalyCount(permissionAnomalyScanner.openCount())
                .anomalies(toAnomalyItems(permissionAnomalyScanner.list(null)))
                .lastScanAt(permissionAnomalyScanner.lastScanAt() == null
                        ? null : DATETIME_FMT.format(permissionAnomalyScanner.lastScanAt()))
                // 角色分布与趋势都是实算：人数来自 user_role、授权数来自 role_menu、
                // 趋势按各表自己的 create_time 聚合，没有按天快照也不编一条曲线。
                .roleDistribution(permissionAnomalyScanner.roleDistribution(tenantId))
                .trends(permissionAnomalyScanner.trends(14))
                .build();
    }

    /** 角色↔菜单绑定数（页面上"授权关系"那一格）。 */
    private long countRoleMenuGrants() {
        Long count = roleMapper.countRoleMenuGrants();
        return count == null ? 0L : count;
    }

    private List<PermissionStatisticsVO.AnomalyItem> toAnomalyItems(
            List<com.agri.masterdata.entity.PermissionAnomaly> rows) {
        return rows.stream()
                .map(row -> PermissionStatisticsVO.AnomalyItem.builder()
                        .anomalyType(row.getAnomalyType())
                        .description(row.getDetail())
                        .severity(row.getSeverity())
                        .targetId(row.getTargetId())
                        .targetName(row.getTargetName())
                        .tenantId(row.getTenantId())
                        // 本模块没有主体名的权威源（成员以用户中心为准），拿不到就留 null，
                        // 页面回退显示 tenantId —— 不用 id 之外的任何字符串冒充名称。
                        .tenantName(null)
                        .createTime(row.getLastSeen() == null ? null : DATETIME_FMT.format(row.getLastSeen()))
                        .firstSeen(row.getFirstSeen() == null ? null : DATETIME_FMT.format(row.getFirstSeen()))
                        .ruleCode(row.getRuleCode())
                        .status(row.getStatus())
                        .targetType(row.getTargetType())
                        .build())
                .toList();
    }

    @Override
    public PageResult<OperationLogVO> getOperationLogs(Integer pageNum, Integer pageSize, String keyword,
                                                       String operationType, String module, String result,
                                                       String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = buildOperationLogWrapper(
                keyword, operationType, module, result, startTime, endTime);
        wrapper.orderByDesc(OperationLog::getCreateTime).orderByDesc(OperationLog::getId);

        IPage<OperationLog> page = operationLogMapper.selectPage(buildPage(pageNum, pageSize), wrapper);
        List<OperationLogVO> list = page.getRecords().stream()
                .map(AdminPermissionServiceImpl::toOperationLogVO)
                .toList();
        return PageResult.success(list, page.getTotal(), (int) page.getCurrent(), (int) page.getSize());
    }

    @Override
    public OperationLogSummaryVO getOperationLogSummary(String keyword, String operationType, String module,
                                                        String result, String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> base = buildOperationLogWrapper(
                keyword, operationType, module, result, startTime, endTime);
        long total = operationLogMapper.selectCount(base);

        long success = operationLogMapper.selectCount(buildOperationLogWrapper(
                keyword, operationType, module, "success", startTime, endTime));
        long failed = operationLogMapper.selectCount(buildOperationLogWrapper(
                keyword, operationType, module, "fail", startTime, endTime));
        long today = operationLogMapper.selectCount(
                buildOperationLogWrapper(keyword, operationType, module, result, startTime, endTime)
                        .ge(OperationLog::getCreateTime, LocalDate.now().atStartOfDay()));

        QueryWrapper<OperationLog> moduleWrapper = new QueryWrapper<>();
        moduleWrapper.select("DISTINCT module")
                .isNotNull("module").ne("module", "");
        applyQueryFilters(moduleWrapper, keyword, operationType, module, result, startTime, endTime);
        long moduleCount = operationLogMapper.selectObjs(moduleWrapper).size();
        return OperationLogSummaryVO.builder()
                .total(total)
                .success(success)
                .failed(failed)
                .today(today)
                .moduleCount(moduleCount)
                .build();
    }

    @Override
    public List<String> getOperationLogModules() {
        QueryWrapper<OperationLog> wrapper = new QueryWrapper<>();
        wrapper.select("DISTINCT module")
                .isNotNull("module")
                .ne("module", "")
                .orderByAsc("module");
        return operationLogMapper.selectObjs(wrapper).stream()
                .map(String::valueOf)
                .toList();
    }

    /* ==================== 权限点（按钮级 / API 级） ==================== */

    @Override
    public List<com.agri.masterdata.vo.PermissionVO> listPermissionPoints(String keyword, String module) {
        return permissionService.listPoints(keyword, module);
    }

    @Override
    public Map<String, Object> syncPermissionPoints() {
        return permissionPointCatalogService.sync();
    }

    @Override
    public List<String> getRolePoints(Long roleId) {
        return permissionService.pointIdsOfRole(roleId);
    }

    /**
     * 覆盖式保存角色的权限点授权。
     *
     * <p>可编辑性沿用菜单授权那条规则（{@link #requireEditableRole}）：内置与历史角色只读。
     * 两处规则不一致会让人以为矩阵坏了 —— 菜单能勾、权限点不能勾，说不通。</p>
     */
    @Override
    public int assignRolePoints(Long roleId, List<String> permIds) {
        Role role = requireEditableRole(roleId);
        return permissionService.assignRolePoints(role.getId(), permIds, currentOperator());
    }

    /**
     * 「我的权限点」。
     *
     * <p>{@code denied} 直接取拦截器那份计算（{@code PermissionPointGuard.deniedFor}）：
     * 页面隐藏按钮的依据与服务端拒绝的依据必须是同一个方法，否则会出现"按钮还在但一调就 403"
     * 或"按钮没了其实还能调" —— 两种都比不隐藏更坏。</p>
     */
    @Override
    public Map<String, Object> myPermissionPoints() {
        com.agri.common.security.LoginUser loginUser = com.agri.common.security.SecurityUtils.getLoginUser();
        Map<String, Object> result = new HashMap<>();
        String username = loginUser == null ? "" : loginUser.getUsername();
        boolean superAdmin = com.agri.common.security.PermissionPointGuard.isSuperAdmin(loginUser);
        result.put("username", username);
        result.put("localUserId", permissionService.localUserIdByUsername(username));
        result.put("superAdmin", superAdmin);
        // 超管不走权限点判定，这里返回空集合而不是"全部"，免得页面以为拿到了几百个码
        result.put("granted", superAdmin ? List.of() : List.copyOf(permissionService.grantedCodesByUsername(username)));
        result.put("denied", List.copyOf(permissionPointGuard.deniedFor(loginUser)));
        // 已经提过申请的点：横幅据此显示"已在排队"，避免同一个人反复点同一个按钮
        result.put("pending", permissionRequestService.pendingCodesOf(username));
        return result;
    }

    /**
     * 授权申请列表。
     *
     * <p>状态为空 = 不按状态筛，直接透传给查询。这里<b>不</b>替调用方补默认值：
     * 「默认只看待处理」是矩阵页的下拉初始选项（前端自己的口径），若在服务端也兜一层，
     * 页面上选了「全部」却收到一串待处理，就成了"UI 说的和后端做的不一致"。</p>
     */
    @Override
    public List<com.agri.masterdata.entity.PermissionRequest> listPermissionRequests(String status, String keyword) {
        return permissionRequestService.list(status, keyword);
    }

    @Override
    public Map<String, Object> handlePermissionRequest(Long id, boolean approve, String remark) {
        return permissionRequestService.handle(id, approve, remark, currentOperator());
    }

    /** 授权留痕的操作人：取当前登录账号，不写死一个名字冒充。 */
    private String currentOperator() {
        String username = com.agri.common.security.SecurityUtils.getUsername();
        return username == null || username.isBlank() ? "unknown" : username;
    }

    @Override
    public byte[] exportChangeLogs(String changeType, String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OperationLog::getModule, PERMISSION_MODULE);
        if (hasText(changeType)) {
            wrapper.eq(OperationLog::getOperationType, changeType.trim());
        }
        applyTimeRange(wrapper, startTime, endTime);
        wrapper.orderByDesc(OperationLog::getCreateTime).orderByDesc(OperationLog::getId);

        StringBuilder csv = new StringBuilder();
        csv.append("操作类型,关联模块,目标ID,操作描述,操作人,IP地址,结果,失败原因,耗时(ms),操作时间\n");
        for (OperationLog log : operationLogMapper.selectList(wrapper)) {
            csv.append(csvCell(log.getOperationType())).append(',')
                    .append(csvCell(log.getModule())).append(',')
                    .append(csvCell(log.getTargetId())).append(',')
                    .append(csvCell(log.getOperationDesc())).append(',')
                    .append(csvCell(log.getOperator())).append(',')
                    .append(csvCell(log.getIpAddress())).append(',')
                    .append(csvCell(log.getResult())).append(',')
                    .append(csvCell(log.getErrorMessage())).append(',')
                    .append(log.getDurationMs() == null ? "" : log.getDurationMs()).append(',')
                    .append(log.getCreateTime() == null ? "" : log.getCreateTime().format(DATETIME_FMT))
                    .append('\n');
        }
        // 带 BOM：不带的话 Excel 打开中文列名会乱码（与质量问题的导出保持同一套做法）
        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);
        return withBom;
    }

    private static Page<OperationLog> buildPage(Integer pageNum, Integer pageSize) {
        long current = pageNum == null || pageNum < 1 ? 1L : pageNum;
        long size = pageSize == null || pageSize < 1 ? 10L : pageSize;
        return new Page<>(current, size);
    }

    private static LambdaQueryWrapper<OperationLog> buildOperationLogWrapper(
            String keyword, String operationType, String module, String result,
            String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        applyQueryFilters(wrapper, keyword, operationType, module, result, startTime, endTime);
        return wrapper;
    }

    private static void applyQueryFilters(LambdaQueryWrapper<OperationLog> wrapper,
                                          String keyword, String operationType, String module,
                                          String result, String startTime, String endTime) {
        if (hasText(keyword)) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like(OperationLog::getOperator, trimmed)
                    .or().like(OperationLog::getOperationDesc, trimmed)
                    .or().like(OperationLog::getTargetId, trimmed)
                    .or().like(OperationLog::getRequestUri, trimmed));
        }
        if (hasText(operationType)) {
            wrapper.eq(OperationLog::getOperationType, operationType.trim().toLowerCase(Locale.ROOT));
        }
        if (hasText(module)) {
            wrapper.eq(OperationLog::getModule, module.trim());
        }
        if (hasText(result)) {
            wrapper.eq(OperationLog::getResult, result.trim().toLowerCase(Locale.ROOT));
        }
        applyTimeRange(wrapper, startTime, endTime);
    }

    private static void applyQueryFilters(QueryWrapper<OperationLog> wrapper,
                                          String keyword, String operationType, String module,
                                          String result, String startTime, String endTime) {
        if (hasText(keyword)) {
            String trimmed = keyword.trim();
            wrapper.and(w -> w.like("operator", trimmed)
                    .or().like("operation_desc", trimmed)
                    .or().like("target_id", trimmed)
                    .or().like("request_uri", trimmed));
        }
        if (hasText(operationType)) {
            wrapper.eq("operation_type", operationType.trim().toLowerCase(Locale.ROOT));
        }
        if (hasText(module)) {
            wrapper.eq("module", module.trim());
        }
        if (hasText(result)) {
            wrapper.eq("result", result.trim().toLowerCase(Locale.ROOT));
        }
        if (hasText(startTime)) {
            wrapper.ge("create_time", parseTime(startTime, false));
        }
        if (hasText(endTime)) {
            wrapper.le("create_time", parseTime(endTime, true));
        }
    }

    private static void applyTimeRange(LambdaQueryWrapper<OperationLog> wrapper, String startTime, String endTime) {
        LocalDateTime from = parseTime(startTime, false);
        if (from != null) {
            wrapper.ge(OperationLog::getCreateTime, from);
        }
        LocalDateTime to = parseTime(endTime, true);
        if (to != null) {
            wrapper.le(OperationLog::getCreateTime, to);
        }
    }

    /**
     * 解析时间条件。页面上是 {@code <input type="date">}，只会给出 {@code 2026-10-13} 这种日期；
     * 也顺带兼容 ISO 的"日期+时间"写法，方便直接用 curl / Swagger 调试。
     *
     * <p>结束日期补到当天 23:59:59 —— 否则 {@code <= 2026-10-13} 会等价于
     * {@code <= 2026-10-13 00:00:00}，把选中那一天的操作全漏掉，而且页面上看起来
     * 像是"那天没干活"。</p>
     */
    private static LocalDateTime parseTime(String text, boolean endOfDay) {
        if (!hasText(text)) {
            return null;
        }
        String value = text.trim();
        try {
            if (value.length() <= 10) {
                LocalDate date = LocalDate.parse(value);
                return endOfDay ? date.atTime(23, 59, 59) : date.atStartOfDay();
            }
            return LocalDateTime.parse(value.replace(' ', 'T'));
        } catch (Exception e) {
            // 静默忽略格式错误会让"筛了日期却毫无变化"变成一个查不出来的问题，所以直接报错
            throw new BusinessException("时间格式不正确，应为 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss：" + value);
        }
    }

    private Role requireEditableRole(Long id) {
        Role role = roleMapper.selectById(id);
        if (role == null || Integer.valueOf(1).equals(role.getDelFlag())) {
            throw new BusinessException("角色不存在或已删除");
        }
        if (isSystemRole(role)) {
            throw new BusinessException("系统内置角色只允许查看，不能修改、停用或删除");
        }
        String tenantId = trimToNull(role.getTenantId());
        if (tenantId != null) {
            if (!tenantId.matches("\\d+")) {
                throw new BusinessException("历史角色未关联统一经营主体，只允许查看");
            }
            requireSubject(tenantId);
        }
        return role;
    }

    private void requireSubject(String tenantId) {
        CoreTenantSubjectClient.CoreTenantSubject subject = loadSubject(tenantId);
        if (subject == null) {
            throw new BusinessException("所属企业或个人主体不存在");
        }
        if (!Integer.valueOf(1).equals(subject.status())) {
            throw new BusinessException("所属主体已停用，不能调整角色");
        }
    }

    private CoreTenantSubjectClient.CoreTenantSubject loadSubject(String tenantId) {
        String normalized = trimToNull(tenantId);
        if (normalized == null || !normalized.matches("\\d+")) {
            return null;
        }
        try {
            CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CoreTenantSubject> response =
                    coreTenantSubjectClient.detail(Long.parseLong(normalized));
            if (response.code() != null && response.code() == 0) {
                return response.data();
            }
        } catch (RuntimeException ex) {
            log.debug("角色所属主体 {} 查询异常：{}", normalized, ex.getMessage());
        }
        return null;
    }

    private void enrichRoles(List<RoleVO> roles,
                             Map<String, Optional<CoreTenantSubjectClient.CoreTenantSubject>> subjectCache) {
        if (roles == null) {
            return;
        }
        for (RoleVO role : roles) {
            enrichRole(role, subjectCache);
        }
    }

    private void enrichRole(RoleVO role,
                            Map<String, Optional<CoreTenantSubjectClient.CoreTenantSubject>> subjectCache) {
        boolean system = Boolean.TRUE.equals(role.getIsSystem())
                || "system".equalsIgnoreCase(role.getRoleType());
        role.setIsSystem(system);
        role.setRoleType(system ? "system" : "custom");
        role.setDataScopeName(RoleVO.dataScopeName(role.getDataScope()));
        String tenantId = trimToNull(role.getTenantId());
        if (tenantId == null) {
            role.setOwnershipType("PLATFORM");
            role.setOwnershipLabel(system ? "平台系统角色" : "平台公共角色");
            role.setTenantName("平台公共");
            role.setSubjectLinked(false);
            role.setLegacy(false);
            role.setEditable(!system);
            return;
        }
        if (!tenantId.matches("\\d+")) {
            role.setOwnershipType("LEGACY");
            role.setOwnershipLabel("历史主体角色");
            if (!hasText(role.getTenantName())) {
                role.setTenantName("历史主体 " + tenantId);
            }
            role.setSubjectLinked(false);
            role.setLegacy(true);
            role.setEditable(false);
            return;
        }
        Optional<CoreTenantSubjectClient.CoreTenantSubject> subject = subjectCache.computeIfAbsent(
                tenantId, key -> Optional.ofNullable(loadSubject(key)));
        role.setOwnershipType("SUBJECT");
        role.setOwnershipLabel(system ? "主体系统角色" : "主体自定义角色");
        role.setSubjectLinked(subject.isPresent());
        role.setLegacy(false);
        role.setEditable(!system && subject.isPresent());
        if (subject.isPresent()) {
            role.setTenantName(subject.get().tenantName());
            role.setTenantType("personal".equalsIgnoreCase(subject.get().memberType())
                    ? "INDIVIDUAL" : "ENTERPRISE");
        } else if (!hasText(role.getTenantName())) {
            role.setTenantName("主体未匹配");
        }
    }

    private void ensureRoleCodeUnique(String roleCode, Long excludeId) {
        LambdaQueryWrapper<Role> wrapper = new LambdaQueryWrapper<Role>()
                .eq(Role::getRoleCode, roleCode);
        if (excludeId != null) {
            wrapper.ne(Role::getId, excludeId);
        }
        if (roleMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("角色编码已存在");
        }
    }

    private void ensureRoleKeyUnique(String roleKey, Long excludeId) {
        LambdaQueryWrapper<Role> wrapper = new LambdaQueryWrapper<Role>()
                .eq(Role::getRoleKey, roleKey)
                .eq(Role::getDelFlag, 0);
        if (excludeId != null) {
            wrapper.ne(Role::getId, excludeId);
        }
        if (roleMapper.selectCount(wrapper) > 0) {
            throw new BusinessException("角色标识已存在");
        }
    }

    private static boolean isSystemRole(Role role) {
        return Integer.valueOf(1).equals(role.getIsSystem())
                || "system".equalsIgnoreCase(role.getRoleType())
                || "SYSTEM".equalsIgnoreCase(role.getRoleType());
    }

    private static String normalizeRoleCode(String value) {
        String code = trimToNull(value);
        if (code == null) {
            throw new BusinessException("角色编码不能为空");
        }
        code = code.toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9_-]{2,64}")) {
            throw new BusinessException("角色编码只能包含字母、数字、下划线和中划线，长度 2-64 位");
        }
        return code;
    }

    private static String normalizeRoleKey(String value) {
        String key = trimToNull(value);
        if (key == null) {
            throw new BusinessException("角色标识不能为空");
        }
        if (!key.matches("[A-Za-z][A-Za-z0-9:_-]{1,99}")) {
            throw new BusinessException("角色标识格式不正确");
        }
        return key;
    }

    private static String normalizeDataScope(String value) {
        String scope = trimToNull(value);
        scope = scope == null ? "ALL" : scope.toUpperCase(Locale.ROOT);
        if (!List.of("ALL", "TENANT", "ORG", "DEPT", "OWNER").contains(scope)) {
            throw new BusinessException("数据范围值不正确");
        }
        return scope;
    }

    private static int normalizeStatus(Integer status) {
        int value = status == null ? 1 : status;
        if (value != 0 && value != 1) {
            throw new BusinessException("角色状态只能是启用或停用");
        }
        return value;
    }

    private static String normalizeRoleTypeFilter(String roleType) {
        String value = trimToNull(roleType);
        if (value == null) {
            return null;
        }
        value = value.toLowerCase(Locale.ROOT);
        return "system".equals(value) || "custom".equals(value) ? value : null;
    }

    private static String normalizeOwnership(String ownership) {
        String value = trimToNull(ownership);
        if (value == null) {
            return null;
        }
        value = value.toUpperCase(Locale.ROOT);
        return "PLATFORM".equals(value) || "SUBJECT".equals(value) ? value : null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private static OperationLogVO toOperationLogVO(OperationLog entity) {
        OperationLogVO vo = new OperationLogVO();
        vo.setId(entity.getId());
        vo.setUsername(entity.getOperator());
        vo.setOperatorId(entity.getOperatorId() == null ? null : String.valueOf(entity.getOperatorId()));
        vo.setOperationType(entity.getOperationType());
        vo.setOperationDesc(entity.getOperationDesc());
        vo.setModule(entity.getModule());
        vo.setTargetId(entity.getTargetId());
        vo.setRequestMethod(entity.getRequestMethod());
        vo.setRequestUri(entity.getRequestUri());
        vo.setParams(entity.getParams());
        vo.setIpAddress(entity.getIpAddress());
        vo.setResult(entity.getResult());
        vo.setDurationMs(entity.getDurationMs());
        vo.setErrorMessage(entity.getErrorMessage());
        vo.setTenantId(entity.getTenantId());
        vo.setCreateTime(entity.getCreateTime() == null ? null : entity.getCreateTime().format(DATETIME_FMT));
        return vo;
    }

    /**
     * 变更记录 VO 与操作日志同源，字段按可用的信息映射。
     *
     * <p>{@code beforeValue / afterValue / tenantName} 留空：没有权限变更快照表，
     * 也没有租户名称的关联查询，编不出来。{@code targetName} 放操作描述，
     * 因为"创建角色"本身就是这次变更最贴切的名字。</p>
     */
    private static PermissionChangeLogVO toChangeLogVO(OperationLog entity) {
        PermissionChangeLogVO vo = new PermissionChangeLogVO();
        vo.setId(entity.getId());
        vo.setChangeType(entity.getOperationType());
        vo.setTargetType(entity.getModule());
        vo.setTargetId(entity.getTargetId());
        vo.setTargetName(entity.getOperationDesc());
        vo.setOperator(entity.getOperator());
        vo.setOperatorId(entity.getOperatorId() == null ? null : String.valueOf(entity.getOperatorId()));
        vo.setCreateTime(entity.getCreateTime() == null ? null : entity.getCreateTime().format(DATETIME_FMT));
        vo.setTenantId(entity.getTenantId());
        vo.setIpAddress(entity.getIpAddress());
        return vo;
    }

    /** CSV 单元格转义：逗号、引号、换行都会破坏列结构。 */
    private static String csvCell(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
