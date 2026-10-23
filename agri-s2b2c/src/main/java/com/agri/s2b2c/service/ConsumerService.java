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
    boolean updateCart(Long id, Integer quantity);
    boolean deleteCart(Long id);
    boolean clearCart(Long consumerId);
}