package com.agri.admin.vo;

import lombok.Data;

@Data
public class DataFormatVO {

    private Long id;
    
    private String formatCode;
    
    private String formatName;
    
    private String dataType;
    
    private String validationRule;
    
    private Integer maxLength;
    
    private Integer minLength;
    
    private String defaultValue;
    
    private String description;
    
    private String changeType;
    
    private String status;
    
    private String applicant;
    
    private String applyTime;
    
    private String reviewTime;
    
    private String remark;
}