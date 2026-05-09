
package com.agri.iot.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

@Data
public class ReportSaveDTO {

    @NotBlank(message = "报表名称不能为空")
    private String reportName;

    private String description;

    private List<ReportDataSource> dataSources;

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

    @Data
    public static class ReportDataSource {
        private Long deviceId;
        private String deviceName;
        private String metric;
        private String displayName;
    }
}
