package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.entity.Inspection;
import com.agri.production.vo.AdminQualityLabVO;

import java.util.List;
import java.util.Map;

/**
 * 运营端质量监管（/api/v1/production/admin/quality）。
 *
 * <p>与 {@link IAdminTraceService} 同一口径：**不做租户过滤**（运营端看全局），
 * 也不能调 {@code TenantContextService.currentTenantId()}（运营账号未必绑定经营主体，一调就 403）。
 * 访问控制由平台 RBAC 的 operator-paths + production:read/write 承担。</p>
 */
public interface IAdminQualityService {

    /** 检测机构分页（关键字匹配机构名称）。 */
    PageResult<AdminQualityLabVO> pageLabs(int pageNum, int pageSize, String keyword);

    /** 机构资质认可：status → 1（合作中）。 */
    AdminQualityLabVO accredit(Long labId);

    /**
     * 机构准入驳回：status → 0（已终止）。
     *
     * @param rejectReason 驳回原因，可空；填了就落库，**不覆盖**历史值之外什么都不做（不丢输入）
     */
    AdminQualityLabVO reject(Long labId, String rejectReason);

    /** 检测台账分页（result / status 均可选，缺失即不过滤）。 */
    PageResult<Inspection> pageInspections(int pageNum, int pageSize, String result, String status);

    /** 不合格检测清单（result = FAIL）。 */
    List<Inspection> listFailed();

    /** 质量总览：合格/不合格/合格率/合作机构数/已冻结批次数。 */
    Map<String, Object> overview();

    /**
     * 不合格批次召回：冻结批次（status → 4）。
     *
     * @return 冻结后的批次快照（前端只要 batchId / status 两个字段）
     * @throws com.agri.production.common.exception.BusinessException 批次不存在（404）/ batchId 非法（400）
     */
    Map<String, Object> recallBatch(String batchId);
}
