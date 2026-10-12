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

    /**
     * 状态：1 启用 / 0 禁用。
     *
     * <p>页面的"启用/禁用"按钮走的是更新接口（`updateCodeRule(id, { status })`），
     * 而原 DTO 没有 status 字段 —— 请求能发出去、也返回 200，但状态**改不动**。
     * 这类"字段收了但没接"的问题在界面上表现为"点了没反应"，很难从报错里看出来。</p>
     */
    private Integer status;
}
