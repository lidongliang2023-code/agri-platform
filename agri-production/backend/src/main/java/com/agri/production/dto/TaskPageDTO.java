package com.agri.production.dto;

import lombok.Data;

@Data
public class TaskPageDTO {

    private String taskName;

    private String taskType;

    private Long farmId;

    private Long plotId;

    private Long executorId;

    private String status;

    private String priority;

    private java.time.LocalDate startDate;

    private java.time.LocalDate endDate;

    private Integer pageNum = 1;

    private Integer pageSize = 10;
}