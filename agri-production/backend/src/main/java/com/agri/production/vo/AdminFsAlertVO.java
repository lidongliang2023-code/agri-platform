package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyAlert;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 食品安全告警出参（页面 {@code FoodSafetyAlert}）。
 *
 * <p>出参名与库列不是一套，逐项映射：{@code alert_id→id}、{@code alert_type→type}、
 * {@code target_name→target}、{@code relate_code→code}、{@code happen_time→time}。
 * 页面是按这几个短名渲染的（原型 P15 的口径），返实体的话整表都是 undefined。</p>
 */
@Data
public class AdminFsAlertVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String id;
    private String type;
    /** 告警对象（农场名称） */
    private String target;
    private String code;
    /** 发生时间，{@code yyyy-MM-dd HH:mm:ss} */
    private String time;
    /** urgent / important / normal */
    private String level;
    /** 待处理 / 处理中 / 已处理 */
    private String status;
    /** 处置措施（已处理时才有） */
    private String measure;
    private String handleRemark;
    private String handleTime;

    public static AdminFsAlertVO of(FoodSafetyAlert entity) {
        if (entity == null) {
            return null;
        }
        AdminFsAlertVO vo = new AdminFsAlertVO();
        vo.id = entity.getAlertId();
        vo.type = entity.getAlertType();
        vo.target = entity.getTargetName();
        vo.code = entity.getRelateCode();
        vo.time = entity.getHappenTime() == null ? null : DATE_TIME.format(entity.getHappenTime());
        vo.level = entity.getLevel();
        vo.status = entity.getStatus();
        vo.measure = entity.getMeasure();
        vo.handleRemark = entity.getHandleRemark();
        vo.handleTime = entity.getHandleTime() == null ? null : DATE_TIME.format(entity.getHandleTime());
        return vo;
    }
}
