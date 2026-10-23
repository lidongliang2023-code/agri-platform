package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Order;
import com.agri.s2b2c.vo.OrderVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.service.IService;

public interface OrderService extends IService<Order> {
    OrderVO getDetail(Long id);
    IPage<OrderVO> pageList(int page, int size, Long consumerId, Long shopId, String status);
    boolean create(Order order);
    boolean updateStatus(Long id, String status);
    boolean updateLogistics(Long id, String logisticsNo, String logisticsCompany);
}