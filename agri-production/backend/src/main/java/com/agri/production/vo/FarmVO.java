package com.agri.production.vo;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class FarmVO {

    private Long id;

    private String farmCode;

    private String farmName;

    private String farmType;

    private String legalPerson;

    private String contactPhone;

    private String province;

    private String city;

    private String district;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private BigDecimal totalArea;

    private Integer plotCount;

    private String farmTypeDetail;

    private String mainProducts;

    private String certifications;

    private LocalDate certificationExpireDate;

    private String certificationsJson;

    private String logoUrl;

    private String intro;

    private LocalDate registerDate;

    private String auditStatus;

    private String status;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}