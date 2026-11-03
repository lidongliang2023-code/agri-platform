package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 渠道佣金提现申请。状态：PENDING / APPROVED / REJECTED / PAID。 */
@Data
@TableName("s2b2c_commission_withdrawal")
public class CommissionWithdrawal {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long channelId;
    private BigDecimal amount;
    private String status;
    private LocalDateTime applyTime;
    private String reviewer;
    private LocalDateTime reviewTime;
    private String remark;
    private String payoutNo;
    private String payoutOperator;
    private LocalDateTime payoutTime;
    private LocalDateTime updateTime;
}
