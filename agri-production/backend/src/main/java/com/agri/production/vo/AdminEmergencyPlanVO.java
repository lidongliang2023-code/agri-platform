package com.agri.production.vo;

import com.agri.production.entity.EmergencyPlan;
import lombok.Data;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 运营端应急预案出参（前端 {@code EmergencyPlan}，见 @agri/shared/types/alert）。
 *
 * <p>字段名与库列不是一套，逐项映射（不派生）：{@code id→planId}、{@code plan_type→alertType}、
 * {@code level→responseLevel}、{@code response_steps→process}、{@code responsible_person→ownerName}、
 * {@code contact_info→ownerPhone}、{@code is_enabled→status}、{@code update_time→updatedAt}。</p>
 *
 * <p>{@code responseLevel} 库里存的是文本（"1"/"2"/"一级"…），这里尽力转成前端的 1/2/3；
 * 转不出来给 null（页面显示"—"），不猜一个级别安上去。</p>
 */
@Data
public class AdminEmergencyPlanVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String planId;
    private String planName;
    private String alertType;
    /** 响应级别：1 一级 / 2 二级 / 3 三级；库里文本转不出来时为 null */
    private Integer responseLevel;
    /** 库里原值（便于排查为什么级别显示为空） */
    private String responseLevelText;
    private String process;
    private String ownerName;
    private String ownerPhone;
    /** 1 启用 / 0 停用 */
    private Integer status;
    private String updatedAt;
    private String createdAt;

    public static AdminEmergencyPlanVO of(EmergencyPlan entity) {
        if (entity == null) {
            return null;
        }
        AdminEmergencyPlanVO vo = new AdminEmergencyPlanVO();
        vo.planId = entity.getId() == null ? null : String.valueOf(entity.getId());
        vo.planName = entity.getPlanName();
        vo.alertType = entity.getPlanType();
        vo.responseLevelText = entity.getAlertLevel();
        vo.responseLevel = toResponseLevel(entity.getAlertLevel());
        vo.process = entity.getSteps() != null ? entity.getSteps() : entity.getTriggerCondition();
        vo.ownerName = entity.getResponsiblePerson();
        vo.ownerPhone = entity.getContactInfo();
        vo.status = entity.getIsEnabled() == null ? 1 : (entity.getIsEnabled() == 0 ? 0 : 1);
        vo.updatedAt = format(entity.getUpdateTime());
        vo.createdAt = format(entity.getCreateTime());
        return vo;
    }

    private static String format(LocalDateTime value) {
        return value == null ? null : DATE_TIME.format(value);
    }

    /** "1" / "一级" / "LEVEL_1" → 1；认不出返回 null */
    public static Integer toResponseLevel(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String value = text.trim();
        if (value.matches("[123]")) {
            return Integer.valueOf(value);
        }
        if (value.contains("一")) {
            return 1;
        }
        if (value.contains("二")) {
            return 2;
        }
        if (value.contains("三")) {
            return 3;
        }
        return null;
    }
}
