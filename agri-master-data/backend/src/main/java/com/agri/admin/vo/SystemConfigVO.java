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

    /**
     * 状态：1 启用 / 0 禁用。
     *
     * <p>页面用 `enabled` 这个布尔字段做开关，而 VO 原来没有对应字段 ——
     * 接口就算返回了配置项，"启用/禁用"这一列也无值可显示、开关更无从提交。</p>
     */
    private Integer status;
    
    private String createTime;
    
    private String updateTime;
}
