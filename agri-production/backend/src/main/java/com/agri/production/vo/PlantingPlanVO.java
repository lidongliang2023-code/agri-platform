package com.agri.production.vo;

import com.agri.production.common.constant.PlanStatusDict;
import com.agri.production.entity.PlantingPlan;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;

/**
 * 生产计划出参（前端契约：{@code @agri/shared/types/plan} 的 {@code Plan}）。
 *
 * <p>与 TaskVO / TaskTemplateVO 同一口径：物理列名不动，出参名字对齐前端要读的字段。</p>
 *
 * <p>两处必须转换的地方：</p>
 * <ol>
 *   <li><b>状态</b>：库里 {@code plan_status} 存词表值（draft / pending / active /
 *       completed / terminated），前端契约要 1 编制中 / 2 进行中 / 3 已完结 / 4 已取消 /
 *       5 待审批。转换集中在 {@link PlanStatusDict}，这里只调用它 ——
 *       这一处曾经把 active 映射成 3，页面于是把"进行中"显示成"已完结"、"终止"按钮永不出现。</li>
 *   <li><b>日期</b>：实体用 {@code java.util.Date}，Jackson 默认序列化成**毫秒数**，
 *       而前端 {@code readDate} 是取前 10 个字符 —— 拿到 "1751328000" 会解析成非法日期、
 *       页面显示空。这里直接输出 {@code yyyy-MM-dd} 字符串，两端都不再需要猜。</li>
 * </ol>
 *
 * <p>原始词表值也一并给出（{@code planStatus}）：运营端与排障时需要看库里的真实取值。</p>
 */
@Data
public class PlantingPlanVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private Long planId;
    private String planNo;
    private String planName;

    private Long farmId;
    private String farmName;
    private Long plotId;
    private String plotName;
    private Long cropId;
    private String cropName;
    private String cropVariety;

    /** 计划开始日期（yyyy-MM-dd） */
    private String startDate;
    /** 计划结束日期（yyyy-MM-dd） */
    private String endDate;

    /** 预计产量（前端 expectedYield ← 库里的 expected_output） */
    private BigDecimal expectedYield;
    /** 计划面积（亩，前端 planArea ← 库里的 total_area） */
    private BigDecimal planArea;
    private BigDecimal totalBudget;
    private BigDecimal expectedProfit;
    private Integer planYear;
    private String planSeason;
    private String planSummary;

    private Long managerId;
    private String managerName;
    private Long sopTemplateId;

    private String approvalComment;
    private String approver;
    private String approvalTime;
    private String remark;

    private String createdAt;
    private String updatedAt;

    /** 前端契约码值 1..5（由库里的词表值映射而来） */
    private Integer status;
    /** 库里的原始词表值，排障用 */
    private String planStatus;

    /**
     * 由实体构造出参。
     *
     * @param entity 计划实体
     * @return 出参；入参为 null 时返回 null
     */
    public static PlantingPlanVO of(PlantingPlan entity) {
        if (entity == null) {
            return null;
        }
        PlantingPlanVO vo = new PlantingPlanVO();
        vo.planId = entity.getId();
        vo.planNo = entity.getPlanCode();
        vo.planName = entity.getPlanName();
        vo.farmId = entity.getFarmId();
        vo.farmName = entity.getFarmName();
        vo.plotId = entity.getPlotId();
        vo.plotName = entity.getPlotName();
        vo.cropId = entity.getCropId();
        vo.cropName = entity.getCropName();
        vo.cropVariety = entity.getCropVariety();
        vo.startDate = format(entity.getStartDate(), DATE);
        vo.endDate = format(entity.getEndDate(), DATE);
        vo.expectedYield = entity.getExpectedOutput();
        vo.planArea = entity.getTotalArea();
        vo.totalBudget = entity.getTotalBudget();
        vo.expectedProfit = entity.getExpectedProfit();
        vo.planYear = entity.getPlanYear();
        vo.planSeason = entity.getPlanSeason();
        vo.planSummary = entity.getPlanSummary();
        vo.managerId = entity.getManagerId();
        vo.managerName = entity.getManagerName();
        vo.sopTemplateId = entity.getSopTemplateId();
        vo.approvalComment = entity.getApprovalComment();
        vo.approver = entity.getApprover();
        vo.approvalTime = format(entity.getApprovalTime(), DATE_TIME);
        vo.remark = entity.getRemark();
        vo.createdAt = format(entity.getCreateTime(), DATE_TIME);
        vo.updatedAt = format(entity.getUpdateTime(), DATE_TIME);
        vo.planStatus = entity.getPlanStatus();
        vo.status = PlanStatusDict.toCode(entity.getPlanStatus());
        return vo;
    }

    private static String format(Date value, DateTimeFormatter formatter) {
        if (value == null) {
            return null;
        }
        return formatter.format(value.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime());
    }

    /**
     * LocalDateTime 版本。
     *
     * <p>实体的 create_time / update_time 来自 {@code BaseEntity}，类型是 LocalDateTime，
     * 而 start_date / end_date 是 Date —— 同一份 VO 里两种时间类型并存，
     * 两个重载都得有，否则要么编不过、要么某几个字段悄悄不输出。</p>
     */
    private static String format(LocalDateTime value, DateTimeFormatter formatter) {
        if (value == null) {
            return null;
        }
        return formatter.format(value);
    }
}
