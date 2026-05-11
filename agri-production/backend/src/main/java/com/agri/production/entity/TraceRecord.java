package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_trace_record")
public class TraceRecord extends BaseEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("trace_code")
    private String traceCode;

    @TableField("trace_type")
    private String traceType;

    @TableField("trace_time")
    private java.time.LocalDateTime traceTime;

    @TableField("operator")
    private String operator;

    @TableField("location")
    private String location;

    @TableField("latitude")
    private java.math.BigDecimal latitude;

    @TableField("longitude")
    private java.math.BigDecimal longitude;

    @TableField("content")
    private String content;

    @TableField("content_json")
    private String contentJson;

    @TableField("photos")
    private String photos;

    @TableField("blockchain_tx_hash")
    private String blockchainTxHash;

    @TableField("sort_order")
    private Integer sortOrder;

    @TableField("remark")
    private String remark;
}