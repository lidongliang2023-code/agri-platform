package com.agri.iot.dto;

import com.agri.common.vo.PageVO;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class AlertRulePageDTO extends PageVO {

    private String ruleCode;

    private String ruleName;

    private String ruleType;

    private Long deviceTypeId;

    private Integer enableStatus;
}