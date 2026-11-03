package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** 黑名单（平台级联合惩戒）。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_blacklist")
public class BlacklistRecord extends BaseEntity {

    /** user / customer / supplier */
    private String targetType;

    private String targetId;

    private String targetName;

    private String reason;

    private String evidence;

    private LocalDateTime startTime;

    /** 为空表示永久 */
    private LocalDateTime expireTime;

    /** active / released */
    private String status;

    private String releaseReason;

    private LocalDateTime releaseTime;
}
