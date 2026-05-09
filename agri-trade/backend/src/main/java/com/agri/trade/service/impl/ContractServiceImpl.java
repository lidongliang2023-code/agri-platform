package com.agri.trade.service.impl;

import com.agri.trade.entity.Contract;
import com.agri.trade.mapper.ContractMapper;
import com.agri.trade.service.IContractService;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

@Service
public class ContractServiceImpl extends ServiceImpl<ContractMapper, Contract> implements IContractService {
}