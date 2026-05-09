package com.agri.trade.service.impl;

import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.ITradeProductService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class TradeProductServiceImpl extends ServiceImpl<TradeProductMapper, TradeProduct> implements ITradeProductService {
}