package com.agri.trade.service.impl;

import com.agri.trade.entity.Demand;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.service.IDemandService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class DemandServiceImpl extends ServiceImpl<DemandMapper, Demand> implements IDemandService {
}