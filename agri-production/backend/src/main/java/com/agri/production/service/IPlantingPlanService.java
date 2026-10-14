package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.dto.PlantingPlanSaveDTO;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.vo.PlantingPlanVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;
import java.util.Map;

/**
 * 种养计划（作物/品种/周期/预期产量）。
 *
 * <p>方法分两组：</p>
 * <ul>
 *   <li>实体查询（{@code queryPage} / {@code getPlansByXxx}）—— 早期按实体直接出参的写法，保留；</li>
 *   <li>契约方法（{@code pageByContract} / {@code detail} / {@code createByContract} …）——
 *   按前端 {@code api/production-view.ts} 真正调用的路径和字段名实现，出参统一走
 *   {@link PlantingPlanVO}（状态码值与日期格式都在那里收敛）。</li>
 * </ul>
 */
public interface IPlantingPlanService extends IService<PlantingPlan> {

    IPage<PlantingPlan> queryPage(Page<PlantingPlan> page, Long farmId, String planName, Integer planYear, String planStatus);

    List<PlantingPlan> getPlansByFarmId(Long farmId);

    List<PlantingPlan> getPlansByYear(Integer planYear);

    List<PlantingPlan> getPlansByStatus(String planStatus);

    boolean approvePlan(Long id, String approver, String comment);

    boolean submitPlan(Long id);

    /* ==================== 前端契约方法 ==================== */

    /**
     * 分页查询（前端 {@code GET /plans}）。
     *
     * @param keyword   计划名称 / 计划编码模糊关键字（前端字段名是 keyword）
     * @param status    前端契约码值 1..5
     * @param planStatus 直接给词表值（与 status 二者取其一）
     * @return 契约分页结果
     */
    PageResult<PlantingPlanVO> pageByContract(int pageNum, int pageSize, String keyword, Integer status,
                                             String planStatus, Long farmId, Integer planYear, String tenantId);

    /** 详情（前端 {@code GET /plans/{id}}）。 */
    PlantingPlanVO detail(Long id, String tenantId);

    /** 新增（前端 {@code POST /plans}）。 */
    PlantingPlan createByContract(PlantingPlanSaveDTO dto, String tenantId);

    /** 编辑（前端 {@code PUT /plans/{id}}）。 */
    PlantingPlan updateByContract(Long id, PlantingPlanSaveDTO dto, String tenantId);

    /** 逻辑删除（前端 {@code DELETE /plans/{id}}）。 */
    void deletePlan(Long id, String tenantId);

    /** 启动 / 提交（前端 {@code POST /plans/{id}/start}，{@code /submit} 同一实现）。 */
    PlantingPlan startPlan(Long id, String tenantId);

    /** 终止（前端 {@code POST /plans/{id}/terminate}）。 */
    PlantingPlan terminatePlan(Long id, String tenantId);

    /** 计划日历：按计划开始月份聚合数量与面积（前端 {@code GET /plans/calendar}）。 */
    List<Map<String, Object>> calendar(String tenantId);
}
