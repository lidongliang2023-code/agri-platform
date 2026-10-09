package com.agri.produce.internal.alert;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import lombok.Data;

/**
 * 告警对外视图：字段与口径对齐前端 {@code src/types/alert.ts} 的 {@code Alert}。
 *
 * <p><b>为什么需要 VO 而不是直接返回实体。</b>实体 {@link AlertInfoEntity} 对外暴露的是
 * 库内英文枚举（{@code PENDING/HANDLED}）与下划线风格时间字段（{@code alertTime}），
 * 而前端 {@code Alert.status} 是 {@code 1/2/3/4} 数字、时间字段叫
 * {@code triggeredAt/handledAt}。直接返回实体会让告警中心的
 * {@code status === 1} 判定全部失效——页面能渲染、筛选永远筛不出东西，是典型的假功能。
 *
 * <p><b>后端没有的字段一律 null，不编造。</b>{@code alertNo}、{@code alertContent}、
 * {@code plotName}、{@code handlerName} 在 {@code prod_alert_info} 中无对应列，
 * 置 null 由前端显示「—」，好过填占位串让运营误以为已落库。
 */
@Data
@JsonInclude(JsonInclude.Include.ALWAYS)
public class AlertVO {

    private String alertId;

    /** 告警编号：库内无该列，恒为 null，前端显示「—」 */
    private String alertNo;

    private String alertTitle;

    /** 告警内容：库内无该列，恒为 null，前端显示「—」 */
    private String alertContent;

    /** 告警级别：1 提示 2 一般 3 严重 4 紧急 */
    private Integer alertLevel;

    /** 告警来源：1 环境 2 设备 3 病虫害 4 任务 5 投入品 */
    private Integer alertSource;

    private String farmId;

    private String plotId;

    /** 地块名称：库内无该列（需联查 prod_plot_info），恒为 null */
    private String plotName;

    private String deviceId;

    private String ruleId;

    /** 触发值（对应库内 metric_value） */
    private BigDecimal triggerValue;

    /** 状态：1 未处理 2 处理中 3 已处理 4 已忽略 */
    private Integer status;

    /** 处理人 ID：库内无该列（prod_alert_info 只有 handle_by），恒为 null */
    private String handlerId;

    /** 处理人姓名（对应库内 handle_by） */
    private String handlerName;

    private String handleRemark;

    /** 触发时间（对应库内 alert_time） */
    private LocalDateTime triggeredAt;

    /** 处理时间（对应库内 handle_time） */
    private LocalDateTime handledAt;

    /**
     * 实体 → 视图。
     *
     * @param entity 库内实体
     * @return 对外视图；入参为空返回 null
     */
    public static AlertVO from(AlertInfoEntity entity) {
        if (entity == null) {
            return null;
        }
        AlertVO vo = new AlertVO();
        vo.setAlertId(entity.getAlertId());
        vo.setAlertTitle(entity.getAlertTitle());
        vo.setAlertLevel(AlertDict.codeOfLevel(entity.getAlertLevel()));
        vo.setAlertSource(entity.getAlertSource());
        vo.setFarmId(entity.getFarmId());
        vo.setPlotId(entity.getPlotId());
        vo.setDeviceId(entity.getDeviceId());
        vo.setRuleId(entity.getRuleId());
        vo.setTriggerValue(entity.getMetricValue());
        vo.setStatus(AlertDict.codeOfStatus(entity.getStatus()));
        vo.setHandlerName(entity.getHandleBy());
        vo.setHandleRemark(entity.getHandleRemark());
        vo.setTriggeredAt(entity.getAlertTime());
        vo.setHandledAt(entity.getHandleTime());
        return vo;
    }
}
