package com.agri.platform.internal.uc;

import com.agri.platform.internal.account.IdentityApplicationEntity;
import com.agri.platform.internal.account.IdentityApplicationMapper;
import com.agri.platform.internal.account.PrivacyRequestEntity;
import com.agri.platform.internal.account.PrivacyRequestMapper;
import com.agri.platform.internal.account.UserOperationLogEntity;
import com.agri.platform.internal.account.UserOperationLogMapper;
import com.agri.platform.internal.account.UserOperationLogService;
import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.merchant.MerchantCertificationEntity;
import com.agri.platform.internal.merchant.MerchantCertificationMapper;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.permission.RoleEntity;
import com.agri.platform.internal.permission.RoleMapper;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.agri.platform.internal.user.UserRoleEntity;
import com.agri.platform.internal.user.UserRoleMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 用户中心运营端 · 只读视图（总览 / 用户 / 身份 / 组织 / 安全 / 审计）。
 *
 * <p><b>为什么单独一个控制器而不是扩充既有 admin 接口</b>：
 * {@code /api/v1/admin/users}、{@code /admin/roles} 这些是"按实体管"的窄接口，
 * 而运营端要的是"按视角看"的聚合视图（一个用户行要同时带角色、实名、主体、冻结态）。
 * 硬塞进原控制器会让它既当 CRUD 又当报表，两边都难改。写操作仍走原有接口，这里只补读。</p>
 *
 * <p><b>与既有模块的关系</b>：用户、角色、身份申请、实名、资质、组织、反馈、隐私请求
 * 的数据源全部是 {@code platform_*} 原表，本控制器不持有任何副本 ——
 * 用户在用户端提交的东西，运营端看到的就是同一行记录。</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/admin/uc")
@RequiredArgsConstructor
public class UserCenterOpsController {

    private final UserMapper userMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final UserIdentityMapper userIdentityMapper;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final IdentityApplicationMapper identityApplicationMapper;
    private final MerchantCertificationMapper certificationMapper;
    private final PrivacyRequestMapper privacyRequestMapper;
    private final UserOperationLogMapper operationLogMapper;
    private final UserOperationLogService operationLogService;
    private final UcStatsMapper statsMapper;
    private final AccountFreezeMapper freezeMapper;

    // ==================== 总览 ====================

    /**
     * 用户中心总览：核心指标 + 我的待办 + 身份分布 + 增长趋势。
     *
     * @param days 趋势天数，默认 30
     */
    @GetMapping("/dashboard")
    public ApiResponse<Map<String, Object>> dashboard(@RequestParam(defaultValue = "30") int days) {
        int span = Math.min(Math.max(days, 7), 90);
        LocalDateTime from = LocalDate.now().minusDays(span - 1L).atStartOfDay();

        // UserEntity.deleted 是 @TableLogic，MP 会自动加 deleted=0，这里不再手写
        long userTotal = userMapper.selectCount(new LambdaQueryWrapper<>());
        long todayNew = userMapper.selectCount(new LambdaQueryWrapper<UserEntity>()
                .ge(UserEntity::getCreatedAt, LocalDate.now().atStartOfDay()));

        // 实名通过的状态值是 verified（不是 approved）—— 见 UserIdentityController.submit 里的判断。
        // 写成 approved 会永远统计到 0，页面上"实名率 0%"看起来像数据问题，其实是口径抄错了。
        long identityTotal = userIdentityMapper.selectCount(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getStatus, "verified"));
        long identityPending = userIdentityMapper.selectCount(new LambdaQueryWrapper<UserIdentityEntity>()
                .eq(UserIdentityEntity::getStatus, "pending"));

        long merchantTotal = merchantMapper.selectCount(new LambdaQueryWrapper<MerchantEntity>());
        long merchantCertified = merchantMapper.selectCount(new LambdaQueryWrapper<MerchantEntity>()
                .eq(MerchantEntity::getVerifyStatus, "approved"));

