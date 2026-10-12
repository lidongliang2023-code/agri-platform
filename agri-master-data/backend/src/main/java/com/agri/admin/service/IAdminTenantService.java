package com.agri.admin.service;

import com.agri.admin.dto.TenantCreateDTO;
import com.agri.admin.dto.TenantPackageDTO;
import com.agri.admin.dto.TenantQuotaAdjustDTO;
import com.agri.admin.vo.TenantDetailVO;
import com.agri.admin.vo.TenantPackageVO;
import com.agri.admin.vo.TenantQuotaOverviewVO;
import com.agri.admin.vo.TenantStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.masterdata.dto.TenantUpdateDTO;
import com.agri.masterdata.vo.TenantVO;

import java.util.List;

public interface IAdminTenantService {

    PageResult<TenantVO> getTenantList(Integer pageNum, Integer pageSize, String tenantStatus, String tenantType, String keyword);

    TenantDetailVO getTenantDetail(Long id);

    void createTenant(TenantCreateDTO dto);

    void updateTenant(Long id, TenantUpdateDTO dto);

    void deleteTenant(Long id);

    void updateTenantStatus(Long id, Integer status);

    TenantDetailVO.QuotaInfo getTenantQuota(Long id);

    /**
     * 配额总览分页列表（租户 + 其配额用量合并成一行）。
     *
     * <p>原本只有"按租户 id 查单条配额"（{@link #getTenantQuota}），
     * 而配额管理页要的是"所有租户各占一行"。前端若靠逐个租户去调单条接口，
     * 10 个租户就是 11 次请求，且没有总数、没法分页。</p>
     */
    PageResult<TenantQuotaOverviewVO> getQuotaOverview(Integer pageNum, Integer pageSize, String keyword);

    void adjustTenantQuota(Long id, TenantQuotaAdjustDTO dto);

    void setAlertThreshold(Long id, Integer threshold);

    List<TenantPackageVO> getPackageList();

    void createPackage(TenantPackageDTO dto);

    void updatePackage(Long id, TenantPackageDTO dto);

    void deletePackage(Long id);

    TenantStatisticsVO getTenantStatistics(String tenantId, String timeRange);

    TenantStatisticsVO.Summary getTenantSummary();
}
