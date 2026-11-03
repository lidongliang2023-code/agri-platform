package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_commission")
public class Commission {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long orderId;
    private Long channelId;
    private BigDecimal amount;
    private BigDecimal rate;
    private String status;
    private LocalDateTime settleTime;
    /** 结算批次号（批量结算时写入） */
    private String settleBatchNo;
    private String remark;
    private LocalDateTime createTime;
}