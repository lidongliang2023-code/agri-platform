package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AdminFsInputComplianceVO;
import com.agri.production.vo.AdminFsLabelComplianceVO;
import com.agri.production.vo.AdminFsStandardItemVO;
import com.agri.production.vo.AdminFsStandardOptionVO;
import com.agri.production.vo.AdminFsStandardSummaryVO;

import java.math.BigDecimal;
import java.util.List;

/**
 * 运营端：食品安全-合规校验管理（P17 三个 Tab）。
 *
 * <p>端点前缀 {@code /api/v1/production/admin/food-safety/compliance}。表由
 * schema-patch-food-safety.sql 建立、演示数据由 schema-patch-food-safety-data-compliance.sql 灌入。</p>
 *
 * <p>与检测子域（{@link IAdminFoodSafetyService}）同口径：不做租户过滤、不调 TenantContextService。</p>
 */
public interface IAdminFoodSafetyComplianceService {

    /** 投入品合规台账分页（result / farmName / keyword 均可选；keyword 匹配投入品名与记录编号）。 */
    PageResult<AdminFsInputComplianceVO> pageInputs(int pageNum, int pageSize, String result, String farmName,
                                                   String keyword);

    /**
     * 超标处罚登记。
     *
     * <p>只有 {@code over} 记录能处罚：合规记录没有可处罚的事实基础。守卫与页面一致
     * （处罚按钮只在 {@code result === 'over'} 时出现），但页面守卫不能当服务端守卫用。</p>
     *
     * @throws com.agri.production.common.exception.BusinessException 记录不存在（404）/ 参数缺失（400）/ 记录非超标（400）
     */
    AdminFsInputComplianceVO punishInput(String recordId, String action, BigDecimal amount, String remark);

    /** 产品标签合规分页（result / productName / keyword 均可选；keyword 匹配生产者与标签编号）。 */
    PageResult<AdminFsLabelComplianceVO> pageLabels(int pageNum, int pageSize, String result, String productName,
                                                   String keyword);

    /**
     * 下发标签整改通知：整改状态置 {@code notified}，落期限与要求。
     *
     * @throws com.agri.production.common.exception.BusinessException 标签不存在（404）/ 参数缺失或超长（400）
     */
    AdminFsLabelComplianceVO rectifyLabel(String labelId, String deadline, String remark);

    /** 行业标准下拉（仅启用项，按排序号；出参是 value/label 形状）。 */
    List<AdminFsStandardOptionVO> listStandards();

    /**
     * 某标准的校验项明细（按抽检时间倒序）。
     *
     * @throws com.agri.production.common.exception.BusinessException 标准不存在（404）
     */
    List<AdminFsStandardItemVO> listStandardItems(String standardNo);

    /**
     * 某标准的校验汇总。
     *
     * @throws com.agri.production.common.exception.BusinessException 标准不存在（404）或尚无汇总（404，提示先执行自动校验）
     */
    AdminFsStandardSummaryVO standardSummary(String standardNo);

    /**
     * 执行标准自动校验（真实重算，不是"刷新一下"）。
     *
     * <p>以窗口内的抽检明细为唯一输入，按批次分组，**同批次所有项都非 fail 才算该批次通过**，
     * 结果 upsert 进汇总表；明细不改写。</p>
     *
     * @param standardNo  路径参数中的标准编号
     * @param bodyStandardNo 请求体里的标准编号（可空；与路径不一致时报 400，而不是静默取其中一个）
     * @param batchScope  last7d / last30d / quarter → 7 / 30 / 90 天
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 标准不存在（404）
     */
    AdminFsStandardSummaryVO runStandard(String standardNo, String bodyStandardNo, String batchScope);
}
