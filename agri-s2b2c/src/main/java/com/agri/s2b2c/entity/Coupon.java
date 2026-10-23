package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_coupon")
public class Coupon {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String name;
    private String type;
    private BigDecimal amount;
    private BigDecimal discountRate;
    private BigDecimal minAmount;
    private Integer totalCount;
    private Integer remainCount;
    private Integer perUserLimit;
    private LocalDate validStart;
    private LocalDate validEnd;
    private String applicableScope;
    private String applicableCategories;
    private String applicableShops;
    private String status;
    private LocalDateTime createTime;
}