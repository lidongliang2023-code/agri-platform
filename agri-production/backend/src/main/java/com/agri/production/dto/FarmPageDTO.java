package com.agri.production.dto;

import lombok.Data;

@Data
public class FarmPageDTO {

    private String farmName;

    private String farmType;

    private String province;

    private String city;

    private String status;

    private String auditStatus;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}