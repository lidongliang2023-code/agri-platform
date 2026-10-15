package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 食品安全-冷链撮合记录（P19）。
 *
 * <p>两种单子共用一张表，靠 {@code match_status} 区分：
 * 立即撮合（processing）落 {@code start_time}，繁忙排队（queued）落 {@code expect_time}。
 * 因此 cargo / temp_require 在入队单上允许为空 —— 它们不参与"排队"这件事。</p>
 */
@Data
@TableName("agri_prod_fs_cold_chain_match")
public class FoodSafetyColdChainMatch {

    @TableId(value = "match_id", type = IdType.INPUT)
    private String matchId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("resource_id")
    private String resourceId;

    /** 资源方名称（下单时从资源表抄一份，资源改名不影响历史单） */
    @TableField("supplier_name")
    private String supplierName;

    @TableField("resource_type_label")
    private String resourceTypeLabel;

    @TableField("demander")
    private String demander;

    @TableField("cargo")
    private String cargo;

    @TableField("temp_require")
    private String tempRequire;

    /** 预约开始时间（立即撮合） */
    @TableField("start_time")
    private LocalDate startTime;

    /** 期望使用时间（排队场景） */
    @TableField("expect_time")
    private LocalDate expectTime;

    @TableField("match_time")
    private LocalDateTime matchTime;

    /** processing / done / queued */
    @TableField("match_status")
    private String matchStatus;

    @TableField("remark")
    private String remark;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
