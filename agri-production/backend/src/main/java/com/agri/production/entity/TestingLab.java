package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 检测机构。
 *
 * <p>字段名按前端契约（{@code @agri/shared/types/quality} 的 {@code TestingLab}）：
 * 资质等级 {@code labLevel} 1 国家级 / 2 省级 / 3 市级，合作状态 {@code status} 1 合作中 / 0 已终止。</p>
 *
 * <p>这张表原先不存在：页面上的"检测机构"下拉、送检登记里的机构选择因此永远是空的
 * （接口 404，不是"还没有机构"）。机构的增改在运营端（{@code POST/PUT /quality/labs}），
 * 用户端只读。</p>
 */
@Data
@TableName("agri_prod_testing_lab")
public class TestingLab {

    @TableId(value = "id", type = IdType.AUTO)
    private Long labId;

    @TableField("lab_name")
    private String labName;

    @TableField("lab_code")
    private String labCode;

    /** 1 国家级 / 2 省级 / 3 市级 */
    @TableField("lab_level")
    private Integer labLevel;

    @TableField("contact_name")
    private String contactName;

    @TableField("contact_phone")
    private String contactPhone;

    @TableField("region")
    private String region;

    /** 资质证书编号 */
    @TableField("cert_no")
    private String certNo;

    /** 1 合作中 / 0 已终止 */
    @TableField("status")
    private Integer status;

    /**
     * 准入驳回原因（运营端驳回时手填）。
     *
     * <p>列由 schema-patch-quality-lab-page.sql 补：没有它就没地方落用户填的原因，
     * 只能丢掉输入或者假装成功 —— 两种都不行。</p>
     */
    @TableField("reject_reason")
    private String rejectReason;

    @TableField("remark")
    private String remark;

    @TableField("tenant_id")
    private String tenantId;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;

    @JsonProperty("createdAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("create_time")
    private LocalDateTime createTime;

    @JsonProperty("updatedAt")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    @TableField("update_time")
    private LocalDateTime updateTime;
}
