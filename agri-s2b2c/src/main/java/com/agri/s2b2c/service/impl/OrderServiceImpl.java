package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.Address;
import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.entity.OrderItem;
import com.agri.s2b2c.mapper.AddressMapper;
import com.agri.s2b2c.mapper.OrderItemMapper;
import com.agri.s2b2c.mapper.OrderMapper;
import com.agri.s2b2c.service.OrderService;
import com.agri.s2b2c.vo.AddressVO;
import com.agri.s2b2c.vo.OrderItemVO;
import com.agri.s2b2c.vo.OrderVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class OrderServiceImpl extends ServiceImpl<OrderMapper, Order> implements OrderService {

    private final OrderItemMapper orderItemMapper;
    private final AddressMapper addressMapper;

    private static final Map<String, String> STATUS_MAP = new HashMap<>();
    static {
        STATUS_MAP.put("PENDING_PAY", "待付款");
        STATUS_MAP.put("PENDING_SHIP", "待发货");
        STATUS_MAP.put("SHIPPED", "已发货");
        STATUS_MAP.put("PENDING_RECEIVE", "待收货");
        STATUS_MAP.put("COMPLETED", "已完成");
        STATUS_MAP.put("CANCELLED", "已取消");
        STATUS_MAP.put("REFUNDING", "退款中");
    }

    public OrderServiceImpl(OrderItemMapper orderItemMapper, AddressMapper addressMapper) {
        this.orderItemMapper = orderItemMapper;
        this.addressMapper = addressMapper;
    }

    @Override
    public OrderVO getDetail(Long id) {
        Order order = baseMapper.selectById(id);
        return convertToVO(order);
    }

    @Override
    public IPage<OrderVO> pageList(int page, int size, Long consumerId, Long shopId, String status) {
        LambdaQueryWrapper<Order> wrapper = new LambdaQueryWrapper<>();
        if (consumerId != null) {
            wrapper.eq(Order::getConsumerId, consumerId);
        }
        if (shopId != null) {
            wrapper.eq(Order::getShopId, shopId);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Order::getStatus, status);
        }
        wrapper.orderByDesc(Order::getCreateTime);

        Page<Order> pageQuery = new Page<>(page, size);
        IPage<Order> pageResult = baseMapper.selectPage(pageQuery, wrapper);

        return pageResult.convert(this::convertToVO);
    }

    @Override
    public boolean create(Order order) {
        order.setOrderNo("ORD" + System.currentTimeMillis());
        order.setStatus("PENDING_PAY");
        order.setCreateTime(LocalDateTime.now());
        order.setUpdateTime(LocalDateTime.now());
        return save(order);
    }

    @Override
    public boolean updateStatus(Long id, String status) {
        Order order = baseMapper.selectById(id);
        if (order == null) return false;
        order.setStatus(status);
        order.setUpdateTime(LocalDateTime.now());
        if ("PENDING_SHIP".equals(status)) {
            order.setDeliveryTime(LocalDateTime.now().toString());
        }
        if ("COMPLETED".equals(status)) {
            order.setPayTime(LocalDateTime.now());
        }
        return updateById(order);
    }

    @Override
    public boolean updateLogistics(Long id, String logisticsNo, String logisticsCompany) {
        Order order = baseMapper.selectById(id);
        if (order == null) return false;
        order.setLogisticsNo(logisticsNo);
        order.setLogisticsCompany(logisticsCompany);
        order.setStatus("SHIPPED");
        order.setUpdateTime(LocalDateTime.now());
        return updateById(order);
    }

    private OrderVO convertToVO(Order order) {
        if (order == null) return null;
        OrderVO vo = new OrderVO();
        BeanUtils.copyProperties(order, vo);
        vo.setStatusText(STATUS_MAP.getOrDefault(order.getStatus(), order.getStatus()));

        LambdaQueryWrapper<OrderItem> itemWrapper = new LambdaQueryWrapper<>();
        itemWrapper.eq(OrderItem::getOrderId, order.getId());
        List<OrderItem> items = orderItemMapper.selectList(itemWrapper);
        vo.setItems(items.stream().map(this::convertItemToVO).toList());

        Address address = addressMapper.selectById(order.getAddressId());
        if (address != null) {
            AddressVO addressVO = new AddressVO();
            BeanUtils.copyProperties(address, addressVO);
            vo.setAddress(addressVO);
        }

        return vo;
    }

    private OrderItemVO convertItemToVO(OrderItem item) {
        OrderItemVO vo = new OrderItemVO();
        BeanUtils.copyProperties(item, vo);
        return vo;
    }
}