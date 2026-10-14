package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.dto.InspectionSaveDTO;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.QualityGradeRule;
import com.agri.production.entity.TestingLab;

import java.util.List;
import java.util.Map;

/**
 * 质量管理（检测单 / 检测机构 / 分级统计）。
 *
 * <p>所有方法都带 tenantId：这个域没有独立的租户字段来源，必须由控制器从
 * {@link TenantContextService} 解析后传进来。</p>
 */
public interface IQualityService {

    /* ---------- 检测单 ---------- */

    PageResult<Inspection> pageInspections(int pageNum, int pageSize, String keyword, String status, Long farmId,
                                           Long batchId, String inspectionType, String result,
                                           String startDate, String endDate, String tenantId);

    Inspection detail(Long inspectionId, String tenantId);

    Inspection create(InspectionSaveDTO dto, String tenantId);

    Inspection update(Long inspectionId, InspectionSaveDTO dto, String tenantId);

    void delete(Long inspectionId, String tenantId);

    /** 批次下的检测记录（前端溯源页按批次查）。 */
    List<Inspection> byBatch(Long batchId, String tenantId);

    /**
     * 检测项明细（前端 {@code GET /quality/inspections/{id}/items}）。
     *
     * <p>返回的是契约 {@code InspectionItemDetail} 那个"头部 + 明细数组"的形状：
     * 页面当前是从头部字段派生出一行展示（源码里 itemName 取 {@code item ?? inspectionType}），
     * 明细数组留空 —— 逐项明细（{@code InspectionItem[]}）页面还没有消费，
     * 为它建表建实体是"建了没人读"，等页面真正消费时再补。</p>
     */
    Map<String, Object> items(Long inspectionId, String tenantId);

    /** 提交检测结论（PASS / FAIL），并置状态为 DONE。 */
    Inspection submitResult(Long inspectionId, String result, String reportUrl, String tenantId);

    /** 分级统计：{@code {"PASS": n, "FAIL": n}}（前端 fetchGradingStats 读它）。 */
    Map<String, Long> gradingStats(String tenantId);

    /* ---------- 分级规则 ---------- */

    /**
     * 分页查询分级规则（前端 {@code listGradeRules}）。
     *
     * <p>它与 {@link #gradingStats} 打的是同一个 GET 路径，靠"有没有分页/筛选参数"分流 ——
     * 见控制器的说明。</p>
     */
    PageResult<QualityGradeRule> pageGradeRules(int pageNum, int pageSize, Long cropId, Integer status, String tenantId);

    QualityGradeRule createGradeRule(QualityGradeRule rule, String tenantId);

    QualityGradeRule updateGradeRule(Long ruleId, QualityGradeRule rule, String tenantId);

    void deleteGradeRule(Long ruleId, String tenantId);

    /* ---------- 检测机构 ---------- */

    PageResult<TestingLab> pageLabs(int pageNum, int pageSize, String keyword, Integer status, String tenantId);

    /** 合作中的检测机构（下拉用）。 */
    List<TestingLab> activeLabs(String tenantId);

    TestingLab createLab(TestingLab lab, String tenantId);

    TestingLab updateLab(Long labId, TestingLab lab, String tenantId);

    void deleteLab(Long labId, String tenantId);
}
