package com.agri.s2b2c.vo;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SupplierVO {
    private Long id;
    private String companyName;
    private String creditCode;
    private String industry;
    private String province;
    private String city;
    private String district;
    private String address;
    private String legalName;
    private String contactPhone;
    private String shopName;
    private String shopDesc;
    private String shopLogo;
    private String auditStatus;
    private LocalDateTime auditTime;
    private String auditOpinion;
    private String status;
    private LocalDateTime createTime;
}