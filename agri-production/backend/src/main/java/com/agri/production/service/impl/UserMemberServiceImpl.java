package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.TeamMember;
import com.agri.production.mapper.TeamMemberMapper;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.IUserMemberService;
import com.agri.production.service.ProductionRoleService;
import com.agri.production.vo.UserMemberVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 用户端团队与人员实现。
 *
 * <p>租户由控制器传入，本类只负责查询与字段校验。</p>
 */
@Slf4j
@Service
public class UserMemberServiceImpl implements IUserMemberService {

    /** 成员类型白名单（与平台侧 prod_member 的取值一致） */
    private static final List<String> MEMBER_TYPES = List.of("OWNER", "AGRONOMIST", "INSPECTOR", "OPERATOR");
    private static final List<Integer> STATUSES = List.of(0, 1, 2);
    private static final int STATUS_ACTIVE = 1;
    private static final int STATUS_PENDING = 2;
    private static final int NAME_MAX_LENGTH = 50;
    private static final int POST_MAX_LENGTH = 50;
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final TeamMemberMapper memberMapper;
    private final FarmIdResolver farmIdResolver;
    private final ProductionRoleService roleService;

    public UserMemberServiceImpl(TeamMemberMapper memberMapper, FarmIdResolver farmIdResolver,
                                 ProductionRoleService roleService) {
        this.memberMapper = memberMapper;
        this.farmIdResolver = farmIdResolver;
        this.roleService = roleService;
    }

