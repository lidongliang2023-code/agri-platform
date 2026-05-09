package com.agri.admin.dto;

import lombok.Data;

@Data
public class DataFormatDTO {

    private String formatCode;
    
    private String formatName;
    
    private String dataType;
    
    private String validationRule;
    
    private Integer maxLength;
    
    private Integer minLength;
    
    private String defaultValue;
    
    private String description;
}