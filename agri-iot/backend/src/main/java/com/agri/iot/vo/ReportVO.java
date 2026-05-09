
package com.agri.iot.vo;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
public class ReportVO {

    private Long id;

    private String reportName;

    private String reportCode;

    private String description;

    private String chartType;

    private String chartTypeText;

    private String timeRange;

    private String timeRangeText;

    private Integer scheduledEnabled;

    private String scheduledType;

    private String scheduledTime;

    private Integer status;

    private String statusText;

    private List<ReportDataSourceVO> dataSources;

    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createTime;

    private String createBy;

    @Data
    public static class ReportDataSourceVO {
        private Long deviceId;
        private String deviceName;
        private String metric;
        private String displayName;
        private String unit;
    }
}
