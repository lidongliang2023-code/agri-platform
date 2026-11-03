package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 渠道等级 → 佣金比例。ACTIVE 的规则优先于商品自带的 commission_rate。 */
@Data
@TableName("s2b2c_commission_rule")
public class CommissionRule {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String grade;
    private BigDecimal rate;
    /** ACTIVE / DISABLED */
    private String status;
    private String remark;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
