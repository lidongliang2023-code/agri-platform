package com.agri.admin.vo;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SystemConfigVO {

    private Long id;
    
    private String configKey;
    
    private String configName;
    
    private String configValue;
    
    private String configType;
    
    private String description;
    
    private String groupName;
    
    private Integer sortOrder;
    
    private String createTime;
    
    private String updateTime;
}