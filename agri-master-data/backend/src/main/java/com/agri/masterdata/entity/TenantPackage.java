package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

/**
 * 租户套餐。
 *
 * <p>套餐的"功能清单"在页面上表现为一组条目，但那些条目就是下面这几个限额字段的展示形态，
 * 因此不另建子表 —— 详见 {@code schema.sql} 里本表的注释。</p>
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_tenant_package")
public class TenantPackage extends BaseEntity {

    /** 套餐编码：BASE / PRO / ENTERPRISE */
    private String packageCode;

    /** 套餐名称 */
    private String packageName;

    /** 套餐说明 */
    private String packageDesc;

    private Integer userLimit;
    private Integer orgLimit;
    private Integer productLimit;

    /** 存储上限（字节） */
    private Long storageLimit;

    private Integer apiLimit;

    /** 服务级别：1 基础 / 2 标准 / 3 专属 */
    private Integer serviceLevel;

    /** 服务级别描述 */
    private String serviceLevelDesc;

    private BigDecimal price;

    /** 有效期（天） */
    private Integer duration;

    /** 状态：1 启用 / 0 禁用 */
    private Integer status;

    /** 删除标志 */
    private Integer delFlag;
}
