package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_after_sale")
public class AfterSale {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long orderId;
    private Long orderItemId;
    private Long consumerId;
    private String type;
    private String reason;
    private String images;
    private BigDecimal amount;
    private String status;
    private String handleOpinion;
    private LocalDateTime handleTime;
    private LocalDateTime createTime;
}