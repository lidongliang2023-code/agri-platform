package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("investment")
public class Investment {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String investmentNo;

    private String assetId;

    private String assetName;

    private String providerId;

    private String providerName;

    private BigDecimal investmentAmount;

    private BigDecimal expectedReturn;

    private Integer term;

    private BigDecimal interestRate;

    private String status;

    private LocalDateTime investmentTime;

    private LocalDateTime expectedReturnTime;

    private LocalDateTime actualReturnTime;

    private BigDecimal actualReturnAmount;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}