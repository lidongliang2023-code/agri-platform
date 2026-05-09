package com.agri.trade.service.impl;

import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.ITradeOrderService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class TradeOrderServiceImpl extends ServiceImpl<TradeOrderMapper, TradeOrder> implements ITradeOrderService {
}