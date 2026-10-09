package com.agri.produce.internal.setting;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 系统配置项（租户/农场级参数）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_sys_setting")
public class SysSettingEntity extends ProduceBaseEntity {

    @TableId(value = "setting_id", type = IdType.INPUT)
    private String settingId;

    /** 农场ID（空表示租户级） */
    private String farmId;

    /** 配置分组 ALERT/TRACE/QUALITY */
    private String settingGroup;

    /** 配置键 */
    private String settingKey;

    /** 配置名称 */
    private String settingName;

    /** 配置值 */
    private String settingValue;

    /** 默认值 */
    private String defaultValue;

    /** 值类型 STRING/NUMBER/BOOLEAN/JSON */
    private String valueType;

    /** 备注 */
    private String remark;

    /** 状态 1启用 0停用 */
    private Integer status;
}
