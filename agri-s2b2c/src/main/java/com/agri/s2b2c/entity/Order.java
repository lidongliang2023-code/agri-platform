package com.agri.s2b2c.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("s2b2c_order")
public class Order {
    @TableId(type = IdType.ASSIGN_ID)
    private Long id;
    private String orderNo;
    private Long consumerId;
    private Long shopId;
    private Long supplierId;
    private Long channelId;
    private Long addressId;
    private String status;
    /** 发货协同：NONE/PENDING/CONFIRMED/REJECTED */
    private String shipConfirmStatus;
    /** 发货协同：最近提交方 SUPPLIER/CHANNEL */
    private String shipProposedBy;
    private BigDecimal totalAmount;
    private BigDecimal discountAmount;
    private BigDecimal freightAmount;
    private BigDecimal payAmount;
    /** 使用的券记录（s2b2c_coupon_user.id）；拆单时各子单都记录同一个券记录。 */
    private Long couponUserId;
    /** 子单分摊到的券优惠金额。 */
    private BigDecimal couponDiscount;
    private String payMethod;
    private LocalDateTime payTime;
    private String deliveryType;
    private String deliveryTime;
    private String logisticsNo;
    private String logisticsCompany;
    private String remark;
    /** 拼团归属：活动ID与团实例ID，普通订单为空。 */
    private Long groupBuyId;
    private Long groupInstanceId;
    /** 拼团补贴金额：用于取消订单时回补活动预算。 */
    private BigDecimal groupSubsidy;
    /**
     * 拼团结算单价：由 GroupBuyService 校验（团长价/团价）后写入，不落库。
     * createSplit 见到它就按该价落单，不再叠加秒杀价。
     */
    @TableField(exist = false)
    private BigDecimal groupUnitPrice;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}