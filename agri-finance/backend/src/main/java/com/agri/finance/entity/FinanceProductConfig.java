package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("finance_product_config")
public class FinanceProductConfig {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String productCode;

    private String productName;

    private BigDecimal rate;

    private Integer termMin;

    private Integer termMax;

    private BigDecimal amountMin;

    private BigDecimal amountMax;

    private BigDecimal pledgeRate;

    private String status;

    private String description;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}
