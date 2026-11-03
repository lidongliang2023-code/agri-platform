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

    /** 仓单归属的融资主体（商户ID），由令牌解析，不接受请求参数。 */
    private String userId;

    private String batchId;

    private String batchNo;

    /** 质押物字典编码，决定折算率上限与最长期限。 */
    private String goodsCode;

    private String farmId;

    private String plotId;

    private String traceCode;

    private String commodityType;

    private String qualityStandard;

    private BigDecimal quantity;

    private String unit;

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