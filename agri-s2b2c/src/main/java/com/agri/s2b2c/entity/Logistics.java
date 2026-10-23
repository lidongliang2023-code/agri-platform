package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("s2b2c_logistics")
public class Logistics {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long orderId;
    private String logisticsNo;
    private String logisticsCompany;
    private String trackingInfo;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}