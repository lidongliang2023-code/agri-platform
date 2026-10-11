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

import java.time.LocalDateTime;

/**
 * 产品标签合规校验（P17 Tab2，必填字段按 GB 7718 取 10 项）。
 *
 * <p>两个字段需在 API 层做展示适配，均在库内保留原值：
 * {@code missingFields} 无缺失时契约规定为 {@code —}；
 * {@code checkedAt} 契约要求 {@code yyyy-MM-dd HH:mm}（平台默认序列化带秒）。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_label_compliance")
public class LabelComplianceEntity extends ProduceBaseEntity {

    /** 标签编号（业务主键，JSON 字段名 id） */
    @TableId(value = "label_id", type = IdType.INPUT)
    private String id;

    /** 产品名称 */
    private String productName;

    /** 生产者 */
    private String producer;

    /** 标签版本，如 V2.1 */
    private String labelVersion;

    /** 必填字段总数（GB 7718 口径 10） */
    private Integer requiredFields;

    /** 已填写字段数 */
    private Integer filledFields;

    /** 缺失字段（库内原值；无缺失时为 NULL） */
    @JsonIgnore
    @TableField("missing_fields")
    private String missingFieldsText;

    /** 标识合规性：compliant / violation */
    @TableField("marking_result")
    private String marking;

    /** 标识校验说明 */
    private String markingNote;

    /** 校验结论：pass / fail */
    @TableField("check_result")
    private String result;

    /** 校验时间（仅入库用，序列化时由 {@link #getCheckedAt()} 按契约格式化） */
    @JsonIgnore
    @TableField("checked_at")
    private LocalDateTime checkTime;

    /** 整改状态：none / notified / done */
    private String rectifyStatus;

    /** 整改期限（文案或日期） */
    private String rectifyDeadline;

    /** 整改要求 */
    private String rectifyRemark;

    /** 下发整改时间 */
    private LocalDateTime rectifyTime;

    /**
     * 缺失字段（契约字段）——无缺失时返回 {@code —}。
     *
     * @return 缺失字段清单或 {@code —}
     */
    @JsonProperty("missingFields")
    public String getMissingFields() {
        return missingFieldsText == null || missingFieldsText.isBlank() ? "—" : missingFieldsText;
    }

    /**
     * 校验时间文案（契约字段 {@code checkedAt}，格式 {@code yyyy-MM-dd HH:mm}）。
     *
     * @return 格式化文案；未校验时为 null
     */
    @JsonProperty("checkedAt")
    public String getCheckedAt() {
        return FoodSafetyFormat.dateTime(checkTime);
    }
}
