package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 经营主体内的角色定义；tenant_id 即当前经营主体。 */
@Data
@TableName("agri_prod_role")
public class ProductionRole {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("role_id")
    private String roleId;

    @TableField("tenant_id")
    private String tenantId;

    @TableField("role_code")
    private String roleCode;

    @TableField("role_name")
    private String roleName;

    private String description;

    /** JSON 数组字符串，例如 ["produce.farm.view"]。 */
    private String permissions;

    @TableField("data_scope")
    private String dataScope;

    @TableField("built_in")
    private Integer builtIn;

    private Integer status;

    @TableField("create_time")
    private LocalDateTime createTime;

    @TableField("update_time")
    private LocalDateTime updateTime;

    @TableLogic
    private Integer deleted;
}
