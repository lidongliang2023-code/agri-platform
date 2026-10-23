package com.agri.finance.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("risk_control_rule")
public class RiskControlRule {

    @TableId(type = IdType.ASSIGN_ID)
    private String id;

    private String ruleNo;

    private String ruleName;

    private String ruleType;

    private String priority;

    private String conditions;

    private String action;

    private String description;

    private String status;

    private String creatorId;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private Integer delFlag;
}