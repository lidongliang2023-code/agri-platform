package com.agri.masterdata.vo;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class LogisticsNodeVO {

    private String nodeId;

    private String nodeCode;

    private String nodeName;

    private String nodeType;

    private String regionCode;

    private String regionName;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String capacity;

    private String services;

    private String contactPerson;

    private String contactPhone;

    private String status;

    private String remark;
}