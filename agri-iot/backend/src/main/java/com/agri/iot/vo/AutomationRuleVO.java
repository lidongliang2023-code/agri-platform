
package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AutomationRuleVO {
    private Long id;
    private String ruleName;
    private String ruleCode;
    private String triggerType;
    private String triggerConfig;
    private String actionType;
    private String actionConfig;
    private Integer status;
    private String statusText;
    private String createBy;
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;
}