        long activeUsers = statsMapper.activeUsers(from);

        // 待办：四类单据的待处理数，直接读原表，不另建"待办表"
        long appPending = identityApplicationMapper.selectCount(new LambdaQueryWrapper<IdentityApplicationEntity>()
                .eq(IdentityApplicationEntity::getStatus, "pending"));
        long certPending = certificationMapper.selectCount(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .in(MerchantCertificationEntity::getCertStatus, "pending", "submitted", "reviewing"));
        long privacyPending = privacyRequestMapper.selectCount(new LambdaQueryWrapper<PrivacyRequestEntity>()
                .eq(PrivacyRequestEntity::getStatus, "pending"));
        long frozenCount = freezeMapper.selectCount(new LambdaQueryWrapper<AccountFreezeEntity>()
                .eq(AccountFreezeEntity::getStatus, "frozen"));

        Map<String, Object> metrics = new LinkedHashMap<>();
        metrics.put("userTotal", userTotal);
        metrics.put("todayNew", todayNew);
        metrics.put("identityTotal", identityTotal);
        metrics.put("identityPending", identityPending);
        metrics.put("realnameRate", userTotal == 0 ? 0
                : Math.round(identityTotal * 1000.0 / userTotal) / 10.0);
        metrics.put("merchantTotal", merchantTotal);
        metrics.put("merchantCertified", merchantCertified);
        metrics.put("activeUsers", activeUsers);
        metrics.put("activeRate", userTotal == 0 ? 0
                : Math.round(activeUsers * 1000.0 / userTotal) / 10.0);
        metrics.put("frozenCount", frozenCount);

        List<Map<String, Object>> todos = new ArrayList<>();
        todos.add(todo("identity", "身份申请待审核", appPending, "identity-audit"));
        todos.add(todo("realname", "实名认证待审核", identityPending, "realname-audit"));
        todos.add(todo("cert", "资质证照待审核", certPending, "qualification-audit"));
        todos.add(todo("privacy", "隐私请求待处理", privacyPending, "privacy-request"));

