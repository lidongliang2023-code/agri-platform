package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.dto.InputInfoSaveDTO;
import com.agri.production.dto.InputUsageSaveDTO;
import com.agri.production.entity.InputMaterial;
import com.agri.production.entity.InputStockFlow;
import com.agri.production.vo.InputStockFlowVO;
import com.agri.production.entity.InputUsageRecord;

import java.math.BigDecimal;
import java.util.List;

/**
 * 农资投入品（档案 / 库存流水 / 使用记录）。
 *
 * <p>所有方法都带 tenantId：这个域没有独立的租户字段来源，必须由控制器从
 * {@link TenantContextService} 解析后传进来 —— 少传一个入口就是"跨主体看得到别人的农资"。</p>
 */
public interface IInputService {

    /* ---------- 投入品档案 ---------- */

    PageResult<InputMaterial> page(int pageNum, int pageSize, String keyword, Integer status, String inputType, String tenantId);

    InputMaterial detail(Long inputId, String tenantId);

    InputMaterial create(InputInfoSaveDTO dto, String tenantId);

    InputMaterial update(Long inputId, InputInfoSaveDTO dto, String tenantId);

    void delete(Long inputId, String tenantId);

    /** 低库存清单（库存 ≤ 预警阈值）。 */
    List<InputMaterial> warningList(String tenantId);

    /** 库存总览：低库存优先（页面用它做"该补货了"的排序）。 */
    List<InputMaterial> stockOverview(String tenantId);

    /* ---------- 库存流水 ---------- */

    PageResult<InputStockFlow> pageFlows(Long inputId, int pageNum, int pageSize, Integer flowType, String tenantId);

    /**
     * 跨投入品分页查询库存流水（服务端筛选 / 排序，支持数据持续增长）。
     *
     * @param pageNum 页码
     * @param pageSize 每页条数
     * @param flowType 流水类型（可空）
     * @param batchNo 批次号模糊（可空）
     * @param startDate 开始日期 yyyy-MM-dd（可空）
     * @param endDate 结束日期 yyyy-MM-dd（可空）
     * @param tenantId 当前租户
     * @returns 流水分页（含投入品名称 / 单位）
     */
    PageResult<InputStockFlowVO> pageAllFlows(int pageNum, int pageSize, Integer flowType,
                                              String batchNo, String startDate, String endDate,
                                              String tenantId);

    InputStockFlow createFlow(Long inputId, InputStockFlow flow, String tenantId);

    void deleteFlow(Long inputId, Long flowId, String tenantId);

    /** 入库：写流水 + 增加库存。 */
    InputMaterial stockIn(Long inputId, BigDecimal qty, String batchNo, String expireDate, Long operatorId, String tenantId);

    /** 领用：写流水 + 扣减库存。 */
    InputMaterial consume(Long inputId, BigDecimal qty, Long relatedTaskId, Long operatorId, String tenantId);

    /* ---------- 使用记录 ---------- */

    PageResult<InputUsageRecord> pageUsages(int pageNum, int pageSize, Integer status, Long inputId, Long plotId,
                                           Long taskId, Long farmId, String tenantId);

    InputUsageRecord createUsage(InputUsageSaveDTO dto, String tenantId);

    InputUsageRecord updateUsage(Long usageId, InputUsageSaveDTO dto, String tenantId);

    void deleteUsage(Long usageId, String tenantId);

    List<InputUsageRecord> usagesByTask(Long taskId, String tenantId);
}
