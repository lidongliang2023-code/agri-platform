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

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 流通异常记录（P16）。
 *
 * <p>{@code foundAt} 为展示文案（当天 {@code HH:mm} / 昨天 / 更早 {@code MM-dd HH:mm}），
 * 由 {@code found_time} 派生；{@code found_date} 是冗余列，专供日期筛选，
 * 避免对 {@code found_time} 做函数运算导致索引失效。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_circulation_anomaly")
public class CirculationAnomalyEntity extends ProduceBaseEntity {

    /** 异常编号（业务主键，JSON 字段名 id） */
    @TableId(value = "anomaly_id", type = IdType.INPUT)
    private String id;

    /** 批次号 */
    private String batchNo;

    /** 产品名称 */
    @TableField("product_name")
    private String product;

    /** 异常类型：temperature / overtime / label */
    @TableField("anomaly_type")
    private String type;

    /** 严重程度：severe / medium / minor */
    private String severity;

    /** 影响范围，如 50kg */
    @TableField("impact_range")
    private String impact;

    /** 发现时间：仅入库用，序列化时由 {@link #getFoundAt()} 以文案形式对外 */
    @JsonIgnore
    private LocalDateTime foundTime;

    /** 发现日期（冗余列，供筛选；JSON 字段名 foundDate） */
    private LocalDate foundDate;

    /** 处理状态：pending / processing / done */
    private String status;

    /** 处置方式（处理后回填） */
    private String measure;

    /** 处置说明 */
    private String handleRemark;

    /** 处置人 */
    private Long handleBy;

    /** 处置时间 */
    private LocalDateTime handleTime;

    /**
     * 列表展示用发现时间文案（契约字段 {@code foundAt}）。
     *
     * @return 展示文案；未记录时为 null
     */
    @JsonProperty("foundAt")
    public String getFoundAt() {
        return FoodSafetyFormat.eventTime(foundTime);
    }
}
