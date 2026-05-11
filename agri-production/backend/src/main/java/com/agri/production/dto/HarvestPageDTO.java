package com.agri.production.dto;

import lombok.Data;

@Data
public class HarvestPageDTO {

    private String cropName;

    private Long farmId;

    private Long plotId;

    private String qualityGrade;

    private String status;

    private java.time.LocalDate startDate;

    private java.time.LocalDate endDate;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}