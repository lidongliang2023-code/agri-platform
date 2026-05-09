package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@TableName("user_authentication")
public class UserAuthentication extends BaseEntity {

    @TableId(value = "auth_id", type = IdType.ASSIGN_ID)
    private String authId;

    @TableField("user_id")
    private String userId;

    @TableField("auth_type")
    private String authType;

    @TableField("auth_status")
    private String authStatus;

    @TableField("auth_level")
    private Integer authLevel;

    @TableField("auth_data")
    private String authData;

    @TableField("auth_result")
    private String authResult;

    @TableField("verified_by")
    private String verifiedBy;

    @TableField("verified_time")
    private LocalDateTime verifiedTime;

    @TableField("audit_by")
    private String auditBy;

    @TableField("audit_time")
    private LocalDateTime auditTime;

    @TableField("audit_note")
    private String auditNote;
}