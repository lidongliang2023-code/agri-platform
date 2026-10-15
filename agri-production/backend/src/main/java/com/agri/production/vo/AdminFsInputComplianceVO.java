package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyInputCompliance;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 投入品合规台账出参（页面 {@code InputComplianceRecord}）。
 *
 * <p>映射：{@code record_id→id}、{@code check_result→result}、{@code check_date→checkDate}。
 * 出参只有页面真正消费的 8 个字段 —— 处罚方式/金额不单独暴露：处罚登记会把处理痕迹
 * 追加进 {@code violation}，页面从那一处读，两处各写一份迟早会不一致。</p>
 */
@Data
public class AdminFsInputComplianceVO {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private String id;
    private String farmName;
    private String inputName;
    /** 氮肥 / 农药 / 除草 等 */
    private String inputType;
    /** 用量文案，如 20kg/亩 */
    private String dosage;
    /** pass / over */
    private String result;
    /** 违规项描述；无违规返回空串（页面直接渲染，不想要 "null" 二字） */
    private String violation;
    /** yyyy-MM-dd */
    private String checkDate;

    public static AdminFsInputComplianceVO of(FoodSafetyInputCompliance entity) {
        if (entity == null) {
            return null;
        }
        AdminFsInputComplianceVO vo = new AdminFsInputComplianceVO();
        vo.id = entity.getRecordId();
        vo.farmName = entity.getFarmName();
        vo.inputName = entity.getInputName();
        vo.inputType = entity.getInputType();
        vo.dosage = entity.getDosage();
        vo.result = entity.getCheckResult();
        vo.violation = entity.getViolation() == null ? "" : entity.getViolation();
        vo.checkDate = entity.getCheckDate() == null ? null : DATE.format(entity.getCheckDate());
        return vo;
    }
}
