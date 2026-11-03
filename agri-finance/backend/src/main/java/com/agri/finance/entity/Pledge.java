package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
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

    /** 关联仓单：质押的是仓单代表的这批货，不是抽象的"货值" */
    private String receiptId;

    /** 担保的融资申请/放款后的借款；结清时按它反查要释放哪张质押 */
    private String applicationId;

    private String loanId;

    /** 列表展示用：来源仓单号（质押表只存 receipt_id，单号在仓单表上）。 */
    @TableField(exist = false)
    private String receiptNo;

    /** 列表展示用：来源批次的在库可用量口径由服务层按生产域现算，不落库。 */
    @TableField(exist = false)
    private String batchNo;

    private LocalDateTime pledgeDate;

    private LocalDateTime releaseDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}