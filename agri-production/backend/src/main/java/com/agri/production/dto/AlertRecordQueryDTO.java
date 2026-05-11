package com.agri.production.dto;

import lombok.Data;

@Data
public class AlertRecordQueryDTO {

    private String alertType;

    private String level;

    private String status;

    private Long farmId;

    private String sourceName;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}