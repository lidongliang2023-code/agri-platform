package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

/**
 * 产销对接规则配置（交易侧）。
 *
 * <p>审核 / 建品 / 回写三组规则存在这里，规则变更留版本号；
 * 已发生的业务按当时规则执行，不追溯改判。</p>
 */
@Data
@TableName("agri_trade_p2t_rule")
public class P2tRuleConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("rule_code")
    private String ruleCode;
    @TableField("rule_name")
    private String ruleName;
    @TableField("rule_json")
    private String ruleJson;
    private String version;
    private Integer status;

    @TableField("create_time")
    private Date createTime;
    @TableField("update_time")
    private Date updateTime;
}
