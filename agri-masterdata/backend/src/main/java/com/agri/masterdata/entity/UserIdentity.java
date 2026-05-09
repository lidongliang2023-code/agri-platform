package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("user_identity")
public class UserIdentity extends BaseEntity {

    @TableId(value = "identity_id", type = IdType.ASSIGN_ID)
    private String identityId;

    @TableField("user_id")
    private String userId;

    @TableField("identity_type")
    private String identityType;

    @TableField("identity_name")
    private String identityName;

    @TableField("identity_status")
    private String identityStatus;

    @TableField("identity_data")
    private String identityData;

    @TableField("verified_time")
    private LocalDateTime verifiedTime;

    @TableField("expire_time")
    private LocalDateTime expireTime;
}