package com.agri.admin.vo;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OperationLogSummaryVO {

    private Long total;

    private Long success;

    private Long failed;

    private Long today;

    private Long moduleCount;
}
