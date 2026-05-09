
package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_report")
public class Report extends BaseEntity {

    private String reportName;

    private String reportCode;

    private String description;

    private String dataSource;

    private String chartType;

    private String timeRange;

    private String aggregationType;

    private String timeGranularity;

    private Integer scheduledEnabled;

    private String scheduledType;

    private String scheduledTime;

    private Integer emailEnabled;

    private String emailRecipients;

    private Integer pushEnabled;

    private String pushRecipients;

    private String configJson;

    private Integer status;
}
