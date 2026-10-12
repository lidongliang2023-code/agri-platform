package com.agri.admin.service;

import com.agri.admin.dto.QualityRuleSaveDTO;
import com.agri.admin.dto.QualityTaskSaveDTO;
import com.agri.admin.vo.QualityRuleVO;
import com.agri.admin.vo.QualityTaskVO;

import java.util.List;

/**
 * 质量规则与检测任务。
 *
 * <p>单列一个接口而不是塞进 {@code IAdminQualityService}：后者管的是"问题"这一侧
 * （问题列表、处置、统计），规则与任务是配置侧的另一种实体，混在一个类里会让
 * 那个类继续膨胀（它已经有 7 个方法、300 多行）。</p>
 */
public interface IAdminQualityRuleService {

    List<QualityRuleVO> getRuleList(String ruleType, String status, String keyword);

    void createRule(QualityRuleSaveDTO dto);

    void updateRule(Long id, QualityRuleSaveDTO dto);

    void deleteRule(Long id);

    List<QualityTaskVO> getTaskList(String status, String keyword);

    void createTask(QualityTaskSaveDTO dto);

    void updateTask(Long id, QualityTaskSaveDTO dto);

    void deleteTask(Long id);

    /**
     * 手工触发一次巡检。
     *
     * <p><b>这不是真实的规则计算</b>：检测引擎尚未实现。它做的是把"谁在什么时候触发了一次"
     * 记录下来，并回填该任务关联规则当前未解决问题的条数。成功率不编 —— 没有执行引擎时
     * "成功率"没有语义，留空由页面显示"—"。</p>
     */
    QualityTaskVO runTask(Long id);
}
