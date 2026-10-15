package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 食品安全-标准校验项明细（P17 Tab3）。
 *
 * <p>这张表是「执行自动校验」的<b>唯一输入</b>，重算出的批次级指标落在
 * {@link FoodSafetyStandardSummary}，明细本身不会被改写 —— 明细是检验事实，
 * 不是可以随汇总口径回写的缓存。</p>
 */
@Data
@TableName("agri_prod_fs_standard_item")
public class FoodSafetyStandardItem {

    @TableId(value = "item_id", type = IdType.INPUT)
    private String itemId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("standard_no")
    private String standardNo;

    @TableField("item_name")
    private String itemName;

    @TableField("limit_value")
    private String limitValue;

    @TableField("measured_value")
    private String measuredValue;

    /** pass / fail */
    @TableField("check_result")
    private String checkResult;

    @TableField("batch_no")
    private String batchNo;

    /** 抽检时间：批次范围筛选与「当期/上期」都按它算 */
    @TableField("check_time")
    private LocalDateTime checkTime;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
