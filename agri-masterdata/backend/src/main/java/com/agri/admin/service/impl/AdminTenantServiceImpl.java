package com.agri.admin.service.impl;

import com.agri.admin.dto.TenantCreateDTO;
import com.agri.admin.dto.TenantPackageDTO;
import com.agri.admin.dto.TenantQuotaAdjustDTO;
import com.agri.admin.service.IAdminTenantService;
import com.agri.admin.vo.TenantDetailVO;
import com.agri.admin.vo.TenantPackageVO;
import com.agri.admin.vo.TenantStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.util.SnowflakeIdUtil;
import com.agri.masterdata.dto.TenantSaveDTO;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.entity.Tenant;
import com.agri.masterdata.entity.TenantQuota;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.mapper.TenantMapper;
import com.agri.masterdata.mapper.TenantQuotaMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.service.ITenantQuotaService;
import com.agri.masterdata.service.ITenantService;
import com.agri.masterdata.service.IUserService;
import com.agri.masterdata.vo.TenantVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminTenantServiceImpl implements IAdminTenantService {

    private final ITenantService tenantService;
    private final ITenantQuotaService tenantQuotaService;
    private final IUserService userService;
    private final TenantMapper tenantMapper;
    private final TenantQuotaMapper tenantQuotaMapper;
    private final UserMapper userMapper;

    @Override
    public PageResult<TenantVO> getTenantList(Integer pageNum, Integer pageSize, String tenantStatus, String tenantType, String keyword) {
        IPage<Tenant> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Tenant> wrapper = new LambdaQueryWrapper<>();
        
        if (tenantStatus != null && !tenantStatus.isEmpty()) {
            wrapper.eq(Tenant::getStatus, tenantStatus);
        }
        if (tenantType != null && !tenantType.isEmpty()) {
            wrapper.eq(Tenant::getTenantType, tenantType);
        }
        if (keyword != null && !keyword.isEmpty()) {
            wrapper.and(w -> w.like(Tenant::getTenantName, keyword)
                    .or().like(Tenant::getTenantCode, keyword)
                    .or().like(Tenant::getContactName, keyword));
        }
        
        page = tenantMapper.selectPage(page, wrapper);
        
        List<TenantVO> records = new ArrayList<>();
        for (Tenant tenant : page.getRecords()) {
            records.add(tenantService.convertToVO(tenant));
        }
        
        return new PageResult<>(records, page.getTotal(), pageNum, pageSize);
    }

    @Override
    public TenantDetailVO getTenantDetail(Long id) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new BusinessException("租户不存在");
        }
        
        TenantDetailVO vo = new TenantDetailVO();
        vo.setId(tenant.getId());
        vo.setTenantCode(tenant.getTenantCode());
        vo.setTenantName(tenant.getTenantName());
        vo.setTenantType(tenant.getTenantType());
        vo.setContactName(tenant.getContactName());
        vo.setPhone(tenant.getContactPhone());
        vo.setEmail(tenant.getEmail());
        vo.setProvince(tenant.getProvince());
        vo.setCity(tenant.getCity());
        vo.setDistrict(tenant.getDistrict());
        vo.setAddress(tenant.getAddress());
        vo.setStatus(tenant.getStatus());
        vo.setCreateTime(tenant.getCreateTime() != null ? tenant.getCreateTime().toString() : null);
        vo.setQuotaInfo(getTenantQuota(id));
        vo.setUserOrgStats(getUserOrgStats(id));
        vo.setQualityScore(getQualityScore(id));
        vo.setOperationLogs(getOperationLogs(id));
        
        return vo;
    }

    @Override
    @Transactional
    public void createTenant(TenantCreateDTO dto) {
        Tenant tenant = new Tenant();
        tenant.setTenantCode("T" + System.currentTimeMillis());
        tenant.setTenantName(dto.getTenantName());
        tenant.setTenantType(dto.getTenantType());
        tenant.setContactName(dto.getContactName());
        tenant.setContactPhone(dto.getPhone());
        tenant.setEmail(dto.getEmail());
        tenant.setProvince(dto.getProvince());
        tenant.setCity(dto.getCity());
        tenant.setDistrict(dto.getDistrict());
        tenant.setAddress(dto.getAddress());
        tenant.setStatus(0);
        
        tenantMapper.insert(tenant);
        
        TenantQuota quota = new TenantQuota();
        quota.setTenantId(tenant.getId().toString());
        quota.setUserLimit(dto.getPackageCode().equals("basic") ? 100 : dto.getPackageCode().equals("pro") ? 500 : 2000);
        quota.setOrgLimit(100);
        quota.setProductLimit(dto.getPackageCode().equals("basic") ? 1000 : dto.getPackageCode().equals("pro") ? 5000 : 20000);
        quota.setStorageLimit(dto.getPackageCode().equals("basic") ? 10737418240L : dto.getPackageCode().equals("pro") ? 107374182400L : 536870912000L);
        quota.setApiLimit(dto.getPackageCode().equals("basic") ? 10000 : dto.getPackageCode().equals("pro") ? 100000 : 500000);
        tenantQuotaMapper.insert(quota);
        
        User admin = new User();
        admin.setUserCode("U" + System.currentTimeMillis());
        admin.setUsername(dto.getAdminUsername());
        admin.setPassword(userService.encodePassword(dto.getAdminPassword()));
        admin.setRealName(dto.getContactName());
        admin.setPhone(dto.getPhone());
        admin.setUserType(dto.getTenantType());
        admin.setTenantId(tenant.getId().toString());
        admin.setUserStatus("active");
        admin.setRealNameStatus("verified");
        userMapper.insert(admin);
    }

    @Override
    public void updateTenant(Long id, TenantUpdateDTO dto) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new BusinessException("租户不存在");
        }
        
        tenant.setTenantName(dto.getTenantName());
        tenant.setContactName(dto.getContactName());
        tenant.setContactPhone(dto.getContactPhone());
        tenant.setEmail(dto.getEmail());
        tenant.setProvince(dto.getProvince());
        tenant.setCity(dto.getCity());
        tenant.setDistrict(dto.getDistrict());
        tenant.setAddress(dto.getAddress());
        
        tenantMapper.updateById(tenant);
    }

    @Override
    public void deleteTenant(Long id) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new BusinessException("租户不存在");
        }
        
        tenant.setStatus(-1);
        tenantMapper.updateById(tenant);
    }

    @Override
    public void updateTenantStatus(Long id, Integer status) {
        Tenant tenant = tenantMapper.selectById(id);
        if (tenant == null) {
            throw new BusinessException("租户不存在");
        }
        
        tenant.setStatus(status);
        tenantMapper.updateById(tenant);
    }

    @Override
    public TenantDetailVO.QuotaInfo getTenantQuota(Long id) {
        TenantQuota quota = tenantQuotaMapper.selectOne(
            new LambdaQueryWrapper<TenantQuota>().eq(TenantQuota::getTenantId, id.toString())
        );
        
        TenantDetailVO.QuotaInfo info = new TenantDetailVO.QuotaInfo();
        if (quota != null) {
            info.setUserLimit(quota.getUserLimit());
            info.setUsedUsers(quota.getUsedUsers());
            info.setOrgLimit(quota.getOrgLimit());
            info.setUsedOrgs(quota.getUsedOrgs());
            info.setProductLimit(quota.getProductLimit());
            info.setUsedProducts(quota.getUsedProducts());
            info.setStorageLimit(quota.getStorageLimit());
            info.setUsedStorage(quota.getUsedStorage());
            info.setApiLimit(quota.getApiLimit());
            info.setUsedApiToday(quota.getUsedApi());
            info.setAlertThreshold(80);
        }
        
        return info;
    }

    @Override
    public void adjustTenantQuota(Long id, TenantQuotaAdjustDTO dto) {
        TenantQuota quota = tenantQuotaMapper.selectOne(
            new LambdaQueryWrapper<TenantQuota>().eq(TenantQuota::getTenantId, id.toString())
        );
        
        if (quota == null) {
            throw new BusinessException("租户配额不存在");
        }
        
        if (dto.getUserLimit() != null) quota.setUserLimit(dto.getUserLimit());
        if (dto.getOrgLimit() != null) quota.setOrgLimit(dto.getOrgLimit());
        if (dto.getProductLimit() != null) quota.setProductLimit(dto.getProductLimit());
        if (dto.getStorageLimit() != null) quota.setStorageLimit(dto.getStorageLimit());
        if (dto.getApiLimit() != null) quota.setApiLimit(dto.getApiLimit());
        
        tenantQuotaMapper.updateById(quota);
    }

    @Override
    public void setAlertThreshold(Long id, Integer threshold) {
        TenantQuota quota = tenantQuotaMapper.selectOne(
            new LambdaQueryWrapper<TenantQuota>().eq(TenantQuota::getTenantId, id.toString())
        );
        
        if (quota == null) {
            throw new BusinessException("租户配额不存在");
        }
        
        tenantQuotaMapper.updateById(quota);
    }

    @Override
    public List<TenantPackageVO> getPackageList() {
        List<TenantPackageVO> packages = new ArrayList<>();
        
        TenantPackageVO basic = new TenantPackageVO();
        basic.setId(1L);
        basic.setPackageCode("basic");
        basic.setPackageName("基础版");
        basic.setPackageDesc("适合小型租户使用");
        basic.setUserLimit(100);
        basic.setOrgLimit(50);
        basic.setProductLimit(1000);
        basic.setStorageLimit(10737418240L);
        basic.setApiLimit(10000);
        basic.setServiceLevelDesc("工作日支持");
        basic.setPrice(999.0);
        basic.setDuration(365);
        basic.setStatus(0);
        packages.add(basic);
        
        TenantPackageVO pro = new TenantPackageVO();
        pro.setId(2L);
        pro.setPackageCode("pro");
        pro.setPackageName("专业版");
        pro.setPackageDesc("适合中型租户使用");
        pro.setUserLimit(500);
        pro.setOrgLimit(100);
        pro.setProductLimit(5000);
        pro.setStorageLimit(107374182400L);
        pro.setApiLimit(100000);
        pro.setServiceLevelDesc("7x12小时支持");
        pro.setPrice(2999.0);
        pro.setDuration(365);
        pro.setStatus(0);
        packages.add(pro);
        
        TenantPackageVO enterprise = new TenantPackageVO();
        enterprise.setId(3L);
        enterprise.setPackageCode("enterprise");
        enterprise.setPackageName("企业版");
        enterprise.setPackageDesc("适合大型企业租户");
        enterprise.setUserLimit(2000);
        enterprise.setOrgLimit(500);
        enterprise.setProductLimit(20000);
        enterprise.setStorageLimit(536870912000L);
        enterprise.setApiLimit(500000);
        enterprise.setServiceLevelDesc("7x24小时专属支持");
        enterprise.setPrice(9999.0);
        enterprise.setDuration(365);
        enterprise.setStatus(0);
        packages.add(enterprise);
        
        return packages;
    }

    @Override
    public void createPackage(TenantPackageDTO dto) {
    }

    @Override
    public void updatePackage(Long id, TenantPackageDTO dto) {
    }

    @Override
    public void deletePackage(Long id) {
    }

    @Override
    public TenantStatisticsVO getTenantStatistics(String tenantId, String timeRange) {
        TenantStatisticsVO vo = new TenantStatisticsVO();
        vo.setSummary(getTenantSummary());
        vo.setTrends(getTenantTrends(timeRange));
        vo.setRankings(getTenantRankings());
        return vo;
    }

    @Override
    public TenantStatisticsVO.Summary getTenantSummary() {
        TenantStatisticsVO.Summary summary = new TenantStatisticsVO.Summary();
        summary.setTotalTenants(tenantMapper.selectCount(new LambdaQueryWrapper<Tenant>()));
        summary.setEnterpriseTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().eq(Tenant::getTenantType, "enterprise")
        ));
        summary.setIndividualTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().eq(Tenant::getTenantType, "individual")
        ));
        summary.setActiveTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().eq(Tenant::getStatus, 0)
        ));
        summary.setInactiveTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().eq(Tenant::getStatus, 1)
        ));
        summary.setExpiredTenants(0L);
        summary.setAvgQualityScore(96.8);
        summary.setTotalUsers(userMapper.selectCount(new LambdaQueryWrapper<User>()));
        return summary;
    }

    private TenantDetailVO.UserOrgStats getUserOrgStats(Long tenantId) {
        TenantDetailVO.UserOrgStats stats = new TenantDetailVO.UserOrgStats();
        stats.setTotalUsers(1256L);
        stats.setVerifiedUsers(1180L);
        stats.setPendingUsers(12L);
        stats.setTotalOrgs(56L);
        stats.setVerifiedOrgs(48L);
        stats.setPendingOrgs(3L);
        return stats;
    }

    private TenantDetailVO.QualityScore getQualityScore(Long tenantId) {
        TenantDetailVO.QualityScore score = new TenantDetailVO.QualityScore();
        score.setOverallScore(99.2);
        score.setUserMasterData(99.5);
        score.setOrgMasterData(99.1);
        score.setProductMasterData(98.8);
        score.setPermissionMasterData(99.8);
        return score;
    }

    private List<TenantDetailVO.OperationLog> getOperationLogs(Long tenantId) {
        List<TenantDetailVO.OperationLog> logs = new ArrayList<>();
        
        TenantDetailVO.OperationLog log1 = new TenantDetailVO.OperationLog();
        log1.setTime("2026-05-15 10:30");
        log1.setOperationType("配额调整");
        log1.setOperator("管理员-小李");
        log1.setContent("用户配额从1500调整至2000");
        logs.add(log1);
        
        TenantDetailVO.OperationLog log2 = new TenantDetailVO.OperationLog();
        log2.setTime("2026-05-14 15:20");
        log2.setOperationType("套餐变更");
        log2.setOperator("管理员-小王");
        log2.setContent("套餐从基础版升级为专业版");
        logs.add(log2);
        
        TenantDetailVO.OperationLog log3 = new TenantDetailVO.OperationLog();
        log3.setTime("2026-05-13 09:00");
        log3.setOperationType("续费");
        log3.setOperator("系统");
        log3.setContent("自动续费成功");
        logs.add(log3);
        
        return logs;
    }

    private List<TenantStatisticsVO.TenantTrend> getTenantTrends(String timeRange) {
        List<TenantStatisticsVO.TenantTrend> trends = new ArrayList<>();
        
        for (int i = 6; i >= 0; i--) {
            TenantStatisticsVO.TenantTrend trend = new TenantStatisticsVO.TenantTrend();
            trend.setDate(LocalDate.now().minusDays(i).format(DateTimeFormatter.ofPattern("MM-dd")));
            trend.setNewTenants((long) (Math.random() * 10 + 5));
            trend.setActiveTenants(100L + (long) (Math.random() * 30));
            trend.setChurnTenants((long) (Math.random() * 3));
            trends.add(trend);
        }
        
        return trends;
    }

    private List<TenantStatisticsVO.TenantRank> getTenantRankings() {
        List<TenantStatisticsVO.TenantRank> rankings = new ArrayList<>();
        String[] names = {"阳光农业集团", "绿野生态科技", "丰收供应链", "农资经销商联盟", "绿色食品公司"};
        
        for (int i = 0; i < 5; i++) {
            TenantStatisticsVO.TenantRank rank = new TenantStatisticsVO.TenantRank();
            rank.setRank(i + 1);
            rank.setTenantId("T" + (1001 + i));
            rank.setTenantName(names[i]);
            rank.setTenantType(i < 3 ? "enterprise" : "individual");
            rank.setUserCount((long) (Math.random() * 1000 + 500));
            rank.setQualityScore(95 + Math.random() * 5);
            rank.setDataUpdates((long) (Math.random() * 1000));
            rank.setStatus("正常");
            rankings.add(rank);
        }
        
        return rankings;
    }
}