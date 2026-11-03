package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Consumer;
import com.agri.s2b2c.entity.Address;
import com.agri.s2b2c.entity.Cart;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.mapper.AddressMapper;
import com.agri.s2b2c.mapper.CartMapper;
import com.agri.s2b2c.mapper.ConsumerMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.security.SecurityUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * 把平台账号映射到 S2B2C 的消费者档案。
 *
 * <p>历史数据里消费者是"手机号注册"的独立表，没有 user_id。统一登录后必须补上映射：
 * 先按 user_id 找；找不到再按手机号（用户名是手机号时）认领老档案；都没有就新建。
 * 这样既能让新账号直接用，也不会把老消费者的购物车/订单割裂出去。</p>
 */
@Service
@RequiredArgsConstructor
public class ConsumerIdentityService {

    private final ConsumerMapper consumerMapper;
    private final OrderMapper orderMapper;
    private final CartMapper cartMapper;
    private final AddressMapper addressMapper;

    /** 当前登录用户的消费者档案；首次访问时自动建档。 */
    public Consumer current() {
        Long userId = SecurityUtils.getUserId();
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
        }
        Consumer byUser = consumerMapper.selectOne(new LambdaQueryWrapper<Consumer>()
                .eq(Consumer::getUserId, userId)
                .last("LIMIT 1"));
        if (byUser != null) {
            return byUser;
        }
        String username = SecurityUtils.getUsername();
        Consumer byPhone = null;
        if (username != null && username.matches("^1[3-9]\\d{9}$")) {
            byPhone = consumerMapper.selectOne(new LambdaQueryWrapper<Consumer>()
                    .eq(Consumer::getPhone, username)
                    .last("LIMIT 1"));
        }
        if (byPhone != null) {
            byPhone.setUserId(userId);
            consumerMapper.updateById(byPhone);
            return byPhone;
        }
        Consumer created = new Consumer();
        created.setUserId(userId);
        created.setNickname(username == null ? "平台用户" : username);
        created.setStatus("ACTIVE");
        consumerMapper.insert(created);
        return created;
    }

    /** 按订单 id 反查归属：不存在 404，别人的 403。 */
    public void requireOwnOrder(Long orderId) {
        Order order = orderId == null ? null : orderMapper.selectById(orderId);
        if (order == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "订单不存在");
        }
        requireSelf(order.getConsumerId());
    }

    /** 按购物车行 id 反查归属。 */
    public void requireOwnCartItem(Long cartId) {
        Cart cart = cartId == null ? null : cartMapper.selectById(cartId);
        if (cart == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "购物车项不存在");
        }
        requireSelf(cart.getConsumerId());
    }

    /** 按地址 id 反查归属。 */
    public Address requireOwnAddress(Long addressId) {
        Address address = addressId == null ? null : addressMapper.selectById(addressId);
        if (address == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "地址不存在");
        }
        requireSelf(address.getConsumerId());
        return address;
    }

    /** 校验入参 consumerId 是否就是当前登录用户，防止改个数字就看到别人的购物车/订单。 */
    public void requireSelf(Long consumerId) {
        Consumer mine = current();
        if (consumerId != null && !consumerId.equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权访问其他消费者的数据");
        }
    }
}
