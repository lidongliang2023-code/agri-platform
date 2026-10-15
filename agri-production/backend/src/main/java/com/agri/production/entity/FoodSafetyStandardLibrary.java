package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 食品安全-行业标准库（P17 Tab3 的下拉数据源）。
 *
 * <p>主键是标准编号 {@code standard_no}。页面把这个字段当作 antd Select 的 {@code value}，
 * {@code standard_name} 当作 {@code label}，所以出参走的是 value/label 形状，不是实体原名。</p>
 */
@Data
@TableName("agri_prod_fs_standard_library")
public class FoodSafetyStandardLibrary {

    @TableId(value = "standard_no", type = IdType.INPUT)
    private String standardNo;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("standard_name")
    private String standardName;

    @TableField("issuer")
    private String issuer;

    /** 1 启用 / 0 停用（下拉只取启用的） */
    @TableField("status")
    private Integer status;

    @TableField("sort_no")
    private Integer sortNo;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
