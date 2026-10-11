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
 * 食品安全告警（P15 监控中心列表 + 处置写操作）。
 *
 * <p>字段口径对齐前端 {@code src/api/admin/foodSafety.ts} 的 {@code FoodSafetyAlert}：
 * Java 字段名即 JSON 字段名，列名不一致处用 {@code @TableField} 显式映射。
 * {@code time} 是<strong>展示文案</strong>（如 {@code 07-14 10:30}），由 {@code happen_time}
 * 派生，故不直接对外暴露原始时间。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_alert")
public class FoodSafetyAlertEntity extends ProduceBaseEntity {

    /** 告警编号（业务主键，JSON 字段名 id） */
    @TableId(value = "alert_id", type = IdType.INPUT)
    private String id;

    /** 告警类型：农残超标/重金属超标/农药超量使用/检测报告缺失/冷链温度异常 */
    @TableField("alert_type")
    private String type;

    /** 告警对象（农场名称） */
    @TableField("target_name")
    private String target;

    /** 关联编号，如 #A123 */
    @TableField("relate_code")
    private String code;

    /** 发生时间：仅入库用，序列化时由 {@link #getTime()} 以文案形式对外 */
    @JsonIgnore
    private LocalDateTime happenTime;

    /** 级别：urgent / important / normal */
    private String level;

    /** 处置状态：待处理 / 处理中 / 已处理 */
    private String status;

    /** 处置措施（已处理时回填，取页面下拉的处置措施文案） */
    private String measure;

    /** 处置说明（与处置措施分开存，供审计追溯） */
    private String handleRemark;

    /** 处置人 */
    private Long handleBy;

    /** 处置时间 */
    private LocalDateTime handleTime;

    /**
     * 列表展示用发生时间文案（契约字段 {@code time}）。
     *
     * @return {@code HH:mm} / {@code 昨天} / {@code MM-dd HH:mm}；未发生时为 null
     */
    @JsonProperty("time")
    public String getTime() {
        return FoodSafetyFormat.eventTime(happenTime);
    }
}
