package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 登录用户关注的供应商店铺。 */
@Data
@TableName("agri_trade_shop_follow")
public class ShopFollow {

    @TableId(type = IdType.AUTO)
    private Long id;
    private Long userId;
    private Long sellerId;
    private LocalDateTime createTime;
}
