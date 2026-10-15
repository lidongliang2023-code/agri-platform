package com.agri.production.vo;

import com.agri.production.entity.FoodSafetyLabelCompliance;
import lombok.Data;

import java.time.format.DateTimeFormatter;

/**
 * 产品标签合规出参（页面 {@code LabelComplianceRecord}）。
 *
 * <p>映射：{@code label_id→id}、{@code marking_result→marking}、{@code check_result→result}、
 * {@code checked_at→checkedAt}。整改四件套（状态/期限/要求/时间）一并透出，
 * 页面详情抽屉要用它们说明"通知下给谁、要求什么、什么时候下的"。</p>
 */
@Data
public class AdminFsLabelComplianceVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String id;
    private String productName;
    private String producer;
    private String labelVersion;
    private Integer requiredFields;
    private Integer filledFields;
    /** 缺失字段（顿号分隔）；无缺失返回空串 */
    private String missingFields;
    /** compliant / violation */
    private String marking;
    private String markingNote;
    /** pass / fail */
    private String result;
    private String checkedAt;
    /** none / notified / done */
    private String rectifyStatus;
    private String rectifyDeadline;
    private String rectifyRemark;
    private String rectifyTime;

    public static AdminFsLabelComplianceVO of(FoodSafetyLabelCompliance entity) {
        if (entity == null) {
            return null;
        }
        AdminFsLabelComplianceVO vo = new AdminFsLabelComplianceVO();
        vo.id = entity.getLabelId();
        vo.productName = entity.getProductName();
        vo.producer = entity.getProducer();
        vo.labelVersion = entity.getLabelVersion();
        vo.requiredFields = entity.getRequiredFields();
        vo.filledFields = entity.getFilledFields();
        vo.missingFields = entity.getMissingFields() == null ? "" : entity.getMissingFields();
        vo.marking = entity.getMarkingResult();
        vo.markingNote = entity.getMarkingNote();
        vo.result = entity.getCheckResult();
        vo.checkedAt = entity.getCheckedAt() == null ? null : DATE_TIME.format(entity.getCheckedAt());
        vo.rectifyStatus = entity.getRectifyStatus();
        vo.rectifyDeadline = entity.getRectifyDeadline();
        vo.rectifyRemark = entity.getRectifyRemark();
        vo.rectifyTime = entity.getRectifyTime() == null ? null : DATE_TIME.format(entity.getRectifyTime());
        return vo;
    }
}
