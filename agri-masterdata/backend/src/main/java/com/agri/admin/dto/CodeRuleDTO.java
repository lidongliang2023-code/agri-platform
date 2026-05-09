package com.agri.admin.dto;

import lombok.Data;

@Data
public class CodeRuleDTO {

    private String ruleCode;
    
    private String ruleName;
    
    private String ruleType;
    
    private String rulePattern;
    
    private String description;
    
    private Integer seqLength;
    
    private String dateFormat;
    
    private String prefix;
    
    private String suffix;
}