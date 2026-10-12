package com.agri.admin.vo;

import lombok.Data;

@Data
public class DistributionTaskVO {

    private Long id;
    
    private String taskCode;

    /** 任务名称。原 VO 只有 taskCode，而页面有一列"任务名称" —— 那一列会恒为空。 */
    private String taskName;

    /** 触发方式：auto 自动 / manual 手动。页面按它显示"自动/手动"。 */
    private String triggerType;

    /** 进度（0-100）。页面有一条进度条，原 VO 没有这个字段。 */
    private Integer progress;
    
    private String targetSystem;
    
    private String targetSystemName;
    
    private String dataType;
    
    private String dataTypeName;
    
    private String status;
    
    private Integer totalCount;
    
    private Integer successCount;
    
    private Integer failedCount;
    
    private Double delay;
    
    private String tenantId;
    
    private String tenantName;
    
    private String createTime;
    
    private String startTime;
    
    private String endTime;
    
    private String errorMessage;
}
