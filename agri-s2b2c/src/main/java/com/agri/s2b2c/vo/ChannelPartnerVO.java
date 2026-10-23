package com.agri.s2b2c.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ChannelPartnerVO {
    private Long id;
    private String registerType;
    private String companyName;
    private String contactName;
    private String contactPhone;
    private String shopName;
    private String grade;
    private String auditStatus;
    private String status;
    private LocalDateTime createTime;
}