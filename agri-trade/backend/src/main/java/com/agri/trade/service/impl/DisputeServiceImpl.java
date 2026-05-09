package com.agri.trade.service.impl;

import com.agri.trade.entity.Dispute;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.service.IDisputeService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class DisputeServiceImpl extends ServiceImpl<DisputeMapper, Dispute> implements IDisputeService {
}