package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_product")
public class Product {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long supplierId;
    private Long channelId;
    private Long categoryId;
    private String name;
    private String sellingPoint;
    private String origin;
    private String grade;
    private String shelfLife;
    private String spec;
    private String unit;
    private BigDecimal price;
    private BigDecimal originalPrice;
    private BigDecimal costPrice;
    private Integer stock;
    private Integer stockWarning;
    private BigDecimal commissionRate;
    private String images;
    private String videoUrl;
    private String detail;
    private String freightTemplate;
    private String deliveryTime;
    private String certifications;
    private String traceabilityInfo;
    /**
     * 绑定的生产域采收批次号（{@code agri_prod_harvest_batch.batch_no}），空=未绑定。
     *
     * <p>消费者详情页的种植/采收/加工链路全部按这个批次向生产域实查，商城不再自存一份
     * —— 一份数据两个存放处，早晚对不上。</p>
     *
     * <p>{@code IGNORED} 是必须的：商品保存走 {@code updateById}，默认 NOT_NULL 策略会跳过 null，
     * 于是"解绑批次"在库里根本没生效、旧绑定悄悄留着（本仓库已在这条上栽过三次：
     * 地块当前作物、账号邮箱、这里是第三次）。</p>
     */
    @TableField(value = "prod_batch_no", updateStrategy = FieldStrategy.IGNORED)
    private String prodBatchNo;
    private String status;
    /** 是否允许渠道投放 */
    private Boolean distributionEnabled;
    /** 最大授权渠道数，0=不限 */
    private Integer maxChannels;
    /** 渠道最低/最高零售价，空=不限制 */
    private java.math.BigDecimal minRetailPrice;
    private java.math.BigDecimal maxRetailPrice;
    private LocalDateTime auditTime;
    private String auditOpinion;
    private Integer sales;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}