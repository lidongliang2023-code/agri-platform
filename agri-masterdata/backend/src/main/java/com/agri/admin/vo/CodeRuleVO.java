package com.agri.admin.vo;

import lombok.Data;

@Data
public class CodeRuleVO {

    private Long id;
    
    private String ruleCode;
    
    private String ruleName;
    
    private String ruleType;
    
    private String rulePattern;
    
    private String description;
    
    private Integer seqLength;
    
    private String dateFormat;
    
    private String prefix;
    
    private String suffix;
    
    private Integer status;
    
    private String createTime;
    
    private String updateTime;
}