    @Override
    public PageResult<UserMemberVO> page(int pageNum, int pageSize, String tenantId, String keyword, Integer status,
                                        String farmId) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<TeamMember> w = baseWrapper(tenantId);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(TeamMember::getMemberName, kw).or().like(TeamMember::getPhone, kw));
        }
        if (status != null) {
            w.eq(TeamMember::getStatus, status);
        }
        if (farmId != null && !farmId.isBlank()) {
            // 页面传回来的 farmId 是"当前农场"的编号，而它来自仍然留在平台侧的 /farms 段
            // （形如 DEMO-FARM-001）；本表存的是本服务农场主键（'1'）。不换算的话过滤条件
            // 一个也匹配不上 —— 实测页面表现为"暂无数据"，而接口直连（不带 farmId）返回 12 条，
            // 探针脚本也照不出问题：它本来就不传 farmId。这类跨库标识只有真开页面才看得见。
            String localFarmId = localFarmId(farmId, tenantId);
            w.eq(TeamMember::getFarmId, localFarmId);
        }
        // 在职优先、再按加入日期倒序；最后用编号兜底，避免同一天的成员在分页之间串
        w.orderByDesc(TeamMember::getStatus).orderByDesc(TeamMember::getJoinDate)
                .orderByAsc(TeamMember::getMemberId);
        Page<TeamMember> page = memberMapper.selectPage(new Page<>(p, s), w);
        List<UserMemberVO> rows = page.getRecords().stream().map(UserMemberVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public String create(String tenantId, MemberPayload payload) {
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        String name = requireText(payload.memberName(), "姓名", NAME_MAX_LENGTH);
        String phone = requirePhone(payload.phone());
        String memberType = normalizeMemberType(payload.memberType());
        String postName = optionalText(payload.postName(), "岗位", POST_MAX_LENGTH);
        roleService.requireRoleCode(tenantId, payload.roleCode());
        LocalDate joinDate = parseDate(payload.joinDate(), "加入日期");
        Integer status = payload.status() == null ? STATUS_ACTIVE : requireStatus(payload.status());

        TeamMember member = new TeamMember();
        member.setMemberId("MEM" + LocalDateTime.now().format(ID_FORMAT));
        member.setTenantId(tenantId);
        member.setMemberName(name);
        member.setPhone(phone);
        member.setMemberType(memberType);
        member.setPostName(postName);
        member.setRoleCode(optionalText(payload.roleCode(), "角色编码", 32));
        // 同样换算：页面新增/邀请时带的也是平台侧农场编号（DEMO-FARM-xxx），
        // 原样存进去就会与"按本地主键过滤"的列表查询自相矛盾（建完立刻查不到）。
        String farmIdRaw = trimToNull(payload.farmId());
        member.setFarmId(farmIdRaw == null ? null : localFarmId(farmIdRaw, tenantId));
        member.setUserId(trimToNull(payload.userId()));
        member.setJoinDate(joinDate == null ? LocalDate.now() : joinDate);
        member.setStatus(status);
        memberMapper.insert(member);
        log.info("团队成员新增：{}（{} / {}）", member.getMemberId(), name, status == STATUS_PENDING ? "待激活" : "在职");
        return member.getMemberId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserMemberVO update(String tenantId, String memberId, MemberPayload payload) {
        if (payload == null) {
            throw new BusinessException(400, "请求体不能为空");
        }
        TeamMember member = requireMember(tenantId, memberId);
        if (payload.memberName() != null) {
            member.setMemberName(requireText(payload.memberName(), "姓名", NAME_MAX_LENGTH));
        }
        if (payload.phone() != null) {
            member.setPhone(requirePhone(payload.phone()));
        }
        if (payload.memberType() != null) {
            member.setMemberType(normalizeMemberType(payload.memberType()));
        }
        if (payload.postName() != null) {
            member.setPostName(optionalText(payload.postName(), "岗位", POST_MAX_LENGTH));
        }
        if (payload.roleCode() != null) {
            roleService.requireRoleCode(tenantId, payload.roleCode());
            member.setRoleCode(optionalText(payload.roleCode(), "角色编码", 32));
        }
        if (payload.joinDate() != null) {
            LocalDate joinDate = parseDate(payload.joinDate(), "加入日期");
            if (joinDate != null) {
                member.setJoinDate(joinDate);
            }
        }
        if (payload.status() != null) {
            member.setStatus(requireStatus(payload.status()));
        }
        member.setUpdateTime(LocalDateTime.now());
        memberMapper.updateById(member);
        log.info("团队成员更新：{} → 状态 {}", member.getMemberId(), member.getStatus());
        return UserMemberVO.of(memberMapper.selectById(member.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, String memberId) {
        TeamMember member = requireMember(tenantId, memberId);
        memberMapper.deleteById(member.getId());
        log.info("团队成员移除：{}", member.getMemberId());
    }

    @Override
    public List<Map<String, Object>> roleHeadcount(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法统计角色人数");
        }
        // 分组统计放 SQL 里做：成员表在真实规模下是几千行，拉到内存再 group 只是把问题往后挪
        QueryWrapper<TeamMember> w = new QueryWrapper<>();
        w.select("role_code", "count(*) as memberCount")
                .eq("tenant_id", tenantId)
                .eq("status", STATUS_ACTIVE)
                .isNotNull("role_code")
                .ne("role_code", "")
                .groupBy("role_code")
                .orderByAsc("role_code");
        List<Map<String, Object>> rows = memberMapper.selectMaps(w);
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("roleCode", row.get("role_code") == null ? row.get("roleCode") : row.get("role_code"));
            Object count = row.containsKey("memberCount") ? row.get("memberCount") : row.get("membercount");
            item.put("memberCount", count == null ? 0 : ((Number) count).intValue());
            result.add(item);
        }
        return result;
    }

    @Override
    public List<Map<String, Object>> roleCatalog(String tenantId) {
        List<Map<String, Object>> headcount = roleHeadcount(tenantId);
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (Map<String, Object> row : headcount) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("roleCode", row.get("roleCode"));
            // 角色名称的权威数据在平台域，本服务不持有 —— 留空，不拿编码冒充名称
            item.put("roleName", null);
            item.put("memberCount", row.get("memberCount"));
            item.put("source", "tenant-members");
            result.add(item);
        }
        result.sort((a, b) -> Integer.compare(((Number) b.get("memberCount")).intValue(),
                ((Number) a.get("memberCount")).intValue()));
        return result;
    }

    /* ==================== 内部工具 ==================== */

    /**
     * 把前端传来的农场编号换算成本服务农场主键的字符串形式。
     *
     * <p>换算由 {@link FarmIdResolver} 承担（接受数字主键、农场编码、平台侧 DEMO-FARM-xxx）；
     * 换算不出来时它会抛 400 并说明收到的是什么，而不是把过滤条件悄悄丢掉。</p>
     */
    private String localFarmId(String rawFarmId, String tenantId) {
        Long resolved = farmIdResolver.resolveFilter(rawFarmId, tenantId);
        return resolved == null ? null : String.valueOf(resolved);
    }

    private LambdaQueryWrapper<TeamMember> baseWrapper(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法查询成员");
        }
        return new LambdaQueryWrapper<TeamMember>().eq(TeamMember::getTenantId, tenantId);
    }

    private TeamMember requireMember(String tenantId, String memberId) {
        if (memberId == null || memberId.isBlank()) {
            throw new BusinessException(400, "缺少成员编号");
        }
        TeamMember member = memberMapper.selectOne(baseWrapper(tenantId)
                .eq(TeamMember::getMemberId, memberId.trim())
                .last("LIMIT 1"));
        if (member == null) {
            throw new BusinessException(404, "成员不存在：" + memberId.trim());
        }
        return member;
    }

    private String requireText(String value, String field, int maxLength) {
        String trimmed = trimToNull(value);
        if (trimmed == null) {
            throw new BusinessException(400, field + "为必填");
        }
        if (trimmed.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return trimmed;
    }

    private String optionalText(String value, String field, int maxLength) {
        String trimmed = trimToNull(value);
        if (trimmed != null && trimmed.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return trimmed;
    }

    /**
     * 手机号校验。
     *
     * <p>只校验"11 位数字、以 1 开头"这种最低限度，不做过严的正则：这是演示/内部系统，
     * 太严会把座机、境外号全挡在外面，而机构类型恰恰会用座机。但**必须校验**它不是
     * 一个手机号字段里塞的姓名 —— 成员列表的手机号列是给人打电话用的。</p>
     */
    private String requirePhone(String value) {
        String phone = requireText(value, "手机号", 20);
        if (!phone.matches("^\\d[\\d-]{5,19}$")) {
            throw new BusinessException(400, "手机号格式不正确：" + phone);
        }
        return phone;
    }

    private String normalizeMemberType(String value) {
        String type = trimToNull(value);
        if (type == null) {
            // 不传类型时按"操作员"入库：这是权限最小的那一种，给大了才是问题
            return "OPERATOR";
        }
        String upper = type.toUpperCase();
        if (!MEMBER_TYPES.contains(upper)) {
            throw new BusinessException(400, "成员类型应为 OWNER / AGRONOMIST / INSPECTOR / OPERATOR：" + type);
        }
        return upper;
    }

    private Integer requireStatus(Integer status) {
        if (!STATUSES.contains(status)) {
            throw new BusinessException(400, "成员状态应为 1 在职 / 2 待激活 / 0 已停用：" + status);
        }
        return status;
    }

    private LocalDate parseDate(String text, String field) {
        String trimmed = trimToNull(text);
        if (trimmed == null) {
            return null;
        }
        try {
            return LocalDate.parse(trimmed);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + "格式应为 yyyy-MM-dd：" + trimmed);
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
