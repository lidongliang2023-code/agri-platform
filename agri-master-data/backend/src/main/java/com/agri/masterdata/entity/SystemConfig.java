package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

/**
 * 系统配置项。
 *
 * <p>字段与 {@code agri_md_system_config} 一一对应。列名用 `config_key` / `group_name`
 * 而不是 `key` / `group` —— 后两者是 MySQL 保留字，直接当列名会在 SQL 里需要到处加反引号。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_system_config")
public class SystemConfig extends BaseEntity {

    /** 参数编码，唯一 */
    private String configKey;

    /** 参数名称 */
    private String configName;

    /** 参数值（JSON 类型也按文本存） */
    private String configValue;

    /** 数据类型：string / number / boolean / json */
    private String configType;

    /** 参数分组 */
    private String groupName;

    /** 组内排序 */
    private Integer sortOrder;

    /** 参数说明 */
    private String description;

    /** 状态：1 启用 / 0 禁用 */
    private Integer status;

    /** 删除标志：0 未删除 / 1 已删除 */
    private Integer delFlag;
}
