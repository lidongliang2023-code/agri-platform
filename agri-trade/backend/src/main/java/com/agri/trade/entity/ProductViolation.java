package com.agri.trade.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.util.Date;

/**
 * 商品违规处置记录。
 *
 * <p>每次处置留一条：谁、因为什么、把哪个货源怎么了。商家会来问"我的货为什么没了"，
 * 恢复时把记录标记为已撤销，而不是把痕迹删掉。</p>
 */
@Data
@TableName("agri_trade_product_violation")
public class ProductViolation {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String violationNo;

    private Long productId;

    /** 留痕快照：货源可能被改名或删除，处置时的名字要留下来 */
    private String productName;

    private Long sellerId;

    private String sellerName;

    private String violationType;

    private String reason;

    private String action;

    /** active 生效中 / revoked 已撤销 */
    private String violationStatus;

    /** 处置前的上架状态，恢复时用 */
    private String previousPublishStatus;

    private String operator;

    private Date revokeTime;

    private String revokeReason;

    private Integer delFlag;

    private Date createTime;

    private Date updateTime;
}
