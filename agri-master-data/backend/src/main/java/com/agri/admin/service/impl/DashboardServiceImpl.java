package com.agri.admin.service.impl;

import com.agri.admin.service.IDashboardService;
import com.agri.admin.vo.DashboardVO;
import com.agri.admin.vo.HealthDashboardVO;
import com.agri.admin.vo.TenantActivityVO;
import com.agri.common.enums.StatusEnum;
import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.entity.Tenant;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.entity.UserAuthentication;
import com.agri.masterdata.mapper.OrganizationMapper;
import com.agri.masterdata.mapper.TenantMapper;
import com.agri.masterdata.mapper.UserAuthenticationMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * 运营总览。
 *
 * <p><b>本类的核心约束：查不到就说没有，不编。</b></p>
 *
 * <p>改动前的实现里混了大量**没有数据来源却当成真值返回**的字段，其中两类尤其危险：</p>
 * <ul>
 *   <li><b>告警列表</b>：5 条写死的告警，`createTime` 取 `LocalDateTime.now()` ——
 *       前端拿到的是"刚刚发生"的真实时间戳，界面上完全看不出是假的；</li>
 *   <li><b>随机数</b>：租户活跃度里 `userCount` 用 `Math.random()*1000+100`、
 *       健康度趋势用 `Math.random()` 生成折线 —— 每次刷新数字都变，
 *       反而比写死更像"实时数据"。</li>
 * </ul>
 *
 * <p>现在：能查库的查库；没有数据来源的返回 <b>null</b> 或空集合，由前端显示"未接入/暂无"。
 * 这比返回一个看起来合理的数字要诚实 —— 后者会让人基于假数字做判断。</p>
 *
 * <p>顺带修掉一个真实的口径 bug：原来的统计条件写的是 `status = 0`，
 * 而 `StatusEnum` 里 <b>1 才是启用</b>（0 是禁用）。所以租户/用户/组织三个总数
 * 一直在统计"已禁用的条数"，库里有 1 个租户也照样显示 0。</p>
 */
@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements IDashboardService {

    private final TenantMapper tenantMapper;
    private final UserMapper userMapper;
    private final OrganizationMapper organizationMapper;
    private final UserAuthenticationMapper userAuthenticationMapper;

    /** 认证审核中状态值（与 UserAuthentication.authStatus 口径一致） */
    private static final String AUDIT_PENDING = "pending";

    @Override
    public DashboardVO getDashboard(String timeRange) {
        DashboardVO vo = new DashboardVO();
        vo.setCoreMetrics(getCoreMetrics());
        vo.setPendingAudit(getPendingAudit());
        vo.setAlerts(getAlerts(5));
        // 分发状态与数据质量分布目前**没有数据来源**（主数据域没有分发任务表、
        // 也没有质量评分表），返回 null 而不是编一组百分比。
        vo.setDistributionStatus(null);
        vo.setQualityDistribution(null);
        return vo;
    }

    @Override
    public HealthDashboardVO getHealthDashboard() {
        HealthDashboardVO vo = new HealthDashboardVO();
        // 健康度评分需要质量规则与检测结果，二者都未接入，故整体留空。
        vo.setOverallScore(null);
        vo.setDomainScores(Collections.emptyList());
        vo.setScoreTrends(Collections.emptyList());
        vo.setTopIssues(Collections.emptyList());
        vo.setDataFreshness(null);
        return vo;
    }

    @Override
    public List<TenantActivityVO> getTenantActivity(Integer limit) {
        int size = (limit == null || limit <= 0) ? 10 : limit;
        List<Tenant> tenants = tenantMapper.selectList(
                new LambdaQueryWrapper<Tenant>()
                        .eq(Tenant::getStatus, StatusEnum.ENABLE.getCode())
                        .orderByDesc(Tenant::getCreateTime)
                        .last("LIMIT " + size)
        );

        List<TenantActivityVO> result = new ArrayList<>();
        int rank = 1;
        for (Tenant tenant : tenants) {
            TenantActivityVO vo = new TenantActivityVO();
            vo.setRank(rank++);
            vo.setTenantId(tenant.getId() == null ? null : tenant.getId().toString());
            vo.setTenantName(tenant.getTenantName());
            vo.setTenantType(tenant.getTenantType());
            // 该租户下的启用用户数：真查库。
            vo.setUserCount(userMapper.selectCount(
                    new LambdaQueryWrapper<User>()
                            .eq(User::getTenantId, tenant.getTenantCode())
                            .eq(User::getStatus, StatusEnum.ENABLE.getCode())
            ));
            // 下面两项没有数据来源，明确留空；原来这里是 Math.random()。
            vo.setQualityScore(null);
            vo.setDataUpdateCount(null);
            result.add(vo);
        }
        return result;
    }

    @Override
    public List<DashboardVO.AlertItem> getAlerts(Integer limit) {
        // 告警需要监控/阈值规则作为来源，当前未接入。返回空列表，
        // 前端显示"暂无告警"—— 而不是 5 条带着当前时间戳的假告警。
        return Collections.emptyList();
    }

    @Override
    public DashboardVO.PendingAudit getPendingAudit() {
        DashboardVO.PendingAudit audit = new DashboardVO.PendingAudit();
        audit.setUserCertCount(userAuthenticationMapper.selectCount(
                new LambdaQueryWrapper<UserAuthentication>()
                        .eq(UserAuthentication::getAuthStatus, AUDIT_PENDING)
        ));
        audit.setOrgCertCount(organizationMapper.selectCount(
                new LambdaQueryWrapper<Organization>()
                        .eq(Organization::getAuthStatus, AUDIT_PENDING)
        ));
        // 标准变更申请与质量问题都还没有对应的表，留空而不是写死 3 / 8。
        audit.setStandardChangeCount(null);
        audit.setQualityIssueCount(null);
        return audit;
    }

    private DashboardVO.CoreMetrics getCoreMetrics() {
        DashboardVO.CoreMetrics metrics = new DashboardVO.CoreMetrics();
        metrics.setTenantCount(countEnabledTenants());
        metrics.setUserCount(countEnabledUsers());
        metrics.setOrgCount(countEnabledOrgs());
        // 质量评分与四个环比都没有数据来源（没有历史快照表，算不出环比），留空。
        metrics.setQualityScore(null);
        metrics.setTenantCountChange(null);
        metrics.setUserCountChange(null);
        metrics.setOrgCountChange(null);
        metrics.setQualityScoreChange(null);
        return metrics;
    }

    private Long countEnabledTenants() {
        return tenantMapper.selectCount(
                new LambdaQueryWrapper<Tenant>()
                        .eq(Tenant::getStatus, StatusEnum.ENABLE.getCode())
                        .eq(Tenant::getDelFlag, 0)
        );
    }

    private Long countEnabledUsers() {
        return userMapper.selectCount(
                new LambdaQueryWrapper<User>()
                        .eq(User::getStatus, StatusEnum.ENABLE.getCode())
                        .eq(User::getDelFlag, 0)
        );
    }

    private Long countEnabledOrgs() {
        return organizationMapper.selectCount(
                new LambdaQueryWrapper<Organization>()
                        .eq(Organization::getStatus, StatusEnum.ENABLE.getCode())
                        .eq(Organization::getDelFlag, 0)
        );
    }
}