        // 趋势：注册 / 实名 / 组织 三条线，缺的日期补 0（前端画折线不能有断点）
        List<String> labels = new ArrayList<>();
        for (int i = 0; i < span; i++) {
            labels.add(LocalDate.now().minusDays(span - 1L - i).toString());
        }
        Map<String, Object> trend = new LinkedHashMap<>();
        trend.put("labels", labels);
        trend.put("register", fillSeries(labels, statsMapper.countUsersByDay(from)));
        trend.put("realname", fillSeries(labels, statsMapper.countIdentitiesByDay(from)));
        trend.put("org", fillSeries(labels, statsMapper.countMerchantsByDay(from)));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("metrics", metrics);
        result.put("todos", todos);
        result.put("trend", trend);
        result.put("roles", statsMapper.roleDistribution());
        result.put("orgTypes", statsMapper.merchantTypeDistribution());
        result.put("identityStatus", statsMapper.identityStatusCount());
        result.put("updatedAt", LocalDateTime.now().toString());
        return ApiResponse.ok(result);
    }

    private Map<String, Object> todo(String key, String label, long count, String route) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", key);
        row.put("label", label);
        row.put("count", count);
        row.put("route", route);
        return row;
    }

    /** 把「日期 → 计数」的聚合结果铺成与 labels 等长的数组。 */
    private List<Long> fillSeries(List<String> labels, List<Map<String, Object>> rows) {
        Map<String, Long> byDay = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Object d = row.get("d");
            Object c = row.get("c");
            if (d != null) {
                byDay.put(String.valueOf(d).substring(0, 10), c == null ? 0L : ((Number) c).longValue());
            }
        }
        List<Long> series = new ArrayList<>(labels.size());
        for (String label : labels) {
            series.add(byDay.getOrDefault(label, 0L));
        }
        return series;
    }

    // ==================== 用户 ====================

    /**
     * 用户列表（运营视角）：一行带角色、实名状态、所属主体、是否冻结。
     *
     * <p>不复用 {@code /admin/users} 的原因：那个接口只返回 UserEntity 原样，
     * 运营真正要看的是"这个人是谁、能干什么、认证到哪一步"，需要跨 4 张表拼。</p>
     */
    @GetMapping("/users")
    public ApiResponse<PageResult<Map<String, Object>>> users(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String roleCode,
            @RequestParam(required = false) String realnameStatus,
            @RequestParam(required = false) Integer status) {

        LambdaQueryWrapper<UserEntity> wrapper = new LambdaQueryWrapper<UserEntity>()
                .and(hasText(keyword), w -> w.like(UserEntity::getUsername, keyword)
                        .or().like(UserEntity::getNickname, keyword)
                        .or().like(UserEntity::getPhone, keyword))
                .eq(status != null, UserEntity::getStatus, status)
                .orderByDesc(UserEntity::getCreatedAt);

        // 按角色筛选要先解析出用户 ID 集合，再回主表分页 ——
        // 直接 join 会让 MyBatis-Plus 的分页总数算错（一对多会放大行数）。
        if (hasText(roleCode)) {
            List<Long> ids = userIdsByRole(roleCode);
            if (ids.isEmpty()) {
                return ApiResponse.ok(PageResult.of(List.of(), 0, pageNum, pageSize));
            }
            wrapper.in(UserEntity::getId, ids);
        }
        if (hasText(realnameStatus)) {
            List<Long> ids = userIdentityMapper.selectList(new LambdaQueryWrapper<UserIdentityEntity>()
                            .eq(UserIdentityEntity::getStatus, realnameStatus))
                    .stream().map(UserIdentityEntity::getUserId).filter(Objects::nonNull).distinct().toList();
            if (ids.isEmpty()) {
                return ApiResponse.ok(PageResult.of(List.of(), 0, pageNum, pageSize));
            }
            wrapper.in(UserEntity::getId, ids);
        }

        Page<UserEntity> result = userMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = result.getRecords().stream()
                .map(this::userRow).collect(Collectors.toList());
        return ApiResponse.ok(PageResult.of(rows, result.getTotal(), pageNum, pageSize));
    }

    private List<Long> userIdsByRole(String roleCode) {
        List<RoleEntity> roles = roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getCode, roleCode));
        if (roles.isEmpty()) {
            return List.of();
        }
        List<Long> roleIds = roles.stream().map(RoleEntity::getId).toList();
        return userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                        .in(UserRoleEntity::getRoleId, roleIds))
                .stream().map(UserRoleEntity::getUserId).filter(Objects::nonNull).distinct().toList();
    }

    /** 单个用户的一行运营视图。 */
    private Map<String, Object> userRow(UserEntity user) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", String.valueOf(user.getId()));
        row.put("username", user.getUsername());
        row.put("nickname", user.getNickname());
        row.put("phone", maskPhone(user.getPhone()));
        row.put("email", user.getEmail());
        row.put("status", user.getStatus());
        row.put("createdAt", user.getCreatedAt());

        List<String> roles = roleCodesOf(user.getId());
        row.put("roles", roles);

        UserIdentityEntity identity = latestIdentity(user.getId());
        row.put("realnameStatus", identity == null ? "none" : identity.getStatus());
        row.put("realName", identity == null ? null : identity.getRealName());

        List<MerchantEntity> orgs = orgsOf(user.getId());
        row.put("orgCount", orgs.size());
        row.put("orgNames", orgs.stream().map(MerchantEntity::getName).limit(3).toList());

        AccountFreezeEntity freeze = activeFreeze(user.getId());
        row.put("frozen", freeze != null);
        row.put("freezeType", freeze == null ? null : freeze.getFreezeType());
        return row;
    }

    private List<String> roleCodesOf(Long userId) {
        List<UserRoleEntity> links = userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, userId));
        if (links.isEmpty()) {
            return List.of();
        }
        List<Long> roleIds = links.stream().map(UserRoleEntity::getRoleId).distinct().toList();
        return roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                        .in(RoleEntity::getId, roleIds))
                .stream().map(RoleEntity::getCode).toList();
    }

    private UserIdentityEntity latestIdentity(Long userId) {
        List<UserIdentityEntity> list = userIdentityMapper.selectList(
                new LambdaQueryWrapper<UserIdentityEntity>()
                        .eq(UserIdentityEntity::getUserId, userId)
                        .orderByDesc(UserIdentityEntity::getId));
        return list.isEmpty() ? null : list.get(0);
    }

    private List<MerchantEntity> orgsOf(Long userId) {
        List<UserMerchantEntity> links = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>().eq(UserMerchantEntity::getUserId, userId));
        if (links.isEmpty()) {
            return List.of();
        }
        List<Long> ids = links.stream().map(UserMerchantEntity::getMerchantId).distinct().toList();
        return merchantMapper.selectList(new LambdaQueryWrapper<MerchantEntity>()
                .in(MerchantEntity::getId, ids));
    }

    private AccountFreezeEntity activeFreeze(Long userId) {
        List<AccountFreezeEntity> list = freezeMapper.selectList(new LambdaQueryWrapper<AccountFreezeEntity>()
                .eq(AccountFreezeEntity::getUserId, userId)
                .eq(AccountFreezeEntity::getStatus, "frozen")
                .orderByDesc(AccountFreezeEntity::getId));
        return list.isEmpty() ? null : list.get(0);
    }

    /** 用户详情：档案 + 角色 + 实名 + 主体 + 最近操作。 */
    @GetMapping("/users/{id}")
    public ApiResponse<Map<String, Object>> userDetail(@PathVariable Long id) {
        UserEntity user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "用户不存在");
        }
        operationLogService.record(currentOperatorId(), "uc.user.view", "查看用户详情",
                user.getUsername(), "运营端查看用户 " + user.getUsername());

        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> base = new LinkedHashMap<>();
        base.put("id", String.valueOf(user.getId()));
        base.put("username", user.getUsername());
        base.put("nickname", user.getNickname());
        base.put("phone", user.getPhone());
        base.put("email", user.getEmail());
        base.put("status", user.getStatus());
        base.put("createdAt", user.getCreatedAt());
        base.put("updatedAt", user.getUpdatedAt());
        result.put("user", base);

        List<RoleEntity> roles = new ArrayList<>();
        List<UserRoleEntity> links = userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, id));
        if (!links.isEmpty()) {
            roles = roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                    .in(RoleEntity::getId, links.stream().map(UserRoleEntity::getRoleId).distinct().toList()));
        }
        result.put("roles", roles.stream().map(r -> Map.of(
                "code", r.getCode(), "name", r.getName(),
                "permissions", r.getPermissions() == null ? "" : r.getPermissions())).toList());

        result.put("identity", latestIdentity(id));
        result.put("orgs", orgsOf(id));
        result.put("freeze", activeFreeze(id));

        List<UserOperationLogEntity> logs = operationLogMapper.selectList(
                new LambdaQueryWrapper<UserOperationLogEntity>()
                        .eq(UserOperationLogEntity::getUserId, id)
                        .orderByDesc(UserOperationLogEntity::getId)
                        .last("LIMIT 20"));
        result.put("recentLogs", logs);
        return ApiResponse.ok(result);
    }

    // ==================== 身份 ====================

    /**
     * 身份管理：按角色统计身份实例 + 分页列出用户身份。
     *
     * <p>「身份」在本平台有两个来源：角色（能干什么）与主体成员关系（属于哪家组织）。
     * 这里按角色口径统计，与原型「6 类身份」对得上。</p>
     */
    @GetMapping("/identities")
    public ApiResponse<Map<String, Object>> identities(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String roleCode) {

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("distribution", statsMapper.roleDistribution());

        LambdaQueryWrapper<UserRoleEntity> wrapper = new LambdaQueryWrapper<>();
        if (hasText(roleCode)) {
            List<RoleEntity> roles = roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                    .eq(RoleEntity::getCode, roleCode));
            if (roles.isEmpty()) {
                result.put("page", PageResult.of(List.of(), 0, pageNum, pageSize));
                return ApiResponse.ok(result);
            }
            wrapper.in(UserRoleEntity::getRoleId, roles.stream().map(RoleEntity::getId).toList());
        }
        wrapper.orderByDesc(UserRoleEntity::getId);
        Page<UserRoleEntity> page = userRoleMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);

        Map<Long, RoleEntity> roleMap = roleMapper.selectList(null).stream()
                .collect(Collectors.toMap(RoleEntity::getId, r -> r, (a, b) -> a));
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserRoleEntity link : page.getRecords()) {
            UserEntity user = userMapper.selectById(link.getUserId());
            RoleEntity role = roleMap.get(link.getRoleId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(link.getId()));
            row.put("userId", String.valueOf(link.getUserId()));
            row.put("username", user == null ? null : user.getUsername());
            row.put("nickname", user == null ? null : user.getNickname());
            row.put("roleCode", role == null ? null : role.getCode());
            row.put("roleName", role == null ? null : role.getName());
            UserIdentityEntity identity = latestIdentity(link.getUserId());
            row.put("realnameStatus", identity == null ? "none" : identity.getStatus());
            row.put("orgCount", orgsOf(link.getUserId()).size());
            rows.add(row);
        }
        result.put("page", PageResult.of(rows, page.getTotal(), pageNum, pageSize));
        return ApiResponse.ok(result);
    }

    // ==================== 组织 ====================

    /** 组织列表：带成员数、认证状态、主体类型。 */
    @GetMapping("/orgs")
    public ApiResponse<PageResult<Map<String, Object>>> orgs(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String verifyStatus) {

        LambdaQueryWrapper<MerchantEntity> wrapper = new LambdaQueryWrapper<MerchantEntity>()
                .and(hasText(keyword), w -> w.like(MerchantEntity::getName, keyword)
                        .or().like(MerchantEntity::getCode, keyword)
                        .or().like(MerchantEntity::getCreditCode, keyword))
                .eq(hasText(type), MerchantEntity::getType, type)
                .eq(hasText(verifyStatus), MerchantEntity::getVerifyStatus, verifyStatus)
                .orderByDesc(MerchantEntity::getId);

        Page<MerchantEntity> page = merchantMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (MerchantEntity m : page.getRecords()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(m.getId()));
            row.put("code", m.getCode());
            row.put("name", m.getName());
            row.put("type", m.getType());
            row.put("memberType", m.getMemberType());
            row.put("industry", m.getIndustry());
            row.put("address", m.getAddress());
            row.put("creditCode", m.getCreditCode());
            row.put("contactName", m.getContactName());
            row.put("contactPhone", maskPhone(m.getContactPhone()));
            row.put("status", m.getStatus());
            row.put("verifyStatus", m.getVerifyStatus());
            row.put("verifyTime", m.getVerifyTime());
            row.put("createdAt", m.getCreatedAt());
            row.put("memberCount", userMerchantMapper.selectCount(
                    new LambdaQueryWrapper<UserMerchantEntity>()
                            .eq(UserMerchantEntity::getMerchantId, m.getId())));
            rows.add(row);
        }
        return ApiResponse.ok(PageResult.of(rows, page.getTotal(), pageNum, pageSize));
    }

    /** 组织详情：主体档案 + 成员 + 资质 + 认证申请。 */
    @GetMapping("/orgs/{id}")
    public ApiResponse<Map<String, Object>> orgDetail(@PathVariable Long id) {
        MerchantEntity merchant = merchantMapper.selectById(id);
        if (merchant == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "组织不存在");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("org", merchant);

        List<UserMerchantEntity> links = userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>().eq(UserMerchantEntity::getMerchantId, id));
        List<Map<String, Object>> members = new ArrayList<>();
        for (UserMerchantEntity link : links) {
            UserEntity user = userMapper.selectById(link.getUserId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("userId", String.valueOf(link.getUserId()));
            row.put("username", user == null ? null : user.getUsername());
            row.put("nickname", user == null ? null : user.getNickname());
            row.put("phone", user == null ? null : maskPhone(user.getPhone()));
            row.put("roleInMerchant", link.getRoleInMerchant());
            row.put("status", link.getStatus());
            row.put("joinedAt", link.getCreatedAt());
            members.add(row);
        }
        result.put("members", members);

        result.put("certifications", certificationMapper.selectList(
                new LambdaQueryWrapper<MerchantCertificationEntity>()
                        .eq(MerchantCertificationEntity::getMerchantId, id)
                        .orderByDesc(MerchantCertificationEntity::getId)));

        result.put("applications", identityApplicationMapper.selectList(
                new LambdaQueryWrapper<IdentityApplicationEntity>()
                        .eq(IdentityApplicationEntity::getMerchantId, id)
                        .orderByDesc(IdentityApplicationEntity::getId)));
        return ApiResponse.ok(result);
    }

    // ==================== 安全 ====================

    /**
     * 安全风险监控。
     *
     * <p>风险事件不是单独一张表，而是从 {@code platform_user_operation_log} 的
     * 「失败登录 / 异常 IP / 高频授权」聚合出来的。理由：真要做风控引擎会有独立的事件流，
     * 现在只有登录日志，硬造一张 risk 表只会得到一堆假数据。</p>
     */
    @GetMapping("/security/risks")
    public ApiResponse<Map<String, Object>> risks(@RequestParam(defaultValue = "7") int days) {
        int span = Math.min(Math.max(days, 1), 30);
        LocalDateTime from = LocalDate.now().minusDays(span - 1L).atStartOfDay();

        List<Map<String, Object>> actionResults = statsMapper.actionResultCount(from);
        long failed = 0;
        long success = 0;
        for (Map<String, Object> row : actionResults) {
            long c = row.get("c") == null ? 0 : ((Number) row.get("c")).longValue();
            if ("fail".equals(String.valueOf(row.get("result")))) {
                failed += c;
            } else {
                success += c;
            }
        }

        List<Map<String, Object>> topIp = statsMapper.failedLoginByIp(from);

        List<Map<String, Object>> categories = new ArrayList<>();
        categories.add(riskCategory("credential", "登录失败/撞库", failed,
                "失败 " + failed + " 次 · 涉及 IP " + topIp.size() + " 个"));
        long revoke = privacyRequestMapper.selectCount(new LambdaQueryWrapper<PrivacyRequestEntity>()
                .ge(PrivacyRequestEntity::getCreatedAt, from));
        categories.add(riskCategory("privacy", "隐私请求", revoke, "窗口期内 " + revoke + " 件"));
        long frozen = freezeMapper.selectCount(new LambdaQueryWrapper<AccountFreezeEntity>()
                .ge(AccountFreezeEntity::getCreatedAt, from));
        categories.add(riskCategory("freeze", "账号冻结", frozen, "窗口期内新增 " + frozen + " 个"));
        long certFail = certificationMapper.selectCount(new LambdaQueryWrapper<MerchantCertificationEntity>()
                .eq(MerchantCertificationEntity::getCertStatus, "rejected"));
        categories.add(riskCategory("cert", "资质驳回", certFail, "累计驳回 " + certFail + " 件"));

        // 等级：失败登录按量粗分。阈值写死是因为当前没有真实的风控阈值配置源，
        // 与其假装"可配置"，不如把口径写清楚。
        List<Map<String, Object>> severity = new ArrayList<>();
        severity.add(Map.of("level", "high", "label", "高危", "count", failed >= 20 ? failed / 2 : 0));
        severity.add(Map.of("level", "medium", "label", "中危", "count", failed - (failed >= 20 ? failed / 2 : 0)));
        severity.add(Map.of("level", "low", "label", "低危", "count", certFail + frozen));

        List<String> labels = new ArrayList<>();
        for (int i = 0; i < span; i++) {
            labels.add(LocalDate.now().minusDays(span - 1L - i).toString());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", failed + revoke + frozen + certFail);
        result.put("handled", success);
        result.put("pending", failed);
        result.put("categories", categories);
        result.put("severity", severity);
        result.put("topIp", topIp);
        result.put("trend", Map.of(
                "labels", labels,
                "loginFail", fillSeries(labels, statsMapper.countLogsByDay(from, "login"))));
        return ApiResponse.ok(result);
    }

    private Map<String, Object> riskCategory(String key, String label, long count, String detail) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("key", key);
        row.put("label", label);
        row.put("count", count);
        row.put("detail", detail);
        return row;
    }

    /**
     * 设备与登录日志。
     *
     * <p>直接读 {@code platform_user_operation_log}，不另建表 —— 用户端的「登录设备」
     * 本来就是从这张表读的，运营端换一套口径会出现"用户说被踢了、运营看不到记录"。</p>
     */
    @GetMapping("/security/device-logs")
    public ApiResponse<PageResult<Map<String, Object>>> deviceLogs(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String result) {

        LambdaQueryWrapper<UserOperationLogEntity> wrapper = new LambdaQueryWrapper<UserOperationLogEntity>()
                .and(hasText(keyword), w -> w.like(UserOperationLogEntity::getAction, keyword)
                        .or().like(UserOperationLogEntity::getIp, keyword)
                        .or().like(UserOperationLogEntity::getUserAgent, keyword))
                .eq(hasText(result), UserOperationLogEntity::getResult, result)
                .orderByDesc(UserOperationLogEntity::getId);

        Page<UserOperationLogEntity> page = operationLogMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserOperationLogEntity log : page.getRecords()) {
            UserEntity user = userMapper.selectById(log.getUserId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(log.getId()));
            row.put("userId", String.valueOf(log.getUserId()));
            row.put("username", user == null ? null : user.getUsername());
            row.put("action", log.getAction());
            row.put("actionLabel", log.getActionLabel());
            row.put("ip", log.getIp());
            row.put("device", deviceOf(log.getUserAgent()));
            row.put("userAgent", log.getUserAgent());
            row.put("result", log.getResult());
            row.put("createdAt", log.getCreatedAt());
            rows.add(row);
        }
        return ApiResponse.ok(PageResult.of(rows, page.getTotal(), pageNum, pageSize));
    }

    /** 从 UA 里粗提端类型。没有 UA 时不猜，直接给「未知端」。 */
    private String deviceOf(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) {
            return "未知端";
        }
        String ua = userAgent.toLowerCase();
        if (ua.contains("micromessenger")) {
            return "微信内";
        }
        if (ua.contains("miniprogram") || ua.contains("wechat")) {
            return "微信小程序";
        }
        if (ua.contains("android")) {
            return "Android";
        }
        if (ua.contains("iphone") || ua.contains("ipad")) {
            return "iOS";
        }
        if (ua.contains("curl") || ua.contains("postman") || ua.contains("okhttp")) {
            return "接口调用";
        }
        return "浏览器";
    }

    // ==================== 操作审计 ====================

    /**
     * 操作审计：管理员动作流水。
     *
     * <p>与「设备与登录日志」读同一张表，但视角不同：这里看的是**谁改了什么**，
     * 不关心登录。筛选条件按动作编码前缀，方便直接筛"审核类"。
     * 标注了不可篡改，实际是**只读视图**——本控制器没有任何删除/修改日志的接口。</p>
     */
    @GetMapping("/audit-logs")
    public ApiResponse<PageResult<Map<String, Object>>> auditLogs(
            @RequestParam(defaultValue = "1") long pageNum,
            @RequestParam(defaultValue = "20") long pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String actionPrefix) {

        LambdaQueryWrapper<UserOperationLogEntity> wrapper = new LambdaQueryWrapper<UserOperationLogEntity>()
                .and(hasText(keyword), w -> w.like(UserOperationLogEntity::getActionLabel, keyword)
                        .or().like(UserOperationLogEntity::getTarget, keyword)
                        .or().like(UserOperationLogEntity::getDetail, keyword))
                .likeRight(hasText(actionPrefix), UserOperationLogEntity::getAction, actionPrefix)
                .orderByDesc(UserOperationLogEntity::getId);

        Page<UserOperationLogEntity> page = operationLogMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (UserOperationLogEntity log : page.getRecords()) {
            UserEntity user = userMapper.selectById(log.getUserId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", String.valueOf(log.getId()));
            row.put("operator", user == null ? "系统" : (user.getNickname() == null
                    ? user.getUsername() : user.getNickname()));
            row.put("action", log.getAction());
            row.put("actionLabel", log.getActionLabel());
            row.put("target", log.getTarget());
            row.put("detail", log.getDetail());
            row.put("ip", log.getIp());
            row.put("result", log.getResult());
            row.put("createdAt", log.getCreatedAt());
            rows.add(row);
        }
        return ApiResponse.ok(PageResult.of(rows, page.getTotal(), pageNum, pageSize));
    }

    // ==================== 统计分析 ====================

    /** 用户统计分析：周期内的注册/实名/组织趋势 + 身份与地区分布。 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats(@RequestParam(defaultValue = "30") int days) {
        int span = Math.min(Math.max(days, 7), 365);
        LocalDateTime from = LocalDate.now().minusDays(span - 1L).atStartOfDay();

        List<String> labels = new ArrayList<>();
        for (int i = 0; i < span; i++) {
            labels.add(LocalDate.now().minusDays(span - 1L - i).toString());
        }
        List<Long> register = fillSeries(labels, statsMapper.countUsersByDay(from));
        List<Long> realname = fillSeries(labels, statsMapper.countIdentitiesByDay(from));
        List<Long> org = fillSeries(labels, statsMapper.countMerchantsByDay(from));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("range", Map.of("from", from.toLocalDate().toString(),
                "to", LocalDate.now().toString(), "days", span));
        result.put("trend", Map.of("labels", labels, "register", register,
                "realname", realname, "org", org));
        result.put("summary", Map.of(
                "register", register.stream().mapToLong(Long::longValue).sum(),
                "realname", realname.stream().mapToLong(Long::longValue).sum(),
                "org", org.stream().mapToLong(Long::longValue).sum()));
        result.put("roles", statsMapper.roleDistribution());
        result.put("orgTypes", statsMapper.merchantTypeDistribution());
        result.put("orgVerify", statsMapper.merchantVerifyDistribution());
        result.put("regions", statsMapper.merchantRegionDistribution());
        return ApiResponse.ok(result);
    }

    // ==================== 工具 ====================

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    /** 手机号脱敏：运营端列表页不需要完整号码，详情页再按需展示。 */
    private static String maskPhone(String phone) {
        if (phone == null || phone.length() < 7) {
            return phone;
        }
        return phone.substring(0, 3) + "****" + phone.substring(phone.length() - 4);
    }

    private static Long currentOperatorId() {
        return com.agri.core.infra.web.MarketContext.currentUserId();
    }

    /** 预留：按身份类型排序时用，避免 Map 无序导致前端每次顺序不同。 */
    @SuppressWarnings("unused")
    private static <T> Comparator<T> stable() {
        return (a, b) -> 0;
    }
}
