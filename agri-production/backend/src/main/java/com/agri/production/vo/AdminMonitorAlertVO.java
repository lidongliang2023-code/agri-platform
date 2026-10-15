package com.agri.production.vo;

import com.agri.production.entity.AlertRecord;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 运营端实时告警流出参（页面 MonitorCenter 读 alertId / alertTitle / alertContent /
 * alertLevel / alertTime / status / farmId / plotName）。
 *
 * <p><b>level 与 status 原样透出文本</b>（库里是 warning / error / unhandled 这类词表）。
 * 页面自己带了解析器（能认 URGENT/WARN/INFO 与数字两种），把文本改成数字反而会撞上它另一套分支。
 * 前端类型写的是数字枚举，但页面的实现是"两种都接"——按实际实现走，不按类型注释走。</p>
 */
@Data
public class AdminMonitorAlertVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String alertId;
    private String alertNo;
    private String alertTitle;
    private String alertContent;
    /** 库里原值（warning / error / critical …），页面自有解析 */
    private String alertLevel;
    private String alertSource;
    private String farmId;
    private String plotId;
    private String plotName;
    private Long deviceId;
    private Long ruleId;
    private String ruleCode;
    /** 触发值（实测值） */
    private java.math.BigDecimal triggerValue;
    private String unit;
    private java.math.BigDecimal thresholdMin;
    private java.math.BigDecimal thresholdMax;
    /** 库里原值（unhandled / handled …） */
    private String status;
    private String handlerId;
    private String handleTime;
    private String handleResult;
    private String alertTime;
    private String emergencyPlanId;

    public static AdminMonitorAlertVO of(AlertRecord entity, String plotName) {
        if (entity == null) {
            return null;
        }
        AdminMonitorAlertVO vo = new AdminMonitorAlertVO();
        vo.alertId = entity.getId() == null ? null : String.valueOf(entity.getId());
        vo.alertNo = entity.getAlertCode();
        vo.alertTitle = entity.getTitle();
        vo.alertContent = entity.getContent();
        vo.alertLevel = entity.getLevel();
        vo.alertSource = entity.getSourceType();
        vo.farmId = entity.getFarmId() == null ? null : String.valueOf(entity.getFarmId());
        vo.plotId = entity.getPlotId() == null ? null : String.valueOf(entity.getPlotId());
        vo.plotName = plotName;
        vo.deviceId = "device".equalsIgnoreCase(entity.getSourceType()) ? entity.getSourceId() : null;
        vo.ruleId = entity.getRuleId();
        vo.ruleCode = entity.getRuleCode();
        vo.triggerValue = entity.getValue();
        vo.unit = entity.getUnit();
        vo.thresholdMin = entity.getThresholdMin();
        vo.thresholdMax = entity.getThresholdMax();
        vo.status = entity.getStatus();
        vo.handlerId = entity.getHandleUser();
        vo.handleTime = entity.getHandleTime() == null ? null : DATE_TIME.format(entity.getHandleTime());
        vo.handleResult = entity.getHandleResult();
        vo.alertTime = entity.getCreateTime() == null ? null : DATE_TIME.format(entity.getCreateTime());
        vo.emergencyPlanId = entity.getEmergencyPlanId() == null
                ? null : String.valueOf(entity.getEmergencyPlanId());
        return vo;
    }
}
