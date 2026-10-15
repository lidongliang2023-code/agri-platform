package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AdminTraceCodeVO;

import java.util.List;
import java.util.Map;

/**
 * 运营端溯源监管（/api/v1/production/admin/trace）。
 *
 * <p><b>这些接口不做租户过滤</b>：运营端是平台运营方看全局的台子，与用户端"一主体一租户"不同。
 * 同域既有的 {@code ProductionAdminController} 也是这个口径（mapper 调用传 tenantId=null）。
 * 另外**不能**在这里调 {@code TenantContextService.currentTenantId()} —— 它要求账号绑定经营主体，
 * 而运营人员未必绑了主体，一调就是 403"当前账号还没有绑定经营主体"。
 * 访问控制由平台 RBAC 承担（application.yml 的 platform.rbac.operator-paths + production:read/write）。</p>
 */
public interface IAdminTraceService {

    /** 溯源码分页（status 为空 = 全部）。 */
    PageResult<AdminTraceCodeVO> pageCodes(int pageNum, int pageSize, String status);

    /** 码段统计：按 generated / active / scanned / revoked 四个状态计数。 */
    Map<String, Object> codeStats();

    /** 全链条回溯：码 → 批次 → 检测记录。 */
    Map<String, Object> chain(String code);

    /** 溯源链关联的检测机构（合作中）。 */
    List<Map<String, Object>> labs();

    /**
     * 一键召回：作废该批次下全部溯源码并冻结批次。
     *
     * @return 作废的溯源码条数（批次存在但名下无码时为 0 —— 此时批次**仍已冻结**）
     * @throws com.agri.production.common.exception.BusinessException 批次不存在（404）/ batchId 非法（400）
     */
    int recall(String batchId);
}
