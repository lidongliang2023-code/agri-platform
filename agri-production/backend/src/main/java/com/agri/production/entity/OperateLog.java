package com.agri.production.entity;

import com.agri.production.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** 操作日志（页面「系统设置 → 操作日志」）。由统一的写请求钩子落库，见 OperateLogAdvice。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_prod_operate_log")
public class OperateLog extends BaseEntity {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("log_id")
    private String logId;

    @TableField("operate_type")
    private String operateType;

    @TableField("target")
    private String target;

    /** 业务结果码（0 成功） */
    @TableField("business_code")
    private Integer businessCode;

    /** 1 成功 0 失败 */
    @TableField("result")
    private Integer result;

    @TableField("operator")
    private String operator;

    @TableField("ip_address")
    private String ipAddress;

    @TableField("cost_ms")
    private Long costMs;

    @TableField("detail")
    private String detail;

    @TableField("operate_at")
    private LocalDateTime operateAt;
}
