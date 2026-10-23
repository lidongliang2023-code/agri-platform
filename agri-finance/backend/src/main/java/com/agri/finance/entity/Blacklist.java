package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("blacklist")
public class Blacklist {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String listNo;

    private String userId;

    private String userName;

    private String listType;

    private String reason;

    private String evidence;

    private String reviewStatus;

    private String reviewerId;

    private String reviewerName;

    private LocalDateTime addedTime;

    private LocalDateTime removedTime;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}