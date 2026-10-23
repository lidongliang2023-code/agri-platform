package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("s2b2c_shop")
public class Shop {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long ownerId;
    private String ownerType;
    private String name;
    private String logo;
    private String desc;
    private String mainCategories;
    private String contactPhone;
    private String province;
    private String city;
    private String district;
    private String address;
    private String businessHours;
    private String deliveryRange;
    private String deliveryDays;
    private String businessStatus;
    private String decorationTemplate;
    private String banners;
    private String announcement;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}