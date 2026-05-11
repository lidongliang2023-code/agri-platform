package com.agri.production.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;

@Data
public class TraceCodeGenerateDTO {

    @NotNull(message = "采收ID不能为空")
    private Long harvestId;

    @NotNull(message = "数量不能为空")
    private Integer quantity;

    private String batchNumber;

    private String productName;

    private String productCode;

    private List<String> customFields;
}