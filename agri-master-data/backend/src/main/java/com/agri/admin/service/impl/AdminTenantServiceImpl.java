package com.agri.admin.service.impl;

import com.agri.admin.dto.TenantCreateDTO;
import com.agri.admin.dto.TenantPackageDTO;
import com.agri.admin.dto.TenantQuotaAdjustDTO;
import com.agri.admin.service.IAdminTenantService;
import com.agri.admin.vo.TenantDetailVO;
import com.agri.admin.vo.TenantPackageVO;
import com.agri.admin.vo.TenantQuotaOverviewVO;
import com.agri.admin.vo.TenantStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.enums.StatusEnum;
import com.agri.common.exception.BusinessException;
import com.agri.common.util.SnowflakeIdUtil;
import com.agri.masterdata.dto.TenantSaveDTO;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.entity.OperationLog;
import com.agri.masterdata.entity.Organization;
import com.agri.masterdata.entity.Tenant;
import com.agri.masterdata.entity.TenantPackage;
import com.agri.masterdata.entity.TenantQuota;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.entity.UserAuthentication;
import com.agri.masterdata.mapper.OperationLogMapper;
import com.agri.masterdata.mapper.OrganizationMapper;
import com.agri.masterdata.mapper.TenantMapper;
import com.agri.masterdata.mapper.TenantPackageMapper;
import com.agri.masterdata.mapper.TenantQuotaMapper;
import com.agri.masterdata.mapper.UserAuthenticationMapper;
import com.agri.masterdata.mapper.UserMapper;
import com.agri.masterdata.service.ITenantQuotaService;
import com.agri.masterdata.service.ITenantService;
import com.agri.masterdata.service.IUserService;
import com.agri.masterdata.vo.TenantVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.core.toolkit.support.SFunction;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminTenantServiceImpl implements IAdminTenantService {

    private static final DateTimeFormatter DAY_FMT = DateTimeFormatter.ofPattern("MM-dd");
    private static final DateTimeFormatter MONTH_FMT = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final DateTimeFormatter OPERATION_LOG_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    private final ITenantService tenantService;
    private final ITenantQuotaService tenantQuotaService;
    private final IUserService userService;
    private final TenantMapper tenantMapper;
    private final TenantPackageMapper tenantPackageMapper;
    private final TenantQuotaMapper tenantQuotaMapper;
    private final UserMapper userMapper;
    private final OrganizationMapper organizationMapper;
    private final UserAuthenticationMapper userAuthenticationMapper;
    private final OperationLogMapper operationLogMapper;

    @Override
    public PageResult<TenantVO> getTenantList(Integer pageNum, Integer pageSize, String tenantStatus, String tenantType, String keyword) {
        IPage<Tenant> page = new Page<>(pageNum, pageSize);
        LambdaQueryWrapper<Tenant> wrapper = new LambdaQueryWrapper<>();
        
        if (tenantStatus != null && !tenantStatus.isEmpty()) {
            // status 是 INT，直接 eq(String "ACTIVE") 会被 MySQL 隐式转成 0 ——
            // 于是"启用"筛出 status=0 的行、"禁用"几乎筛不出任何行，两个筛选项都错。
            //
            // 这里按 StatusEnum 的口径（1=启用 / 0=禁用）翻译，同时接受前端可能传来的
            // "ACTIVE"/"1" 两种写法，避免前后端口径切换期间出现静默空列表。
            wrapper.eq(Tenant::getStatus, parseTenantStatus(tenantStatus));
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
        tenant.setTenantCode(dto.getCode() != null && !dto.getCode().isEmpty() ? dto.getCode() : "T" + System.currentTimeMillis());
        tenant.setTenantName(dto.getName());
        tenant.setContactName(dto.getContactPerson());
        tenant.setContactPhone(dto.getContactPhone());
        // 统一到 StatusEnum：1=启用、0=禁用。原实现是反的（ACTIVE→0），
        // 与共享包 StatusEnum 以及本模块其它统计口径互相矛盾。
        tenant.setStatus(parseTenantStatus(dto.getStatus()));
        
        tenantMapper.insert(tenant);
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
        
        // 逻辑删除走 del_flag（MyBatis-Plus 已配 logic-delete-field=delFlag，deleteById 会自动置 1）。
        // 原实现把 status 置成 -1：既绕过了框架的逻辑删除，又让列表照旧能查到这条记录
        // （列表不按 del_flag 过滤）——"删了还在"就是这么来的。
        tenantMapper.deleteById(id);
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
    public PageResult<TenantQuotaOverviewVO> getQuotaOverview(Integer pageNum, Integer pageSize, String keyword) {
        // 先按条件分页查租户，再把这批租户的配额**一次性**捞回来合并。
        // 不写成"每个租户查一次配额"：那是 N+1，一页 10 个租户就是 11 次数据库往返。
        LambdaQueryWrapper<Tenant> tenantWrapper = new LambdaQueryWrapper<>();
        if (keyword != null && !keyword.isEmpty()) {
            tenantWrapper.and(w -> w.like(Tenant::getTenantName, keyword)
                    .or().like(Tenant::getTenantCode, keyword));
        }
        tenantWrapper.orderByDesc(Tenant::getCreateTime);

        IPage<Tenant> page = tenantMapper.selectPage(new Page<>(pageNum, pageSize), tenantWrapper);
        List<Tenant> tenants = page.getRecords();

        // agri_md_tenant_quota.tenant_id 存的是租户主键的字符串形式（与 getTenantQuota 同口径）
        Map<String, TenantQuota> quotaMap = new HashMap<>();
        if (!tenants.isEmpty()) {
            List<String> tenantIds = new ArrayList<>();
            for (Tenant tenant : tenants) {
                if (tenant.getId() != null) {
                    tenantIds.add(tenant.getId().toString());
                }
            }
            if (!tenantIds.isEmpty()) {
                for (TenantQuota quota : tenantQuotaMapper.selectList(
                        new LambdaQueryWrapper<TenantQuota>().in(TenantQuota::getTenantId, tenantIds))) {
                    quotaMap.put(quota.getTenantId(), quota);
                }
            }
        }

        List<TenantQuotaOverviewVO> list = new ArrayList<>();
        for (Tenant tenant : tenants) {
            TenantQuotaOverviewVO vo = new TenantQuotaOverviewVO();
            vo.setId(tenant.getId());
            vo.setTenantCode(tenant.getTenantCode());
            vo.setTenantName(tenant.getTenantName());
            vo.setTenantType(tenant.getTenantType());

            TenantQuota quota = tenant.getId() == null ? null : quotaMap.get(tenant.getId().toString());
            vo.setHasQuota(quota != null);
            if (quota != null) {
                vo.setUserUsed(quota.getUsedUsers());
                vo.setUserLimit(quota.getUserLimit());
                vo.setOrgUsed(quota.getUsedOrgs());
                vo.setOrgLimit(quota.getOrgLimit());
                vo.setProductUsed(quota.getUsedProducts());
                vo.setProductLimit(quota.getProductLimit());
                vo.setStorageUsed(quota.getUsedStorage());
                vo.setStorageLimit(quota.getStorageLimit());
                vo.setApiUsed(quota.getUsedApi());
                vo.setApiLimit(quota.getApiLimit());
            }
            list.add(vo);
        }
        return PageResult.success(list, page.getTotal(), pageNum, pageSize);
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
        // 原实现是在这里手搓三个 VO 返回的（基础版/专业版/企业版），没有表、也不落库：
        // 页面上看得见、改得动，刷新一下就回到那三个写死的套餐。
        List<TenantPackageVO> packages = new ArrayList<>();
        for (TenantPackage entity : tenantPackageMapper.selectList(
                new LambdaQueryWrapper<TenantPackage>()
                        .orderByAsc(TenantPackage::getServiceLevel)
                        .orderByAsc(TenantPackage::getId))) {
            packages.add(toPackageVO(entity));
        }
        return packages;
    }

    @Override
    @Transactional
    public void createPackage(TenantPackageDTO dto) {
        if (dto.getPackageCode() == null || dto.getPackageCode().isEmpty()) {
            throw new BusinessException("套餐编码不能为空");
        }
        Long exists = tenantPackageMapper.selectCount(
                new LambdaQueryWrapper<TenantPackage>().eq(TenantPackage::getPackageCode, dto.getPackageCode()));
        if (exists != null && exists > 0) {
            throw new BusinessException("套餐编码已存在：" + dto.getPackageCode());
        }
        TenantPackage entity = new TenantPackage();
        entity.setPackageCode(dto.getPackageCode());
        entity.setDelFlag(0);
        applyPackageDto(entity, dto);
        entity.setStatus(1);
        tenantPackageMapper.insert(entity);
    }

    @Override
    @Transactional
    public void updatePackage(Long id, TenantPackageDTO dto) {
        TenantPackage entity = tenantPackageMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("套餐不存在");
        }
        // 只覆盖本次传了的字段：否则"改个价格"会把限额、说明一并清空
        applyPackageDto(entity, dto);
        tenantPackageMapper.updateById(entity);
    }

    @Override
    @Transactional
    public void deletePackage(Long id) {
        TenantPackage entity = tenantPackageMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("套餐不存在");
        }
        tenantPackageMapper.deleteById(id);
    }

    /** 服务级别 → 描述（未显式提供描述时按级别给出） */
    private String defaultServiceLevelDesc(Integer level) {
        if (level == null) {
            return null;
        }
        switch (level) {
            case 3:
                return "7x24小时专属支持";
            case 2:
                return "7x12小时支持";
            default:
                return "工作日支持";
        }
    }

    private void applyPackageDto(TenantPackage entity, TenantPackageDTO dto) {
        if (dto.getPackageName() != null) {
            entity.setPackageName(dto.getPackageName());
        }
        if (dto.getPackageDesc() != null) {
            entity.setPackageDesc(dto.getPackageDesc());
        }
        if (dto.getUserLimit() != null) {
            entity.setUserLimit(dto.getUserLimit());
        }
        if (dto.getOrgLimit() != null) {
            entity.setOrgLimit(dto.getOrgLimit());
        }
        if (dto.getProductLimit() != null) {
            entity.setProductLimit(dto.getProductLimit());
        }
        if (dto.getStorageLimit() != null) {
            entity.setStorageLimit(dto.getStorageLimit());
        }
        if (dto.getApiLimit() != null) {
            entity.setApiLimit(dto.getApiLimit());
        }
        if (dto.getPrice() != null) {
            entity.setPrice(java.math.BigDecimal.valueOf(dto.getPrice()));
        }
        if (dto.getDuration() != null) {
            entity.setDuration(dto.getDuration());
        }
        if (dto.getServiceLevel() != null) {
            entity.setServiceLevel(dto.getServiceLevel());
            entity.setServiceLevelDesc(defaultServiceLevelDesc(dto.getServiceLevel()));
        }
    }

    private TenantPackageVO toPackageVO(TenantPackage entity) {
        TenantPackageVO vo = new TenantPackageVO();
        vo.setId(entity.getId());
        vo.setPackageCode(entity.getPackageCode());
        vo.setPackageName(entity.getPackageName());
        vo.setPackageDesc(entity.getPackageDesc());
        vo.setUserLimit(entity.getUserLimit());
        vo.setOrgLimit(entity.getOrgLimit());
        vo.setProductLimit(entity.getProductLimit());
        vo.setStorageLimit(entity.getStorageLimit());
        vo.setApiLimit(entity.getApiLimit());
        vo.setServiceLevelDesc(entity.getServiceLevelDesc());
        vo.setServiceLevel(entity.getServiceLevel());
        vo.setPrice(entity.getPrice() == null ? null : entity.getPrice().doubleValue());
        vo.setDuration(entity.getDuration());
        vo.setStatus(entity.getStatus());
        vo.setCreateTime(entity.getCreateTime() == null ? null : entity.getCreateTime().toString());
        return vo;
    }

    @Override
    public TenantStatisticsVO getTenantStatistics(String tenantId, String timeRange) {
        TenantStatisticsVO vo = new TenantStatisticsVO();
        vo.setSummary(getTenantSummary());
        vo.setTrends(getTenantTrends(timeRange));
        vo.setRankings(getTenantRankings());
        vo.setTenantTypes(countByName("tenant_type", "未填写"));
        vo.setRegions(countByName("province", "未填写"));
        return vo;
    }

    @Override
    public TenantStatisticsVO.Summary getTenantSummary() {
        TenantStatisticsVO.Summary summary = new TenantStatisticsVO.Summary();
        summary.setTotalTenants(tenantMapper.selectCount(new LambdaQueryWrapper<Tenant>()));
        // 按类型统计必须忽略大小写：库里存的是 'ENTERPRISE' / 'INDIVIDUAL'（大写），
        // 这里原先按小写 'enterprise' 比较 —— 赶上 MySQL 不区分大小写的排序规则能碰巧命中，
        // 一旦库改成 _bin / _as_cs，就会恒返回 0：列表里明明有 7 家企业租户，
        // 统计卡片上却是"企业租户 0 家"。用 UPPER() 把口径固定下来。
        summary.setEnterpriseTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().apply("UPPER(tenant_type) = {0}", "ENTERPRISE")
        ));
        summary.setIndividualTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().apply("UPPER(tenant_type) = {0}", "INDIVIDUAL")
        ));
        summary.setActiveTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().eq(Tenant::getStatus, StatusEnum.ENABLE.getCode())
        ));
        summary.setInactiveTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>().eq(Tenant::getStatus, StatusEnum.DISABLE.getCode())
        ));
        // 到期数现在有真实来源（agri_md_tenant.expire_time），不再是"没有来源所以留空"
        summary.setExpiredTenants(tenantMapper.selectCount(
            new LambdaQueryWrapper<Tenant>()
                .isNotNull(Tenant::getExpireTime)
                .lt(Tenant::getExpireTime, new Date())
        ));
        // 租户主数据质量得分仍然没有来源（没有"按租户汇总质量得分"的表），留空而不是写死 96.8
        summary.setAvgQualityScore(null);
        summary.setTotalUsers(userMapper.selectCount(new LambdaQueryWrapper<User>()));
        return summary;
    }

    /**
     * 按某一列分组计数，空值归到 {@code emptyLabel}。
     *
     * <p>为什么不在 Java 里用 GROUP BY 的原样结果：SQL 里 null 会单独成一行 {@code NULL -> n}，
     * 前端拿到的 name 是 null，图表上就是一个没有名字的柱子。统一显示成"未填写"，
     * 让"这个租户没填省份"在页面上是看得见的，而不是看起来像图表坏了。</p>
     */
    private List<TenantStatisticsVO.NameCount> countByName(String column, String emptyLabel) {
        QueryWrapper<Tenant> wrapper = new QueryWrapper<>();
        wrapper.select(column + " AS name", "COUNT(*) AS cnt").groupBy(column);
        List<TenantStatisticsVO.NameCount> result = new ArrayList<>();
        for (Map<String, Object> row : tenantMapper.selectMaps(wrapper)) {
            Object name = row.get("name");
            Object count = row.get("cnt");
            result.add(new TenantStatisticsVO.NameCount(
                name == null ? emptyLabel : String.valueOf(name),
                count == null ? 0L : Long.valueOf(String.valueOf(count))));
        }
        result.sort(Comparator.comparing(TenantStatisticsVO.NameCount::getCount).reversed());
        return result;
    }

    /**
     * 把前端传来的租户状态翻译成 StatusEnum 的数值口径。
     *
     * <p>同时接受 "ACTIVE"/"INACTIVE" 与 "1"/"0"：前者是历史上前端表单里的值，
     * 后者是 StatusEnum 的值。切换期间两边都可能出现，认不出的一律按"启用"处理，
     * 绝不因为一个筛选项拼错就把整张列表变成空的。</p>
     */
    private Integer parseTenantStatus(String raw) {
        if (raw == null || raw.isEmpty()) {
            return StatusEnum.ENABLE.getCode();
        }
        String normalized = raw.trim().toUpperCase();
        if ("INACTIVE".equals(normalized) || "0".equals(normalized) || "DISABLE".equals(normalized)) {
            return StatusEnum.DISABLE.getCode();
        }
        return StatusEnum.ENABLE.getCode();
    }

    private TenantDetailVO.UserOrgStats getUserOrgStats(Long tenantId) {
        TenantDetailVO.UserOrgStats stats = new TenantDetailVO.UserOrgStats();
        Tenant tenant = tenantMapper.selectById(tenantId);
        String code = tenant == null ? null : tenant.getTenantCode();
        String idText = String.valueOf(tenantId);

        stats.setTotalUsers(userMapper.selectCount(tenantScoped(User::getTenantId, code, idText)));

        LambdaQueryWrapper<UserAuthentication> approved = tenantScoped(UserAuthentication::getTenantId, code, idText);
        approved.apply("UPPER(auth_status) = {0}", "APPROVED");
        stats.setVerifiedUsers(userAuthenticationMapper.selectCount(approved));

        LambdaQueryWrapper<UserAuthentication> pending = tenantScoped(UserAuthentication::getTenantId, code, idText);
        pending.apply("UPPER(auth_status) = {0}", "PENDING");
        stats.setPendingUsers(userAuthenticationMapper.selectCount(pending));

        stats.setTotalOrgs(organizationMapper.selectCount(tenantScoped(Organization::getTenantId, code, idText)));

        LambdaQueryWrapper<Organization> verifiedOrgs = tenantScoped(Organization::getTenantId, code, idText);
        verifiedOrgs.apply("UPPER(auth_status) = {0}", "VERIFIED");
        stats.setVerifiedOrgs(organizationMapper.selectCount(verifiedOrgs));

        LambdaQueryWrapper<Organization> pendingOrgs = tenantScoped(Organization::getTenantId, code, idText);
        pendingOrgs.apply("UPPER(auth_status) = {0}", "PENDING");
        stats.setPendingOrgs(organizationMapper.selectCount(pendingOrgs));

        return stats;
    }

    /**
     * 把条件限定到某个租户。
     *
     * <p>关联键是<b>租户编码</b>（'T1001' 这种）而不是 agri_md_tenant 的主键 ——
     * 用户表和组织表的 tenant_id 列存的就是编码。同时认主键文本，是为了兼容
     * 早期可能按主键写入的数据：宁可多认一种写法，也不要在页面上显示成 0。</p>
     */
    private static <T> LambdaQueryWrapper<T> tenantScoped(SFunction<T, ?> column, String code, String idText) {
        LambdaQueryWrapper<T> wrapper = new LambdaQueryWrapper<>();
        if (code == null || code.isEmpty() || code.equals(idText)) {
            wrapper.eq(column, idText);
        } else {
            wrapper.and(w -> w.eq(column, code).or().eq(column, idText));
        }
        return wrapper;
    }

    /**
     * 租户主数据质量得分 —— <b>没有数据来源，如实返回空。</b>
     *
     * <p>原先这里写死了 99.2 / 99.5 / 99.1 / 98.8 / 99.8：换个租户点进去，五个分数纹丝不动，
     * 却是页面上最显眼的一块。现在返回一个全 null 的对象，页面显示"—"。
     * 要有真数字，先得有"按租户 + 按数据域汇总质量得分"的表（数据质量模块目前只有问题工单，
     * 没有得分汇总），并在每次质量检测后回写。</p>
     */
    private TenantDetailVO.QualityScore getQualityScore(Long tenantId) {
        return new TenantDetailVO.QualityScore();
    }

    /**
     * 租户的操作记录 —— 取 agri_md_operation_log 里目标为该租户的真实留痕。
     *
     * <p>原先这里三条记录（"管理员-小李"、"用户配额从1500调整至2000"、"自动续费成功"）
     * 是写死的，时间还停在 2026-05。现在变成真数据：由 AdminOperationLogAspect 记录的
     * 对这个租户的每一次写操作（改资料、停启用、调配额、换套餐……）。</p>
     */
    private List<TenantDetailVO.OperationLog> getOperationLogs(Long tenantId) {
        List<TenantDetailVO.OperationLog> logs = new ArrayList<>();
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OperationLog::getTargetId, String.valueOf(tenantId))
            .orderByDesc(OperationLog::getCreateTime)
            .orderByDesc(OperationLog::getId)
            .last("LIMIT 20");
        for (OperationLog entity : operationLogMapper.selectList(wrapper)) {
            TenantDetailVO.OperationLog item = new TenantDetailVO.OperationLog();
            item.setTime(entity.getCreateTime() == null ? null : entity.getCreateTime().format(OPERATION_LOG_FMT));
            item.setOperationType(entity.getOperationDesc());
            item.setOperator(entity.getOperator());
            item.setContent("fail".equals(entity.getResult())
                ? "失败：" + (entity.getErrorMessage() == null ? "未知原因" : entity.getErrorMessage())
                : entity.getRequestMethod() + " " + entity.getRequestUri());
            logs.add(item);
        }
        return logs;
    }

    private List<TenantStatisticsVO.TenantTrend> getTenantTrends(String timeRange) {
        int days = switch (timeRange == null ? "" : timeRange) {
            case "7d" -> 7;
            case "90d" -> 90;
            case "1y" -> 365;
            default -> 30;
        };
        boolean byMonth = days > 31;
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(days - 1L);

        QueryWrapper<Tenant> wrapper = new QueryWrapper<>();
        wrapper.select("DATE(create_time) AS d", "COUNT(*) AS cnt")
            .ge("create_time", from.atStartOfDay())
            .groupBy("DATE(create_time)");
        Map<String, Long> counts = new HashMap<>();
        for (Map<String, Object> row : tenantMapper.selectMaps(wrapper)) {
            Object day = row.get("d");
            Object count = row.get("cnt");
            if (day != null) {
                counts.put(String.valueOf(day).substring(0, 10),
                    count == null ? 0L : Long.valueOf(String.valueOf(count)));
            }
        }

        List<TenantStatisticsVO.TenantTrend> trends = new ArrayList<>();
        if (byMonth) {
            LocalDate lastMonth = today.withDayOfMonth(1);
            for (LocalDate cursor = from.withDayOfMonth(1); !cursor.isAfter(lastMonth); cursor = cursor.plusMonths(1)) {
                trends.add(buildTrend(cursor.format(MONTH_FMT), counts, cursor,
                    cursor.withDayOfMonth(cursor.lengthOfMonth())));
            }
        } else {
            for (LocalDate cursor = from; !cursor.isAfter(today); cursor = cursor.plusDays(1)) {
                trends.add(buildTrend(cursor.format(DAY_FMT), counts, cursor, cursor));
            }
        }
        return trends;
    }

    private TenantStatisticsVO.TenantTrend buildTrend(String label, Map<String, Long> counts,
                                                      LocalDate bucketStart, LocalDate bucketEnd) {
        long total = 0L;
        for (LocalDate cursor = bucketStart; !cursor.isAfter(bucketEnd); cursor = cursor.plusDays(1)) {
            total += counts.getOrDefault(cursor.toString(), 0L);
        }
        TenantStatisticsVO.TenantTrend trend = new TenantStatisticsVO.TenantTrend();
        trend.setDate(label);
        trend.setNewTenants(total);
        // 活跃 / 流失没有来源：前者要租户活跃度日志，后者要租户状态变更历史，两张表都不存在。
        // 刻意留 null 而不是 0：0 的意思是"那天活跃租户数为零"，那是在编造事实。
        trend.setActiveTenants(null);
        trend.setChurnTenants(null);
        return trend;
    }

    /**
     * 租户活跃度排行 —— 真按"该租户下的用户数"排序。
     *
     * <p>原先整段是编的：租户名从种子数据里抄了五个，用户数 / 质量分 / 数据更新次数全是
     * {@code Math.random()} 乘出来的，每次刷新都不一样。现在租户、用户数、组织数都来自库，
     * 用两次分组查询取计数，不做"每个租户查一次"的 N+1。</p>
     *
     * <p>{@code qualityScore / dataUpdates} 保持 null：没有质量得分汇总表，
     * 也没有"数据变更次数"的统计表。要有真数字得先建这两样东西。</p>
     */
    private List<TenantStatisticsVO.TenantRank> getTenantRankings() {
        Map<String, Long> userCounts = groupedCount(userMapper.selectMaps(
            new QueryWrapper<User>().select("tenant_id AS tid", "COUNT(*) AS cnt").groupBy("tenant_id")), "tid");
        Map<String, Long> orgCounts = groupedCount(organizationMapper.selectMaps(
            new QueryWrapper<Organization>().select("tenant_id AS tid", "COUNT(*) AS cnt").groupBy("tenant_id")), "tid");

        List<Tenant> tenants = tenantMapper.selectList(new LambdaQueryWrapper<Tenant>());
        tenants.sort(Comparator.comparingLong(
            (Tenant tenant) -> userCounts.getOrDefault(tenant.getTenantCode(), 0L)).reversed());

        List<TenantStatisticsVO.TenantRank> rankings = new ArrayList<>();
        for (Tenant tenant : tenants) {
            if (rankings.size() >= 10) {
                break;
            }
            TenantStatisticsVO.TenantRank rank = new TenantStatisticsVO.TenantRank();
            rank.setRank(rankings.size() + 1);
            rank.setTenantId(tenant.getTenantCode());
            rank.setTenantName(tenant.getTenantName());
            rank.setTenantType(tenant.getTenantType());
            rank.setUserCount(userCounts.getOrDefault(tenant.getTenantCode(), 0L));
            rank.setOrgCount(orgCounts.getOrDefault(tenant.getTenantCode(), 0L));
            rank.setQualityScore(null);
            rank.setDataUpdates(null);
            rank.setStatus(StatusEnum.ENABLE.getCode().equals(tenant.getStatus()) ? "启用中" : "已停用");
            rankings.add(rank);
        }
        return rankings;
    }

    private static Map<String, Long> groupedCount(List<Map<String, Object>> rows, String keyColumn) {
        Map<String, Long> result = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Object key = row.get(keyColumn);
            Object count = row.get("cnt");
            if (key != null) {
                result.put(String.valueOf(key), count == null ? 0L : Long.valueOf(String.valueOf(count)));
            }
        }
        return result;
    }
}
