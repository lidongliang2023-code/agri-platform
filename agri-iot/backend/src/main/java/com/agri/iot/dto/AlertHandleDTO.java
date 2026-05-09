package com.agri.iot.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AlertHandleDTO {

    @NotNull(message = "处理状态不能为空")
    private Integer handleStatus;

    private String handleResult;
}