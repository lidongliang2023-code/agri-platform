package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Consumer;
import com.agri.s2b2c.vo.CartVO;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface ConsumerService extends IService<Consumer> {
    Consumer getByPhone(String phone);
    boolean register(Consumer consumer);
    boolean updateInfo(Consumer consumer);
    List<CartVO> getCart(Long consumerId);
    boolean addCart(Long consumerId, Long productId, Integer quantity);

    /** 渠道店铺加购：channelId 必须已在 channel_product 中选中该商品。 */
    boolean addCart(Long consumerId, Long productId, Integer quantity, Long channelId);
    boolean updateCart(Long id, Integer quantity);

    /** 数量与勾选状态可单独更新，传 null 表示该字段不变（都不传由调用方拦截）。 */
    boolean updateCart(Long id, Integer quantity, Boolean selected);
    boolean deleteCart(Long id);
    boolean clearCart(Long consumerId);
}