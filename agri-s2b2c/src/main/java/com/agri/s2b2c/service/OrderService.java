package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.vo.OrderVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

public interface OrderService extends IService<Order> {
    OrderVO getDetail(Long id);
    IPage<OrderVO> pageList(int page, int size, Long consumerId, Long shopId, String status);
    boolean create(Order order);

    /**
     * 拆单下单：按「渠道 + 供应商」拆成多个订单。
     *
     * <p>入参 channelId 是渠道店铺带来的渠道；购物车里属于该渠道选品的商品归入渠道订单，
     * 其余商品按供应商归入直购订单（channelId 为空）。同一供应商的同类商品合并为一单。</p>
     *
     * @return 新建订单 ID 列表
     */
    java.util.List<Long> createSplit(Order order);

    /**
     * 状态流转结果。带 message 而不是只回 boolean：
     * 「待付款的订单不能确认收货」这种拒绝必须能让用户下一步做对的事，
     * 只回 false 的表现为"按钮点了没反应"，用户只会反复点。
     */
    record StatusResult(boolean success, String message) {
    }

    /**
     * 按 {@link OrderStatus} 的流转表改状态。
     *
     * <p>此前这里没有任何前置校验（只有"支付"那一档管了来源状态），
     * 于是待付款订单可以直接确认收货、已完成的单能被再次置成待发货 ——
     * 而佣金结算、渠道等级、对账全都读的是这个 status。</p>
     */
    StatusResult changeStatus(Long id, String target);
}