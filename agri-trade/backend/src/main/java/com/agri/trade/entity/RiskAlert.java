package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

/**
 * 风控告警。
 *
 * <p>每一条都是扫描时用真实数据算出来的，{@code detail} 里带着当时算出的数字，
 * 运营可以自己复核 —— 与"写死的假预警"是两回事。</p>
 */
@Data
@TableName("agri_trade_risk_alert")
public class RiskAlert {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String alertNo;

    /** low_price 异常低价 / low_rating 差评集中 / delivery_timeout 发货超时 */
    private String ruleCode;

    private String ruleName;

    /** high / medium / low */
    private String alertLevel;

    /** product / merchant / order */
    private String subjectType;

    private Long subjectId;

    private String subjectName;

    private String title;

    /** 判定依据（含当时算出的数字） */
    private String detail;

    /** new 待处理 / handled 已处理 / ignored 已忽略 */
    private String alertStatus;

    private String handler;

    private Date handleTime;

    private String handleRemark;

    private Date detectedAt;

    private Integer delFlag;

    private Date createTime;

    private Date updateTime;
}
