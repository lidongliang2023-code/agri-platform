package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

/**
 * 运营配置项。
 *
 * <p>只应有"有代码在读"的键 —— 一个配置改了没反应，比没有这一页更糟。</p>
 */
@Data
@TableName("agri_trade_config")
public class TradeConfig {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String configKey;

    private String configValue;

    /** string / number / boolean */
    private String valueType;

    private String configGroup;

    private String configName;

    private String description;

    /** 1 可改 / 0 只读（只读项用于把"由配置文件决定"的项也展示出来） */
    private Integer editable;

    private Integer delFlag;

    private Date createTime;

    private Date updateTime;
}
