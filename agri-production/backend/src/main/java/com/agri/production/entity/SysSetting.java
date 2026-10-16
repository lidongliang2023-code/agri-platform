package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 系统配置项。
 *
 * <p>字段名跟平台侧 prod_sys_setting 保持一套（settingKey / settingValue / remark），
 * 因为前端 api 层就是按这套名做映射的（见 {@code api/settings.ts} 的
 * {@code SysSettingPayload}）—— 换一套名等于把映射再翻一遍。</p>
 */
@Data
@TableName("agri_prod_sys_setting")
public class SysSetting {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("setting_id")
    private String settingId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("farm_id")
    private String farmId;

    @TableField("setting_group")
    private String settingGroup;

    @TableField("setting_key")
    private String settingKey;

    @TableField("setting_name")
    private String settingName;

    @TableField("setting_value")
    private String settingValue;

    @TableField("default_value")
    private String defaultValue;

    /** string / number / boolean / json */
    @TableField("value_type")
    private String valueType;

    @TableField("remark")
    private String remark;

    /** 1 启用 / 0 停用 */
    @TableField("status")
    private Integer status;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    @TableField("deleted")
    private Integer deleted;
}
