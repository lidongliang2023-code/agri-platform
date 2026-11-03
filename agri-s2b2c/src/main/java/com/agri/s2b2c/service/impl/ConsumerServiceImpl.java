package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.Cart;
import com.agri.s2b2c.entity.ChannelProduct;
import com.agri.s2b2c.entity.Consumer;
import com.agri.s2b2c.entity.Product;
import com.agri.s2b2c.mapper.CartMapper;
import com.agri.s2b2c.mapper.ChannelProductMapper;
import com.agri.s2b2c.mapper.ConsumerMapper;
import com.agri.s2b2c.mapper.ProductMapper;
import com.agri.s2b2c.service.ActivityPriceService;
import com.agri.s2b2c.service.ConsumerService;
import com.agri.s2b2c.vo.CartVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ConsumerServiceImpl extends ServiceImpl<ConsumerMapper, Consumer> implements ConsumerService {

    private final CartMapper cartMapper;
    private final ChannelProductMapper channelProductMapper;
    private final ProductMapper productMapper;
    private final ObjectMapper objectMapper;
    private final ActivityPriceService activityPriceService;

    public ConsumerServiceImpl(CartMapper cartMapper, ChannelProductMapper channelProductMapper,
                               ProductMapper productMapper, ObjectMapper objectMapper,
                               ActivityPriceService activityPriceService) {
        this.cartMapper = cartMapper;
        this.channelProductMapper = channelProductMapper;
        this.productMapper = productMapper;
        this.objectMapper = objectMapper;
        this.activityPriceService = activityPriceService;
    }

    @Override
    public Consumer getByPhone(String phone) {
        LambdaQueryWrapper<Consumer> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Consumer::getPhone, phone);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public boolean register(Consumer consumer) {
        consumer.setMemberLevel("NORMAL");
        consumer.setTotalConsume(java.math.BigDecimal.ZERO);
        consumer.setPoints(0);
        consumer.setStatus("ACTIVE");
        consumer.setCreateTime(LocalDateTime.now());
        consumer.setUpdateTime(LocalDateTime.now());
        return save(consumer);
    }

    @Override
    public boolean updateInfo(Consumer consumer) {
        Consumer existing = baseMapper.selectById(consumer.getId());
        if (existing == null) return false;
        consumer.setMemberLevel(existing.getMemberLevel());
        consumer.setTotalConsume(existing.getTotalConsume());
        consumer.setPoints(existing.getPoints());
        consumer.setStatus(existing.getStatus());
        consumer.setUpdateTime(LocalDateTime.now());
        return updateById(consumer);
    }

    @Override
    public List<CartVO> getCart(Long consumerId) {
        LambdaQueryWrapper<Cart> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Cart::getConsumerId, consumerId);
        wrapper.orderByDesc(Cart::getCreateTime);
        List<Cart> carts = cartMapper.selectList(wrapper);
        return carts.stream().map(this::convertCartToVO).toList();
    }

    @Override
    public boolean addCart(Long consumerId, Long productId, Integer quantity) {
        return addCart(consumerId, productId, quantity, null);
    }

    @Override
    public boolean addCart(Long consumerId, Long productId, Integer quantity, Long channelId) {
        Product product = productMapper.selectById(productId);
        if (product == null) return false;
        if (channelId != null) {
            // 渠道店铺加购：商品必须在该渠道的选品清单里，且货架未下架
            ChannelProduct relation = channelProductMapper.selectOne(new LambdaQueryWrapper<ChannelProduct>()
                    .eq(ChannelProduct::getChannelId, channelId)
                    .eq(ChannelProduct::getProductId, productId)
                    .last("LIMIT 1"));
            if (relation == null || !"ACTIVE".equals(relation.getStatus())) {
                throw new IllegalArgumentException("该渠道未上架此商品，不能从渠道店铺加购");
            }
            if ("OFF".equalsIgnoreCase(relation.getShelfStatus())) {
                throw new IllegalArgumentException("该商品已在渠道店铺下架");
            }
        }

        LambdaQueryWrapper<Cart> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Cart::getConsumerId, consumerId);
        wrapper.eq(Cart::getProductId, productId);
        if (channelId == null) {
            wrapper.isNull(Cart::getChannelId);
        } else {
            wrapper.eq(Cart::getChannelId, channelId);
        }
        Cart existing = cartMapper.selectOne(wrapper);

        if (existing != null) {
            existing.setQuantity(existing.getQuantity() + quantity);
            existing.setUpdateTime(LocalDateTime.now());
            return cartMapper.updateById(existing) > 0;
        }

        Cart cart = new Cart();
        cart.setConsumerId(consumerId);
        cart.setShopId(product.getSupplierId());
        cart.setProductId(productId);
        cart.setChannelId(channelId);
        cart.setQuantity(quantity);
        cart.setSelected(true);
        cart.setCreateTime(LocalDateTime.now());
        cart.setUpdateTime(LocalDateTime.now());
        return cartMapper.insert(cart) > 0;
    }

    @Override
    public boolean updateCart(Long id, Integer quantity) {
        return updateCart(id, quantity, null);
    }

    @Override
    public boolean updateCart(Long id, Integer quantity, Boolean selected) {
        Cart cart = cartMapper.selectById(id);
        if (cart == null) return false;
        if (quantity != null) {
            cart.setQuantity(quantity);
        }
        if (selected != null) {
            cart.setSelected(selected);
        }
        cart.setUpdateTime(LocalDateTime.now());
        return cartMapper.updateById(cart) > 0;
    }

    @Override
    public boolean deleteCart(Long id) {
        return cartMapper.deleteById(id) > 0;
    }

    @Override
    public boolean clearCart(Long consumerId) {
        LambdaQueryWrapper<Cart> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Cart::getConsumerId, consumerId);
        return cartMapper.delete(wrapper) > 0;
    }

    private CartVO convertCartToVO(Cart cart) {
        if (cart == null) return null;
        CartVO vo = new CartVO();
        BeanUtils.copyProperties(cart, vo);
        Product product = productMapper.selectById(cart.getProductId());
        if (product != null) {
            vo.setName(product.getName());
            vo.setPrice(product.getPrice());
            vo.setOriginalPrice(product.getPrice());
            // 秒杀进行中：购物车小计按活动价，页面会打「秒杀价」标；下单时后端按同一规则重算
            ActivityPriceService.Flash flash = activityPriceService.activeFlash(product.getId());
            if (flash != null) {
                vo.setActivityPrice(flash.price());
                vo.setActivityType("FLASH");
                vo.setActivityEndTime(flash.endTime());
            }
            vo.setStock(product.getStock());
            vo.setSpec(product.getSpec());
            try {
                List<String> images = objectMapper.readValue(product.getImages(), new TypeReference<List<String>>() {});
                vo.setImage(images.isEmpty() ? "" : images.get(0));
            } catch (Exception e) {
                vo.setImage("");
            }
        }
        return vo;
    }
}
