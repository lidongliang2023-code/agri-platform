package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 渠道选品关系：商品归属于供应商，渠道只"选中"它，不改写商品数据。 */
@Data
@TableName("s2b2c_channel_product")
public class ChannelProduct {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long channelId;
    private Long productId;
    private Long supplierId;
    /** ACTIVE / REVOKED */
    private String status;
    /** 渠道零售价；空表示沿用商品价 */
    private java.math.BigDecimal retailPrice;
    /** 渠道货架：ON / OFF（下架不影响历史订单与结算） */
    private String shelfStatus;
    private LocalDateTime pickedAt;
    private LocalDateTime updateTime;
}
