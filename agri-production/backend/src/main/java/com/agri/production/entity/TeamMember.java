package com.agri.production.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 生产团队成员（用户端「团队与人员」）。
 *
 * <p>类名用 TeamMember 而不是 Member：后者在平台/通用包里到处都是，重名时很容易 import 错，
 * 而 import 错的后果是"编译通过、字段全空"。</p>
 */
@Data
@TableName("agri_prod_member")
public class TeamMember {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    @TableField("member_id")
    private String memberId;

    @TableField("tenant_id")
    private String tenantId;

    /** 所属农场（本服务农场主键，字符串存） */
    @TableField("farm_id")
    private String farmId;

    @TableField("user_id")
    private String userId;

    @TableField("member_name")
    private String memberName;

    /** OWNER / AGRONOMIST / INSPECTOR / OPERATOR */
    @TableField("member_type")
    private String memberType;

    @TableField("phone")
    private String phone;

    /** 角色编码，如 FARM_OWNER —— 「角色与权限」页按它聚合在职人数 */
    @TableField("role_code")
    private String roleCode;

    @TableField("post_name")
    private String postName;

    @TableField("join_date")
    private LocalDate joinDate;

    /** 1 在职 / 2 待激活 / 0 已停用（页面口径，不是布尔） */
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
