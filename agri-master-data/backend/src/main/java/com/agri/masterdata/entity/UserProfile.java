package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Data
@EqualsAndHashCode(callSuper = true)
// 表名以 schema.sql 为准（agri_md_ 前缀），详见 Department 上的同类注释。
@TableName("agri_md_user_profile")
public class UserProfile extends BaseEntity {

    @TableId(value = "profile_id", type = IdType.ASSIGN_ID)
    private String profileId;

    @TableField("user_id")
    private String userId;

    @TableField("profile_type")
    private String profileType;

    @TableField("profile_data")
    private String profileData;

    @TableField("tags")
    private String tags;

    @TableField("score_data")
    private String scoreData;

    @TableField("update_time")
    private LocalDateTime updateTime;
}
