package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("contract")
public class Contract {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String contractNo;

    /** 关联的融资申请：放款闸门要按申请核对合同签署状态。 */
    private String applicationId;

    private String loanId;

    private String loanNo;

    private String userId;

    private String userName;

    private String contractType;

    private BigDecimal amount;

    private BigDecimal rate;

    private Integer term;

    private String status;

    private String signStatus;

    private String borrowerSignTime;

    private String lenderSignTime;

    private String contractUrl;

    private LocalDateTime startDate;

    private LocalDateTime endDate;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}