package com.agri.finance.service.impl;

import com.agri.finance.entity.Contract;
import com.agri.finance.mapper.ContractMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class ContractServiceImpl extends ServiceImpl<ContractMapper, Contract> {

    public Contract createContract(Contract contract) {
        contract.setContractNo("CT" + System.currentTimeMillis());
        contract.setStatus("生效中");
        contract.setSignStatus("待签署");
        contract.setCreatedAt(LocalDateTime.now());
        contract.setUpdatedAt(LocalDateTime.now());
        contract.setDelFlag(0);
        save(contract);
        return contract;
    }

    public Contract signContract(String id, String signType) {
        Contract contract = getById(id);
        if (contract != null) {
            if ("borrower".equals(signType)) {
                contract.setBorrowerSignTime(LocalDateTime.now().toString());
            } else {
                contract.setLenderSignTime(LocalDateTime.now().toString());
            }
            if (contract.getBorrowerSignTime() != null && contract.getLenderSignTime() != null) {
                contract.setSignStatus("已签署");
            } else if ("borrower".equals(signType)) {
                contract.setSignStatus("融资方已签");
            }
            contract.setUpdatedAt(LocalDateTime.now());
            updateById(contract);
        }
        return contract;
    }
}
