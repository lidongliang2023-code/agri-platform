package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 投入品合规台账（P17 Tab1）。
 *
 * <p>{@code violation} 契约规定「无违规时固定 —」，而库内合规行该列留 NULL。
 * 占位符只在 API 层生成（见 {@link #getViolation()}），库内不写占位值。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_input_compliance")
public class InputComplianceEntity extends ProduceBaseEntity {

    /** 记录编号（业务主键，JSON 字段名 id） */
    @TableId(value = "record_id", type = IdType.INPUT)
    private String id;

    /** 农场ID */
    private String farmId;

    /** 农场名称 */
    private String farmName;

    /** 投入品名称 */
    private String inputName;

    /** 投入品类型：氮肥/磷肥/钾肥/农药/杀菌剂/除草/调节剂/有机肥 */
    private String inputType;

    /** 用量文案，如 50kg/亩 */
    private String dosage;

    /** 违规项描述（库内原值；合规行为 NULL） */
    @JsonIgnore
    @TableField("violation")
    private String violationDesc;

    /** 校验结果：pass / over */
    @TableField("check_result")
    private String result;

    /** 校验日期 */
    private LocalDate checkDate;

    /** 处罚方式（处罚登记后回填） */
    private String punishAction;

    /** 处罚金额（元） */
    private BigDecimal punishAmount;

    /** 整改要求 */
    private String punishRemark;

    /** 处罚登记时间 */
    private LocalDateTime punishTime;

    /**
     * 违规项（契约字段）——无违规时返回 {@code —}。
     *
     * <p>页面直接渲染该字段且无兜底，故占位符必须在此生成。</p>
     *
     * @return 违规描述或 {@code —}
     */
    @JsonProperty("violation")
    public String getViolation() {
        return violationDesc == null || violationDesc.isBlank() ? "—" : violationDesc;
    }
}
