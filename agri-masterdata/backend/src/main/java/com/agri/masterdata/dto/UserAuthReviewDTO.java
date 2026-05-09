package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.Map;

@Data
public class UserAuthReviewDTO {

    @NotBlank(message = "审核结果不能为空")
    private String result;

    private String authStatus;

    private String remark;

    private String auditNote;

    private Map<String, Object> authResult;
}