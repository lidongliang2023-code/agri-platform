package com.agri.production.vo;

import com.agri.production.common.constant.AlertDict;
import com.agri.production.entity.AlertRecord;
import lombok.Data;

import java.math.BigDecimal;
import java.time.format.DateTimeFormatter;

/**
 * 告警出参（页面 {@code Alert}）。
 *
 * <p>字段口径与页面 {@code packages/agri-shared/src/types/alert.ts} 的 {@code Alert} 对齐，
 * 与平台侧 {@code AlertVO} 同形（这样切流前后页面拿到的结构一致）：</p>
 *
 * <table>
 *   <tr><th>页面字段</th><th>本服务列</th></tr>
 *   <tr><td>alertId</td><td>alert_code（业务编号，处置/忽略都按它定位）</td></tr>
 *   <tr><td>alertTitle / alertContent</td><td>title / content</td></tr>
 *   <tr><td>alertLevel / alertSource / status</td><td>level / source_type / status（经 AlertDict 转数字）</td></tr>
 *   <tr><td>triggerValue</td><td>value</td></tr>
 *   <tr><td>triggeredAt / handledAt</td><td>create_time / handle_time</td></tr>
 *   <tr><td>handlerName / handleRemark</td><td>handle_user / handle_result</td></tr>
 *   <tr><td>ruleId</td><td>rule_code</td></tr>
 * </table>
 *
 * <p>库里确实没有的字段一律 null，不编造：{@code alertNo}、{@code plotName}、
 * {@code deviceId}、{@code handlerId} —— 页面按「—」渲染，好过填一个看起来像真的占位串。</p>
 */
@Data
public class UserAlertVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String alertId;
    /** 告警编号：库内无该列（业务编号在 alertId 里），恒为 null */
    private String alertNo;
    private String alertTitle;
    private String alertContent;
    /** 1 提示 / 2 一般 / 3 严重 / 4 紧急 */
    private Integer alertLevel;
    /** 1 环境 / 2 设备 / 3 病虫害 / 4 任务 / 5 投入品 */
    private Integer alertSource;
    private String farmId;
    private String plotId;
    /** 地块名称：库内无该列（需联查地块表），恒为 null */
    private String plotName;
    /** 设备编号：库内无该列（source_name 是设备名而不是 ID），恒为 null */
    private String deviceId;
    private String ruleId;
    /** 触发值（对应库内 value） */
    private BigDecimal triggerValue;
    /** 1 未处理 / 2 处理中 / 3 已处理 / 4 已忽略 */
    private Integer status;
    /** 处理人 ID：库内无该列，恒为 null */
    private String handlerId;
    /** 处理人（对应库内 handle_user；演示数据里是成员编号） */
    private String handlerName;
    private String handleRemark;
    /** 触发时间（库内没有单独的告警时间列，取 create_time —— 演示数据两者同值） */
    private String triggeredAt;
    private String handledAt;

    public static UserAlertVO of(AlertRecord entity) {
        if (entity == null) {
            return null;
        }
        UserAlertVO vo = new UserAlertVO();
        vo.alertId = entity.getAlertCode();
        vo.alertTitle = entity.getTitle();
        vo.alertContent = entity.getContent();
        vo.alertLevel = AlertDict.codeOfLevel(entity.getLevel());
        vo.alertSource = AlertDict.codeOfSource(entity.getSourceType());
        vo.farmId = entity.getFarmId() == null ? null : String.valueOf(entity.getFarmId());
        vo.plotId = entity.getPlotId() == null ? null : String.valueOf(entity.getPlotId());
        vo.ruleId = entity.getRuleCode();
        vo.triggerValue = entity.getValue();
        vo.status = AlertDict.codeOfStatus(entity.getStatus());
        vo.handlerName = entity.getHandleUser();
        vo.handleRemark = entity.getHandleResult();
        vo.triggeredAt = entity.getCreateTime() == null ? null : DATE_TIME.format(entity.getCreateTime());
        vo.handledAt = entity.getHandleTime() == null ? null : DATE_TIME.format(entity.getHandleTime());
        return vo;
    }
}
