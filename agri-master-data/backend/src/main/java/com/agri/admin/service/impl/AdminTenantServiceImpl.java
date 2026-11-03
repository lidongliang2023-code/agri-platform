package com.agri.admin.service.impl;

import com.agri.admin.dto.TenantCreateDTO;
import com.agri.admin.client.CoreTenantSubjectClient;
import com.agri.admin.client.CoreUserAdminClient;
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
import com.agri.masterdata.entity.Product;
import com.agri.masterdata.entity.Tenant;
import com.agri.masterdata.entity.TenantPackage;
import com.agri.masterdata.entity.TenantQuota;
import com.agri.masterdata.entity.User;
import com.agri.masterdata.entity.UserAuthentication;
import com.agri.masterdata.mapper.OperationLogMapper;
import com.agri.masterdata.mapper.OrganizationMapper;
import com.agri.masterdata.mapper.ProductMapper;
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
    private final CoreTenantSubjectClient coreTenantSubjectClient;
    private final CoreUserAdminClient coreUserAdminClient;
    private final TenantMapper tenantMapper;
    private final TenantPackageMapper tenantPackageMapper;
    private final TenantQuotaMapper tenantQuotaMapper;
    private final UserMapper userMapper;
    private final OrganizationMapper organizationMapper;
    private final ProductMapper productMapper;
    private final UserAuthenticationMapper userAuthenticationMapper;
    private final OperationLogMapper operationLogMapper;

    @Override
    public PageResult<TenantVO> getTenantList(Integer pageNum, Integer pageSize, String tenantStatus, String tenantType, String keyword) {
        Integer status = tenantStatus == null || tenantStatus.isBlank()
                ? null : parseTenantStatus(tenantStatus);
        String memberType = null;
        if ("ENTERPRISE".equalsIgnoreCase(tenantType)) {
            memberType = "enterprise";
        } else if ("INDIVIDUAL".equalsIgnoreCase(tenantType)
                || "PERSONAL".equalsIgnoreCase(tenantType)) {
            memberType = "personal";
        }
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CorePageResult<
                CoreTenantSubjectClient.CoreTenantSubject>> response =
                coreTenantSubjectClient.page(pageNum, pageSize, keyword, status, memberType);
        requireSuccess(response.code(), response.message());
        CoreTenantSubjectClient.CorePageResult<CoreTenantSubjectClient.CoreTenantSubject> data = response.data();
        List<TenantVO> records = data == null || data.records() == null
                ? List.of() : data.records().stream().map(this::toTenantVO).toList();
        long total = data == null ? 0 : data.total();
        return new PageResult<>(records, total, pageNum.longValue(), pageSize.longValue());
    }

    @Override
    public TenantDetailVO getTenantDetail(Long id) {
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CoreTenantSubject> response =
                coreTenantSubjectClient.detail(id);
        requireSuccess(response.code(), response.message());
        CoreTenantSubjectClient.CoreTenantSubject subject = response.data();
        
        TenantDetailVO vo = new TenantDetailVO();
        vo.setId(subject.tenantId());
        vo.setTenantCode(subject.tenantCode());
        vo.setTenantName(subject.tenantName());
        vo.setTenantType("personal".equalsIgnoreCase(subject.memberType()) ? "INDIVIDUAL" : "ENTERPRISE");
        vo.setIndustry(subject.industry());
        vo.setCompanySize(subject.companySize());
        vo.setBusinessType(subject.businessType());
        vo.setAddress(subject.address());
        vo.setCreditCode(subject.creditCode());
        vo.setVerifyStatus(subject.verifyStatus());
        vo.setVerifyRemark(subject.verifyRemark());
        vo.setContactName(subject.contactName());
        vo.setPhone(subject.contactPhone());
        vo.setStatus(subject.status());
        vo.setCreateTime(subject.createdAt() != null ? subject.createdAt().toString() : null);
        CoreTenantSubjectClient.CoreCertification certification = subject.certification();
        if (certification != null) {
            vo.setCreditCode(certification.creditCode() != null ? certification.creditCode() : subject.creditCode());
            vo.setLegalPerson(certification.legalPerson());
            vo.setLicenseNo(certification.licenseNo());
            vo.setBusinessLicenseUrl(certification.businessLicenseUrl());
            vo.setCertificationNo(certification.certNo());
            vo.setVerificationChannel(certification.verificationChannel());
            vo.setLegalPersonFaceStatus(certification.legalPersonFaceStatus());
            vo.setCorporateBankName(certification.corporateBankName());
            vo.setCorporateBankAccount(certification.corporateBankAccount());
            vo.setCorporateTransferStatus(certification.corporateTransferStatus());
            vo.setRegisteredCapital(certification.registeredCapital());
            vo.setCertificationStatus(certification.status());
            vo.setCertificationReviewRemark(certification.reviewRemark());
        }
        CoreTenantSubjectClient.CoreIdentity identity = subject.identity();
        if (identity != null) {
            vo.setIdentityNoMasked(identity.idNoMasked());
            vo.setLegalPerson(identity.realName());
            vo.setValidStart(identity.validStart());
            vo.setValidEnd(identity.validEnd());
            vo.setCertificationNo(identity.identityNo());
            vo.setVerificationChannel(identity.verificationChannel());
            vo.setPoliceVerified(identity.policeVerified());
            vo.setLivenessVerified(identity.livenessVerified());
            vo.setCertificationStatus(identity.status());
            vo.setCertificationReviewRemark(identity.reviewRemark());
            if (vo.getEmail() == null) vo.setEmail(identity.email());
            if (vo.getAddress() == null) vo.setAddress(identity.address());
        }
        vo.setQuotaInfo(getTenantQuota(id));
        vo.setUserOrgStats(getUserOrgStats(id));
        vo.setQualityScore(getQualityScore(id));
        vo.setOperationLogs(getOperationLogs(id));
        
        return vo;
    }

    @Override
    @Transactional
    public void createTenant(TenantCreateDTO dto) {
        throw new BusinessException("租户与企业/个人经营主体一一对应，请从统一认证中心注册主体；本页不单独新建租户");
    }

    @Override
    public void updateTenant(Long id, TenantUpdateDTO dto) {
        String contactName = dto.getContactName() != null ? dto.getContactName() : dto.getContactPerson();
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CoreTenantSubject> response =
                coreTenantSubjectClient.update(id, new CoreTenantSubjectClient.TenantSubjectUpdate(
                        dto.getTenantName(), dto.getIndustry(), dto.getCompanySize(),
                        dto.getBusinessType(), dto.getAddress(), dto.getCreditCode(),
                        contactName, dto.getContactPhone(), dto.getStatus()));
        requireSuccess(response.code(), response.message());
    }

    @Override
    public void deleteTenant(Long id) {
        throw new BusinessException("租户与经营主体一一对应，不能单独删除；请在经营主体流程中处理");
    }

    @Override
    public void updateTenantStatus(Long id, Integer status) {
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CoreTenantSubject> response =
                coreTenantSubjectClient.updateStatus(id, new CoreTenantSubjectClient.TenantStatusUpdate(status));
        requireSuccess(response.code(), response.message());
    }

    @Override
    public TenantDetailVO.QuotaInfo getTenantQuota(Long id) {
        TenantQuota quota = tenantQuotaMapper.selectOne(
            new LambdaQueryWrapper<TenantQuota>().eq(TenantQuota::getTenantId, id.toString())
        );
        
        TenantDetailVO.QuotaInfo info = new TenantDetailVO.QuotaInfo();
        info.setUsedUsers(Math.toIntExact(countMembers(id)));
        info.setUsedOrgs(Math.toIntExact(organizationMapper.selectCount(
                new LambdaQueryWrapper<Organization>().eq(Organization::getTenantId, id.toString()))));
        info.setUsedProducts(Math.toIntExact(productMapper.selectCount(
                new LambdaQueryWrapper<Product>().eq(Product::getTenantId, id.toString()))));
        if (quota != null) {
            info.setUserLimit(quota.getUserLimit());
            info.setOrgLimit(quota.getOrgLimit());
            info.setProductLimit(quota.getProductLimit());
            info.setStorageLimit(quota.getStorageLimit());
            info.setUsedStorage(quota.getUsedStorage());
            info.setApiLimit(quota.getApiLimit());
            info.setUsedApiToday(quota.getUsedApi());
            info.setAlertThreshold(80);
        }
        
        return info;
    }

    @Override
    public PageResult<TenantQuotaOverviewVO> getQuotaOverview(Integer pageNum, Integer pageSize,
                                                               String keyword, String tenantType) {
        String memberType = "INDIVIDUAL".equalsIgnoreCase(tenantType)
                || "PERSONAL".equalsIgnoreCase(tenantType) ? "personal"
                : "ENTERPRISE".equalsIgnoreCase(tenantType) ? "enterprise" : null;
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CorePageResult<
                CoreTenantSubjectClient.CoreTenantSubject>> response =
                coreTenantSubjectClient.page(pageNum, pageSize, keyword, null, memberType);
        requireSuccess(response.code(), response.message());
        CoreTenantSubjectClient.CorePageResult<CoreTenantSubjectClient.CoreTenantSubject> data = response.data();
        List<CoreTenantSubjectClient.CoreTenantSubject> subjects =
                data == null || data.records() == null ? List.of() : data.records();
        List<String> tenantIds = subjects.stream()
                .map(item -> String.valueOf(item.tenantId())).toList();
        Map<String, TenantQuota> quotaMap = new HashMap<>();
        if (!tenantIds.isEmpty()) {
            for (TenantQuota quota : tenantQuotaMapper.selectList(
                    new LambdaQueryWrapper<TenantQuota>().in(TenantQuota::getTenantId, tenantIds))) {
                quotaMap.put(quota.getTenantId(), quota);
            }
        }

        Map<Long, Long> memberCounts = countMembersBySubject();
        Map<String, Long> orgCounts = countByTenant(organizationMapper.selectMaps(
                new QueryWrapper<Organization>().select("tenant_id AS tid", "COUNT(*) AS cnt")
                        .in("tenant_id", tenantIds).groupBy("tenant_id")), "tid");
        Map<String, Long> productCounts = countByTenant(productMapper.selectMaps(
                new QueryWrapper<Product>().select("tenant_id AS tid", "COUNT(*) AS cnt")
                        .in("tenant_id", tenantIds).groupBy("tenant_id")), "tid");

        List<TenantQuotaOverviewVO> list = new ArrayList<>();
        for (CoreTenantSubjectClient.CoreTenantSubject subject : subjects) {
            TenantQuotaOverviewVO vo = new TenantQuotaOverviewVO();
            vo.setId(subject.tenantId());
            vo.setTenantCode(subject.tenantCode());
            vo.setTenantName(subject.tenantName());
            vo.setTenantType("personal".equalsIgnoreCase(subject.memberType()) ? "INDIVIDUAL" : "ENTERPRISE");
            String tenantId = String.valueOf(subject.tenantId());
            TenantQuota quota = quotaMap.get(tenantId);
            vo.setHasQuota(quota != null);
            vo.setUserUsed(memberCounts.getOrDefault(subject.tenantId(), 0L).intValue());
            vo.setOrgUsed(orgCounts.getOrDefault(tenantId, 0L).intValue());
            vo.setProductUsed(productCounts.getOrDefault(tenantId, 0L).intValue());
            if (quota != null) {
                vo.setUserLimit(quota.getUserLimit());
                vo.setOrgLimit(quota.getOrgLimit());
                vo.setProductLimit(quota.getProductLimit());
                vo.setStorageUsed(quota.getUsedStorage());
                vo.setStorageLimit(quota.getStorageLimit());
                vo.setApiUsed(quota.getUsedApi());
                vo.setApiLimit(quota.getApiLimit());
            }
            list.add(vo);
        }
        long total = data == null ? 0 : data.total();
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public void adjustTenantQuota(Long id, TenantQuotaAdjustDTO dto) {
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CoreTenantSubject> subjectResponse =
                coreTenantSubjectClient.detail(id);
        requireSuccess(subjectResponse.code(), subjectResponse.message());
        TenantQuota quota = tenantQuotaMapper.selectOne(
            new LambdaQueryWrapper<TenantQuota>().eq(TenantQuota::getTenantId, id.toString())
        );
        if (quota == null) {
            quota = new TenantQuota();
            quota.setTenantId(id.toString());
            quota.setQuotaType("SUBJECT");
            quota.setStatus(1);
            quota.setUsedUsers(0);
            quota.setUsedOrgs(0);
            quota.setUsedProducts(0);
            quota.setUsedStorage(0L);
            quota.setUsedApi(0);
        }
        if (dto.getUserLimit() != null) quota.setUserLimit(dto.getUserLimit());
        if (dto.getOrgLimit() != null) quota.setOrgLimit(dto.getOrgLimit());
        if (dto.getProductLimit() != null) quota.setProductLimit(dto.getProductLimit());
        if (dto.getStorageLimit() != null) quota.setStorageLimit(dto.getStorageLimit());
        if (dto.getApiLimit() != null) quota.setApiLimit(dto.getApiLimit());
        quota.setUsedUsers(Math.toIntExact(countMembers(id)));
        quota.setUsedOrgs(organizationMapper.selectCount(new LambdaQueryWrapper<Organization>()
                .eq(Organization::getTenantId, id.toString())).intValue());
        quota.setUsedProducts(productMapper.selectCount(new LambdaQueryWrapper<Product>()
                .eq(Product::getTenantId, id.toString())).intValue());
        if (quota.getId() == null) {
            tenantQuotaMapper.insert(quota);
        } else {
            tenantQuotaMapper.updateById(quota);
        }
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
    public TenantPackageVO getPackageDetail(Long id) {
        TenantPackage entity = tenantPackageMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("套餐不存在");
        }
        return toPackageVO(entity);
    }

    @Override
    @Transactional
    public void createPackage(TenantPackageDTO dto) {
        if (dto.getPackageCode() == null || dto.getPackageCode().isEmpty()) {
            throw new BusinessException("套餐编码不能为空");
        }
        validatePackage(dto, true);
        Long exists = tenantPackageMapper.selectCount(
                new LambdaQueryWrapper<TenantPackage>().eq(TenantPackage::getPackageCode, dto.getPackageCode()));
        if (exists != null && exists > 0) {
            throw new BusinessException("套餐编码已存在：" + dto.getPackageCode());
        }
        TenantPackage entity = new TenantPackage();
        entity.setPackageCode(dto.getPackageCode());
        entity.setDelFlag(0);
        applyPackageDto(entity, dto);
        entity.setStatus(dto.getStatus() == null ? 1 : dto.getStatus());
        tenantPackageMapper.insert(entity);
    }

    @Override
    @Transactional
    public void updatePackage(Long id, TenantPackageDTO dto) {
        TenantPackage entity = tenantPackageMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException("套餐不存在");
        }
        validatePackage(dto, false);
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
        if (dto.getStatus() != null) {
            if (dto.getStatus() != 0 && dto.getStatus() != 1) {
                throw new BusinessException("套餐状态只能是 0 或 1");
            }
            entity.setStatus(dto.getStatus());
        }
    }

    private void validatePackage(TenantPackageDTO dto, boolean creating) {
        if (dto == null) {
            throw new BusinessException("套餐资料不能为空");
        }
        if (dto.getPackageName() == null || dto.getPackageName().isBlank()) {
            throw new BusinessException("套餐名称不能为空");
        }
        if (creating && (dto.getPackageCode() == null
                || !dto.getPackageCode().matches("[A-Za-z0-9_-]{2,64}"))) {
            throw new BusinessException("套餐编码应为 2-64 位字母、数字、下划线或短横线");
        }
        if (dto.getPrice() == null || dto.getPrice() < 0) {
            throw new BusinessException("套餐价格不能小于 0");
        }
        if (dto.getDuration() == null || dto.getDuration() <= 0) {
            throw new BusinessException("套餐有效期必须大于 0 天");
        }
        if (negative(dto.getUserLimit()) || negative(dto.getOrgLimit())
                || negative(dto.getProductLimit()) || negative(dto.getStorageLimit())
                || negative(dto.getApiLimit())) {
            throw new BusinessException("套餐限额不能小于 0");
        }
    }

    private static boolean negative(Number value) {
        return value != null && value.doubleValue() < 0;
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
        List<CoreTenantSubjectClient.CoreTenantSubject> subjects = loadSubjectsForStatistics();
        TenantStatisticsVO vo = new TenantStatisticsVO();
        vo.setSummary(buildTenantSummary(subjects));
        vo.setTrends(buildTenantTrends(subjects, timeRange));
        vo.setRankings(buildTenantRankings(subjects));
        vo.setTenantTypes(buildTenantTypes(subjects));
        vo.setVerificationStatuses(buildVerificationStatuses(subjects));
        vo.setRegions(List.of());
        return vo;
    }

    @Override
    public TenantStatisticsVO.Summary getTenantSummary() {
        return buildTenantSummary(loadSubjectsForStatistics());
    }

    private TenantStatisticsVO.Summary buildTenantSummary(
            List<CoreTenantSubjectClient.CoreTenantSubject> subjects) {
        TenantStatisticsVO.Summary summary = new TenantStatisticsVO.Summary();
        long total = subjects.size();
        long enterprise = subjects.stream()
                .filter(item -> "enterprise".equalsIgnoreCase(item.memberType())).count();
        long active = subjects.stream().filter(item -> Integer.valueOf(1).equals(item.status())).count();
        summary.setTotalTenants(total);
        summary.setEnterpriseTenants(enterprise);
        summary.setIndividualTenants(total - enterprise);
        summary.setActiveTenants(active);
        summary.setInactiveTenants(total - active);
        summary.setExpiredTenants(null);
        summary.setAvgQualityScore(null);
        CoreUserAdminClient.CoreApiResponse<CoreUserAdminClient.CorePage<CoreUserAdminClient.CoreUser>> users =
                coreUserAdminClient.pageUsers(1, 1, null);
        if (users.code() != null && users.code() == 0 && users.data() != null) {
            summary.setTotalUsers(users.data().total());
        } else {
            Map<Long, Long> memberCounts = countMembersBySubject();
            summary.setTotalUsers(memberCounts.values().stream().mapToLong(Long::longValue).sum());
        }
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

        try {
            CoreUserAdminClient.CoreApiResponse<CoreUserAdminClient.CorePage<
                    CoreUserAdminClient.CoreMembership>> response =
                    coreUserAdminClient.pageMembershipsByMerchant(1, 500, tenantId);
            if (response.code() != null && response.code() == 0
                    && response.data() != null && response.data().records() != null) {
                stats.setTotalUsers(response.data().records().stream()
                        .filter(item -> Integer.valueOf(1).equals(item.status()))
                        .count());
            }
        } catch (RuntimeException ignored) {
            // 核心平台暂时不可达时保留成员统计为空，不用本地旧表伪造人数。
        }

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

    private List<TenantStatisticsVO.TenantTrend> buildTenantTrends(
            List<CoreTenantSubjectClient.CoreTenantSubject> subjects, String timeRange) {
        int days = switch (timeRange == null ? "" : timeRange) {
            case "7d" -> 7;
            case "90d" -> 90;
            case "1y" -> 365;
            default -> 30;
        };
        boolean byMonth = days > 31;
        LocalDate today = LocalDate.now();
        LocalDate from = today.minusDays(days - 1L);

        Map<String, Long> counts = new HashMap<>();
        for (CoreTenantSubjectClient.CoreTenantSubject subject : subjects) {
            LocalDateTime createdAt = parsePlatformTime(subject.createdAt());
            if (createdAt != null && !createdAt.toLocalDate().isBefore(from)) {
                counts.merge(createdAt.toLocalDate().toString(), 1L, Long::sum);
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
    private List<TenantStatisticsVO.TenantRank> buildTenantRankings(
            List<CoreTenantSubjectClient.CoreTenantSubject> subjects) {
        Map<Long, Long> userCounts = countMembersBySubject();
        Map<String, Long> orgCounts = groupedCount(organizationMapper.selectMaps(
            new QueryWrapper<Organization>().select("tenant_id AS tid", "COUNT(*) AS cnt").groupBy("tenant_id")), "tid");

        List<CoreTenantSubjectClient.CoreTenantSubject> sorted = subjects.stream()
                .sorted(Comparator.comparingLong(
                        (CoreTenantSubjectClient.CoreTenantSubject item) ->
                                userCounts.getOrDefault(item.tenantId(), 0L)).reversed())
                .toList();

        List<TenantStatisticsVO.TenantRank> rankings = new ArrayList<>();
        for (CoreTenantSubjectClient.CoreTenantSubject subject : sorted) {
            if (rankings.size() >= 10) {
                break;
            }
            TenantStatisticsVO.TenantRank rank = new TenantStatisticsVO.TenantRank();
            rank.setRank(rankings.size() + 1);
            rank.setTenantId(String.valueOf(subject.tenantId()));
            rank.setTenantName(subject.tenantName());
            rank.setTenantType("personal".equalsIgnoreCase(subject.memberType()) ? "INDIVIDUAL" : "ENTERPRISE");
            rank.setUserCount(userCounts.getOrDefault(subject.tenantId(), 0L));
            rank.setOrgCount(orgCounts.getOrDefault(String.valueOf(subject.tenantId()), 0L));
            rank.setQualityScore(null);
            rank.setDataUpdates(null);
            rank.setStatus(Integer.valueOf(1).equals(subject.status()) ? "启用中" : "已停用");
            rankings.add(rank);
        }
        return rankings;
    }

    private List<TenantStatisticsVO.NameCount> buildTenantTypes(
            List<CoreTenantSubjectClient.CoreTenantSubject> subjects) {
        long enterprise = subjects.stream()
                .filter(item -> "enterprise".equalsIgnoreCase(item.memberType())).count();
        long personal = subjects.size() - enterprise;
        List<TenantStatisticsVO.NameCount> result = new ArrayList<>();
        if (enterprise > 0) result.add(new TenantStatisticsVO.NameCount("ENTERPRISE", enterprise));
        if (personal > 0) result.add(new TenantStatisticsVO.NameCount("INDIVIDUAL", personal));
        return result;
    }

    private List<TenantStatisticsVO.NameCount> buildVerificationStatuses(
            List<CoreTenantSubjectClient.CoreTenantSubject> subjects) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (CoreTenantSubjectClient.CoreTenantSubject subject : subjects) {
            String status = subject.verifyStatus();
            if (status == null || status.isBlank()) status = "unverified";
            counts.merge(status, 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .map(item -> new TenantStatisticsVO.NameCount(item.getKey(), item.getValue()))
                .toList();
    }

    private List<CoreTenantSubjectClient.CoreTenantSubject> loadSubjectsForStatistics() {
        CoreTenantSubjectClient.CoreApiResponse<CoreTenantSubjectClient.CorePageResult<
                CoreTenantSubjectClient.CoreTenantSubject>> response =
                coreTenantSubjectClient.page(1, 1000, null, null, null);
        requireSuccess(response.code(), response.message());
        return response.data() == null || response.data().records() == null
                ? List.of() : response.data().records();
    }

    private TenantVO toTenantVO(CoreTenantSubjectClient.CoreTenantSubject subject) {
        return TenantVO.builder()
                .id(subject.tenantId())
                .tenantCode(subject.tenantCode())
                .tenantName(subject.tenantName())
                .tenantType("personal".equalsIgnoreCase(subject.memberType()) ? "INDIVIDUAL" : "ENTERPRISE")
                .industry(subject.industry())
                .companySize(subject.companySize())
                .businessType(subject.businessType())
                .address(subject.address())
                .creditCode(subject.creditCode())
                .legalPerson(subject.certification() != null
                        ? subject.certification().legalPerson()
                        : subject.identity() != null ? subject.identity().realName() : null)
                .licenseNo(subject.certification() != null ? subject.certification().licenseNo() : null)
                .idNoMasked(subject.identity() != null ? subject.identity().idNoMasked() : null)
                .verifyStatus(subject.verifyStatus())
                .contactPerson(subject.contactName())
                .contactPhone(subject.contactPhone())
                .status(subject.status())
                .createTime(parsePlatformTime(subject.createdAt()))
                .updateTime(parsePlatformTime(subject.createdAt()))
                .build();
    }

    private static LocalDateTime parsePlatformTime(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        String normalized = value.trim().replace('T', ' ');
        return normalized.length() > 19 ? LocalDateTime.parse(normalized.substring(0, 19),
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) : LocalDateTime.parse(normalized,
                DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private static void requireSuccess(Integer code, String message) {
        if (code == null || code != 0) {
            throw new BusinessException(message == null || message.isBlank()
                    ? "核心平台租户主档暂不可用" : message);
        }
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

    private Map<String, Long> countByTenant(List<Map<String, Object>> rows, String keyColumn) {
        return groupedCount(rows, keyColumn);
    }

    private Map<Long, Long> countMembersBySubject() {
        CoreUserAdminClient.CoreApiResponse<CoreUserAdminClient.CorePage<
                CoreUserAdminClient.CoreMembership>> response =
                coreUserAdminClient.pageMemberships(1, 1000);
        requireSuccess(response.code(), response.message());
        Map<Long, Long> result = new HashMap<>();
        if (response.data() == null || response.data().records() == null) {
            return result;
        }
        for (CoreUserAdminClient.CoreMembership item : response.data().records()) {
            if (Integer.valueOf(1).equals(item.status())) {
                result.merge(item.merchantId(), 1L, Long::sum);
            }
        }
        return result;
    }

    private long countMembers(Long subjectId) {
        CoreUserAdminClient.CoreApiResponse<CoreUserAdminClient.CorePage<
                CoreUserAdminClient.CoreMembership>> response =
                coreUserAdminClient.pageMembershipsByMerchant(1, 500, subjectId);
        requireSuccess(response.code(), response.message());
        if (response.data() == null || response.data().records() == null) {
            return 0L;
        }
        return response.data().records().stream()
                .filter(item -> Integer.valueOf(1).equals(item.status()))
                .count();
    }
}
