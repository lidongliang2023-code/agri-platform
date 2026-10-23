package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("s2b2c_address")
public class Address {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private Long consumerId;
    private String name;
    private String phone;
    private String province;
    private String city;
    private String district;
    private String address;
    private Boolean isDefault;
    private String status;
    private LocalDateTime createTime;
}