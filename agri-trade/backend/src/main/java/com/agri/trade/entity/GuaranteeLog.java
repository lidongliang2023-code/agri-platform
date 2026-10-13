package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.util.Date;

/**
 * 保证金流水。
 *
 * <p>原先冻结/解冻/补缴/扣划只改账户上的四个金额，不留记录 ——
 * 钱动过却查不到"谁在什么时候因为什么动的"。这里按"每一笔动作留一条"补上。</p>
 */
@Data
@TableName("agri_trade_guarantee_log")
public class GuaranteeLog {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long guaranteeId;

    private String guaranteeNo;

    private Long merchantId;

    private String merchantName;

    /** create / verify / freeze / unfreeze / replenish / deduct */
    private String action;

    private BigDecimal amount;

    private BigDecimal availableBefore;

    private BigDecimal availableAfter;

    private BigDecimal frozenBefore;

    private BigDecimal frozenAfter;

    private String operator;

    private String reason;

    private Integer delFlag;

    private Date createTime;
}
