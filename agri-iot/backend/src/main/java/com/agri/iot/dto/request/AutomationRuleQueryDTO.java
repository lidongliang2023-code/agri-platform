
package com.agri.iot.dto.request;

import lombok.Data;

@Data
public class AutomationRuleQueryDTO {
    private String ruleName;
    private String tenantId;
    private Integer status;
    private Integer pageNum;
    private Integer pageSize;
}
