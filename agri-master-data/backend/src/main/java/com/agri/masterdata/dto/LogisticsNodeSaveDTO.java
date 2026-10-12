package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class LogisticsNodeSaveDTO {

    @NotBlank(message = "节点编码不能为空")
    private String nodeCode;

    @NotBlank(message = "节点名称不能为空")
    private String nodeName;

    private String nodeType;

    private String regionCode;

    private String address;

    private BigDecimal longitude;

    private BigDecimal latitude;

    private String capacity;

    private String services;

    private String contactPerson;

    private String contactPhone;

    private String status = "active";

    private String remark;
}