package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("pledge_goods")
public class PledgeGoods {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String goodsCode;

    private String goodsName;

    private String category;

    private BigDecimal pledgeRateMax;

    private String priceSource;

    private String qualityStandard;

    private BigDecimal priceVolatilityThreshold;

    private Integer maxPledgeTerm;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}