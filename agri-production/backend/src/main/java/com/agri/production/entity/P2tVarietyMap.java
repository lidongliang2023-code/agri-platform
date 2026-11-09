package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 品种 → 交易品类映射（产销对接的地基）。
 *
 * <p>生产端只维护映射关系；品种档案归主数据，品类归交易撮合。
 * 没有映射的品种不允许发布供给意向 —— 这是防脏数据流入交易端的第一道硬闸。</p>
 */
@Data
@TableName("agri_p2t_variety_map")
public class P2tVarietyMap {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("crop_id")
    private Long cropId;
    @TableField("crop_code")
    private String cropCode;
    @TableField("crop_name")
    private String cropName;
    @TableField("variety_name")
    private String varietyName;

    @TableField("category_code")
    private String categoryCode;
    @TableField("category_name")
    private String categoryName;

    @TableField("spec_standard")
    private String specStandard;
    @TableField("grade_rule")
    private String gradeRule;
    @TableField("main_origin")
    private String mainOrigin;
    @TableField("window_start")
    private String windowStart;
    @TableField("window_end")
    private String windowEnd;
    @TableField("conversion_rate")
    private BigDecimal conversionRate;

    /** 1 生效 / 0 停用 */
    private Integer status;

    private String version;
    private String remark;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
