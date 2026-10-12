package com.agri.admin.service.impl;

import com.agri.admin.service.IDashboardService;
import com.agri.admin.vo.DashboardVO;
import com.agri.admin.vo.HealthDashboardVO;
import com.agri.admin.vo.TenantActivityVO;
import com.agri.masterdata.entity.*;
import com.agri.masterdata.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DashboardServiceImpl implements IDashboardService {

    private final TenantMapper tenantMapper;
    private final UserMapper userMapper;
    private final OrganizationMapper organizationMapper;
    private final UserAuthenticationMapper userAuthenticationMapper;

    @Override
    public DashboardVO getDashboard(String timeRange) {
        DashboardVO vo = new DashboardVO();
        
        vo.setCoreMetrics(getCoreMetrics());
        vo.setDistributionStatus(getDistributionStatus());
        vo.setAlerts(getAlerts(5));
        vo.setPendingAudit(getPendingAudit());
        vo.setQualityDistribution(getQualityDistribution());
        
        return vo;
    }

    @Override
    public HealthDashboardVO getHealthDashboard() {
        HealthDashboardVO vo = new HealthDashboardVO();
        
        vo.setOverallScore(96.8);
        
        List<HealthDashboardVO.DomainScore> domainScores = new ArrayList<>();
        domainScores.add(createDomainScore("用户主数据", "user", 98.5, 3));
        domainScores.add(createDomainScore("组织主数据", "org", 97.2, 5));
        domainScores.add(createDomainScore("商品主数据", "product", 96.1, 8));
        domainScores.add(createDomainScore("权限主数据", "permission", 99.2, 1));
        domainScores.add(createDomainScore("客户供应商", "customer", 95.8, 6));
        vo.setDomainScores(domainScores);
        
        List<HealthDashboardVO.ScoreTrend> trends = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            HealthDashboardVO.ScoreTrend trend = new HealthDashboardVO.ScoreTrend();
            trend.setDate(LocalDate.now().minusDays(i).format(DateTimeFormatter.ofPattern("MM-dd")));
            trend.setScore(96.0 + Math.random() * 2);
            trends.add(trend);
        }
        vo.setScoreTrends(trends);
        
        List<HealthDashboardVO.QualityIssue> issues = new ArrayList<>();
        issues.add(createQualityIssue("数据重复", "用户主数据", "发现重复身份证号", "中等", 5L));
        issues.add(createQualityIssue("格式错误", "商品主数据", "商品编码格式不符合规范", "低", 12L));
        issues.add(createQualityIssue("数据缺失", "组织主数据", "部分组织缺少营业执照信息", "高", 3L));
        vo.setTopIssues(issues);
        
        HealthDashboardVO.DataFreshness freshness = new HealthDashboardVO.DataFreshness();
        freshness.setLastUpdateTime(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        freshness.setUpdateCountToday(1234L);
        freshness.setFreshnessRate(99.5);
        vo.setDataFreshness(freshness);
        
        return vo;
    }

    @Override
    public List<TenantActivityVO> getTenantActivity(Integer limit) {
        List<TenantActivityVO> result = new ArrayList<>();
        
        List<Tenant> tenants = tenantMapper.selectList(
            new LambdaQueryWrapper<Tenant>()
                .eq(Tenant::getStatus, 0)
                .orderByDesc(Tenant::getCreateTime)
                .last("LIMIT " + limit)
        );
        
        int rank = 1;
        for (Tenant tenant : tenants) {
            TenantActivityVO vo = new TenantActivityVO();
            vo.setRank(rank++);
            vo.setTenantId(tenant.getId().toString());
            vo.setTenantName(tenant.getTenantName());
            vo.setTenantType(tenant.getTenantType());
            vo.setUserCount((long) (Math.random() * 1000 + 100));
            vo.setQualityScore(95 + Math.random() * 5);
            vo.setDataUpdateCount((long) (Math.random() * 1000));
            result.add(vo);
        }
        
        return result;
    }

    @Override
    public List<DashboardVO.AlertItem> getAlerts(Integer limit) {
        List<DashboardVO.AlertItem> alerts = new ArrayList<>();
        
        alerts.add(createAlert("紧急", "租户配额预警", "租户T001用户配额使用达到95%", "T001", "阳光农业集团"));
        alerts.add(createAlert("重要", "认证即将过期", "用户U10056实名认证即将过期", "T002", "绿野生态科技"));
        alerts.add(createAlert("重要", "质量评分下降", "数据质量综合评分下降0.5%", null, null));
        alerts.add(createAlert("重要", "异常权限检测", "检测到互斥角色分配", "T003", "丰收供应链"));
        alerts.add(createAlert("一般", "存储预警", "租户T004存储空间使用达到80%", "T004", "农资经销商"));
        
        return alerts.size() > limit ? alerts.subList(0, limit) : alerts;
    }

    @Override
    public DashboardVO.PendingAudit getPendingAudit() {
        DashboardVO.PendingAudit audit = new DashboardVO.PendingAudit();
        
        audit.setUserCertCount(userAuthenticationMapper.selectCount(
            new LambdaQueryWrapper<UserAuthentication>()
                .eq(UserAuthentication::getAuthStatus, "pending")
        ));
        audit.setOrgCertCount(12L);
        audit.setStandardChangeCount(3L);
        audit.setQualityIssueCount(8L);
        
        return audit;
    }

    private DashboardVO.CoreMetrics getCoreMetrics() {
        DashboardVO.CoreMetrics metrics = new DashboardVO.CoreMetrics();
        
        metrics.setTenantCount(tenantMapper.selectCount(new LambdaQueryWrapper<Tenant>().eq(Tenant::getStatus, 0)));
        metrics.setUserCount(userMapper.selectCount(new LambdaQueryWrapper<User>().eq(User::getStatus, 0)));
        metrics.setOrgCount(organizationMapper.selectCount(new LambdaQueryWrapper<Organization>().eq(Organization::getStatus, 0)));
        metrics.setQualityScore(96.8);
        
        metrics.setTenantCountChange("↑5.2%");
        metrics.setUserCountChange("↑8.3%");
        metrics.setOrgCountChange("↑3.1%");
        metrics.setQualityScoreChange("↑0.5%");
        
        return metrics;
    }

    private DashboardVO.DistributionStatus getDistributionStatus() {
        DashboardVO.DistributionStatus status = new DashboardVO.DistributionStatus();
        status.setTodayDistribution(1234L);
        status.setSuccessRate(99.8);
        status.setAvgDelay(0.3);
        status.setFailedCount(2L);
        return status;
    }

    private DashboardVO.QualityDistribution getQualityDistribution() {
        DashboardVO.QualityDistribution dist = new DashboardVO.QualityDistribution();
        dist.setUserMasterData(98.0);
        dist.setOrgMasterData(97.0);
        dist.setProductMasterData(96.0);
        dist.setPermissionMasterData(99.0);
        dist.setCustomerSupplier(95.0);
        return dist;
    }

    private DashboardVO.AlertItem createAlert(String level, String title, String content, String tenantId, String tenantName) {
        DashboardVO.AlertItem alert = new DashboardVO.AlertItem();
        alert.setLevel(level);
        alert.setTitle(title);
        alert.setContent(content);
        alert.setTenantId(tenantId);
        alert.setTenantName(tenantName);
        alert.setCreateTime(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        return alert;
    }

    private HealthDashboardVO.DomainScore createDomainScore(String name, String code, Double score, Integer issues) {
        HealthDashboardVO.DomainScore ds = new HealthDashboardVO.DomainScore();
        ds.setDomainName(name);
        ds.setDomainCode(code);
        ds.setScore(score);
        ds.setIssueCount(issues);
        return ds;
    }

    private HealthDashboardVO.QualityIssue createQualityIssue(String type, String domain, String desc, String severity, Long count) {
        HealthDashboardVO.QualityIssue issue = new HealthDashboardVO.QualityIssue();
        issue.setIssueType(type);
        issue.setDomain(domain);
        issue.setDescription(desc);
        issue.setSeverity(severity);
        issue.setCount(count);
        return issue;
    }
}