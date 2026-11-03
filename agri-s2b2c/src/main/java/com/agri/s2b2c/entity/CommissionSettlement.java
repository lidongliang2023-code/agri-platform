package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 佣金结算批次。 */
@Data
@TableName("s2b2c_commission_settlement")
public class CommissionSettlement {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String batchNo;
    private Long channelId;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private Integer commissionCount;
    private BigDecimal amount;
    private String operator;
    private LocalDateTime createdAt;
}
