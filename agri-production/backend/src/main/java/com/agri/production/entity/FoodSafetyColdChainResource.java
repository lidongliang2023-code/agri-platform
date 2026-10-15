package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 食品安全-冷链资源（P19）。
 *
 * <p>主键是资源编号 {@code resource_id}。{@code type_label}（冷链车/冷库）与
 * {@code temp_range} 都是**展示文案**，由数据方给出、不由后端推算 ——
 * 温区是承运方与货主约定的口径（"-18°C ~ 5°C"），拿"类型"去推只会推出错的值。</p>
 */
@Data
@TableName("agri_prod_fs_cold_chain_resource")
public class FoodSafetyColdChainResource {

    @TableId(value = "resource_id", type = IdType.INPUT)
    private String resourceId;

    @TableField("tenant_id")
    private String tenantId;

    /** 车牌号 / 库区名 */
    @TableField("resource_name")
    private String resourceName;

    /** vehicle / warehouse */
    @TableField("resource_type")
    private String resourceType;

    /** 冷链车 / 冷库 */
    @TableField("type_label")
    private String typeLabel;

    @TableField("spec")
    private String spec;

    @TableField("temp_range")
    private String tempRange;

    @TableField("city")
    private String city;

    @TableField("district")
    private String district;

    /** idle / busy / offline */
    @TableField("resource_status")
    private String resourceStatus;

    /** 服务评分 0~5 */
    @TableField("rating")
    private BigDecimal rating;

    @TableField("contact_name")
    private String contactName;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("last_maintain_date")
    private LocalDate lastMaintainDate;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
