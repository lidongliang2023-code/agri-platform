package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.*;
import com.agri.s2b2c.mapper.*;
import com.agri.s2b2c.service.impl.ConsumerServiceImpl;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ConsumerCartPriceTest {
    @Test void usesFlashPriceForEligibleConsumer() { checkPrice(0, null, "58.00"); }
    @Test void fallsBackAfterPersonalLimit() { checkPrice(2, null, "68.00"); }
    @Test void usesChannelRetailPriceAfterLimit() { checkPrice(2, new BigDecimal("75.00"), "75.00"); }
    private void checkPrice(int purchased, BigDecimal retailPrice, String expected) {
        CartMapper carts = mock(CartMapper.class);
        ChannelProductMapper channels = mock(ChannelProductMapper.class);
        ProductMapper products = mock(ProductMapper.class);
        ActivityPriceService activity = mock(ActivityPriceService.class);
        Cart cart = new Cart();
        cart.setId(1L); cart.setConsumerId(10L); cart.setProductId(20L); cart.setQuantity(1);
        Product product = new Product();
        product.setId(20L); product.setPrice(new BigDecimal("68.00")); product.setImages("[]");
        when(carts.selectList(any())).thenReturn(List.of(cart));
        when(products.selectById(20L)).thenReturn(product);
        LocalDateTime start = LocalDateTime.of(2026, 11, 1, 0, 0);
        when(activity.activeFlash(20L)).thenReturn(new ActivityPriceService.Flash(1L,
                new BigDecimal("58.00"), new BigDecimal("68.00"), start, start.plusMonths(1), 100, 2));
        when(activity.purchasedQuantity(20L, 10L, start)).thenReturn(purchased);
        if (retailPrice != null) {
            cart.setChannelId(30L);
            ChannelProduct relation = new ChannelProduct(); relation.setRetailPrice(retailPrice);
            when(channels.selectOne(any())).thenReturn(relation);
        }
        var result = new ConsumerServiceImpl(carts, channels, products, new ObjectMapper(), activity).getCart(10L).get(0);
        assertEquals(0, new BigDecimal(expected).compareTo(result.getPrice()));
        if (purchased >= 2) assertNull(result.getActivityPrice());
        else assertEquals(result.getPrice(), result.getActivityPrice());
    }
}
