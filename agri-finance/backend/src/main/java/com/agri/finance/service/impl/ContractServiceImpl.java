package com.agri.finance.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.Contract;
import com.agri.finance.mapper.ContractMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class ContractServiceImpl extends ServiceImpl<ContractMapper, Contract> {

    public Contract createContract(Contract contract) {
        contract.setContractNo("CT" + System.currentTimeMillis());
        if (contract.getStatus() == null || contract.getStatus().isBlank()) {
            contract.setStatus("待签署");
        }
        if (contract.getSignStatus() == null || contract.getSignStatus().isBlank()) {
            contract.setSignStatus("待签署");
        }
        contract.setCreatedAt(LocalDateTime.now());
        contract.setUpdatedAt(LocalDateTime.now());
        contract.setDelFlag(0);
        save(contract);
        return contract;
    }

    /** 双方都签了字才算签完（放款闸门只看这个）。 */
    public boolean isFullySigned(Contract contract) {
        return contract != null
                && contract.getBorrowerSignTime() != null && !contract.getBorrowerSignTime().isBlank()
                && contract.getLenderSignTime() != null && !contract.getLenderSignTime().isBlank();
    }

    /**
     * 按签署方落签。
     *
     * <p>{@code side} 由控制器根据**调用方身份**决定，不再来自请求参数 ——
     * 原实现里融资方自己传 {@code signType=lender} 就能替银行签字，
     * 一份合同两头都是自己签的，等于合同没有对手方。</p>
     */
    @Transactional
    public Contract sign(String contractId, String side) {
        Contract contract = getById(contractId);
        if (contract == null || Integer.valueOf(1).equals(contract.getDelFlag())) {
            throw new BusinessException(404, "借款合同不存在");
        }
        if ("已作废".equals(contract.getStatus())) {
            throw new BusinessException(409, "合同已作废，不能签署");
        }
        String now = LocalDateTime.now().toString();
        if ("borrower".equals(side)) {
            if (contract.getBorrowerSignTime() != null && !contract.getBorrowerSignTime().isBlank()) {
                throw new BusinessException(409, "融资方已签署该合同");
            }
            contract.setBorrowerSignTime(now);
        } else {
            if (contract.getLenderSignTime() != null && !contract.getLenderSignTime().isBlank()) {
                throw new BusinessException(409, "资金方已签署该合同");
            }
            contract.setLenderSignTime(now);
        }
        if (isFullySigned(contract)) {
            // 状态推进到「执行中」由放款统一做：没放款就说"执行中"是提前定性
            contract.setSignStatus("已签署");
        } else {
            contract.setSignStatus("borrower".equals(side) ? "融资方已签" : "资金方已签");
        }
        contract.setUpdatedAt(LocalDateTime.now());
        updateById(contract);
        return contract;
    }
}
