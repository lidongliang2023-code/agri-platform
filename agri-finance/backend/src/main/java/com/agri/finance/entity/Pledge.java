package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pledge")
public class Pledge {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String pledgeNo;

    private String userId;

    private String commodityType;

    private String qualityStandard;

    private BigDecimal quantity;

    private BigDecimal unitPrice;

    private BigDecimal totalValue;

    private BigDecimal pledgeRate;

    private BigDecimal loanAmount;

    private String status;

    private String warehouseName;

    private String warehouseAddress;

    private LocalDateTime pledgeDate;

    private LocalDateTime releaseDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}