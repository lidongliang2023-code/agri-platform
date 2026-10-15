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
 * 食品安全-可信农产品（P18）。
 *
 * <p>主键是产品编号 {@code product_id}。「可信等级」(trust_level) 与「信任分数」(trust_score)
 * 是两个独立字段而不是一个：等级是人工/规则给出的结论，分数是算出来的值 ——
 * 编辑接口允许同时改两者，所以服务端不能把分数反推成等级。</p>
 */
@Data
@TableName("agri_prod_fs_trust_product")
public class FoodSafetyTrustProduct {

    @TableId(value = "product_id", type = IdType.INPUT)
    private String productId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("product_name")
    private String productName;

    /** 粮食 / 水果 / 蔬菜 / 畜牧 / 禽蛋 / 水产 / 茶叶 / 粮油 */
    @TableField("category")
    private String category;

    @TableField("producer")
    private String producer;

    /** diamond / gold / silver / normal */
    @TableField("trust_level")
    private String trustLevel;

    /** 信任分数 0~100 */
    @TableField("trust_score")
    private Integer trustScore;

    /** organic / green / pollution-free / none */
    @TableField("cert_mark")
    private String certMark;

    @TableField("cert_org")
    private String certOrg;

    @TableField("valid_until")
    private LocalDate validUntil;

    /** approved / pending / rejected */
    @TableField("audit_status")
    private String auditStatus;

    @TableField("audit_remark")
    private String auditRemark;

    @TableField("audit_time")
    private LocalDateTime auditTime;

    @TableField("audit_by")
    private Long auditBy;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
