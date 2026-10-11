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
 * 冷链撮合记录（P19）。
 *
 * <p>契约字段名与列名差异较大，逐项显式映射：{@code supplier ← supplier_name}、
 * {@code resourceType ← resource_type_label}（文案「冷链车/冷库」）、
 * {@code status ← match_status}；{@code time} 是展示文案（{@code MM-DD}），
 * 由 {@code match_time} 派生，故不直接暴露原始时间。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_cold_chain_match")
public class ColdChainMatchEntity extends ProduceBaseEntity {

    /** 撮合编号（业务主键，JSON 字段名 id） */
    @TableId(value = "match_id", type = IdType.INPUT)
    private String id;

    /** 资源编号（引用 prod_fs_cold_chain_resource.resource_id） */
    private String resourceId;

    /** 资源方名称（JSON 字段名 supplier） */
    @TableField("supplier_name")
    private String supplier;

    /** 资源类型文案：冷链车 / 冷库（JSON 字段名 resourceType） */
    @TableField("resource_type_label")
    private String resourceType;

    /** 需求方 */
    private String demander;

    /** 货物 / 用途 */
    private String cargo;

    /** 温区要求 */
    private String tempRequire;

    /** 预约开始时间（立即撮合场景） */
    private LocalDate startTime;

    /** 期望使用时间（入队场景） */
    private LocalDate expectTime;

    /** 撮合时间：仅入库用，序列化时由 {@link #getTime()} 以文案形式对外 */
    @JsonIgnore
    private LocalDateTime matchTime;

    /** 状态：processing / done / queued（JSON 字段名 status） */
    @TableField("match_status")
    private String status;

    /** 备注 */
    private String remark;

    /**
     * 列表展示用撮合时间文案（契约字段 {@code time}，格式 {@code MM-DD}）。
     *
     * @return 格式化文案；未记录时为 null
     */
    @JsonProperty("time")
    public String getTime() {
        return FoodSafetyFormat.monthDay(matchTime);
    }
}
