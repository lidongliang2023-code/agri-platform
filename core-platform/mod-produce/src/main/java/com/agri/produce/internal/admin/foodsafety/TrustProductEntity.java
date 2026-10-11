package com.agri.produce.internal.admin.foodsafety;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 可信农产品（P18）。
 *
 * <p>Java 字段名对齐契约 {@code TrustProduct}（{@code name} / {@code level} /
 * {@code score} / {@code cert}），列名走 {@code @TableField} 映射。</p>
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_fs_trust_product")
public class TrustProductEntity extends ProduceBaseEntity {

    /** 产品编号（业务主键，JSON 字段名 id） */
    @TableId(value = "product_id", type = IdType.INPUT)
    private String id;

    /** 产品名称（JSON 字段名 name） */
    @TableField("product_name")
    private String name;

    /** 品类：粮食/水果/蔬菜/畜牧/禽蛋/水产/茶叶/粮油 */
    private String category;

    /** 生产者 */
    private String producer;

    /** 可信等级：diamond/gold/silver/normal（JSON 字段名 level） */
    @TableField("trust_level")
    private String level;

    /** 信任分数 0~100（JSON 字段名 score） */
    @TableField("trust_score")
    private Integer score;

    /** 认证标志：organic/green/pollution-free/none（JSON 字段名 cert） */
    @TableField("cert_mark")
    private String cert;

    /** 认证机构 */
    private String certOrg;

    /** 认证有效期 */
    private LocalDate validUntil;

    /** 审核状态：approved/pending/rejected */
    private String auditStatus;

    /** 审核意见 */
    private String auditRemark;

    /** 审核时间 */
    private LocalDateTime auditTime;

    /** 审核人 */
    private Long auditBy;
}
