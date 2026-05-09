package com.agri.trade.service.impl;

import com.agri.trade.entity.Logistics;
import com.agri.trade.mapper.LogisticsMapper;
import com.agri.trade.service.ILogisticsService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class LogisticsServiceImpl extends ServiceImpl<LogisticsMapper, Logistics> implements ILogisticsService {
}