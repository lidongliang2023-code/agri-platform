package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("s2b2c_channel_partner")
public class ChannelPartner {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String registerType;
    private String companyName;
    private String creditCode;
    private String industry;
    private String province;
    private String city;
    private String district;
    private String address;
    private String contactName;
    private String contactPhone;
    private Long referrerId;
    private String shopName;
    private String shopDesc;
    private String shopLogo;
    private String grade;
    private String auditStatus;
    private LocalDateTime auditTime;
    private String auditOpinion;
    private String status;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}