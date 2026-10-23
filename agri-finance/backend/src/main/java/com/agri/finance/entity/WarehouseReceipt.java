package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("warehouse_receipt")
public class WarehouseReceipt {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String receiptNo;

    private String pledgeId;

    private String commodityType;

    private String qualityStandard;

    private BigDecimal quantity;

    private BigDecimal unitPrice;

    private BigDecimal totalValue;

    private String status;

    private String warehouseCode;

    private String warehouseName;

    private String location;

    private String blockchainHash;

    private LocalDateTime issueDate;

    private LocalDateTime expireDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}