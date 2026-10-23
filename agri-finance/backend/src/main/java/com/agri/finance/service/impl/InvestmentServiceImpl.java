package com.agri.finance.service.impl;

import com.agri.finance.entity.Investment;
import com.agri.finance.mapper.InvestmentMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class InvestmentServiceImpl extends ServiceImpl<InvestmentMapper, Investment> {

    public Investment createInvestment(Investment investment) {
        investment.setInvestmentNo("INV" + System.currentTimeMillis());
        investment.setStatus("投资中");
        investment.setInvestmentTime(LocalDateTime.now());
        investment.setCreatedAt(LocalDateTime.now());
        investment.setUpdatedAt(LocalDateTime.now());
        investment.setDelFlag(0);
        save(investment);
        return investment;
    }

    public List<Investment> getInvestmentsByProvider(String providerId) {
        LambdaQueryWrapper<Investment> query = new LambdaQueryWrapper<>();
        query.eq(Investment::getProviderId, providerId)
             .eq(Investment::getDelFlag, 0)
             .orderByDesc(Investment::getInvestmentTime);
        return list(query);
    }

    public Investment getInvestmentDetail(String investmentId) {
        return getById(investmentId);
    }

    public Investment completeInvestment(String investmentId) {
        Investment investment = getById(investmentId);
        if (investment != null) {
            investment.setStatus("已完成");
            investment.setActualReturnTime(LocalDateTime.now());
            investment.setActualReturnAmount(investment.getInvestmentAmount().add(investment.getExpectedReturn()));
            investment.setUpdatedAt(LocalDateTime.now());
            updateById(investment);
        }
        return investment;
    }

    public BigDecimal calculateTotalReturn(String providerId) {
        LambdaQueryWrapper<Investment> query = new LambdaQueryWrapper<>();
        query.eq(Investment::getProviderId, providerId)
             .eq(Investment::getStatus, "已完成")
             .eq(Investment::getDelFlag, 0);
        List<Investment> investments = list(query);
        return investments.stream()
                .map(Investment::getActualReturnAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal calculateTotalInvested(String providerId) {
        LambdaQueryWrapper<Investment> query = new LambdaQueryWrapper<>();
        query.eq(Investment::getProviderId, providerId)
             .eq(Investment::getDelFlag, 0);
        List<Investment> investments = list(query);
        return investments.stream()
                .map(Investment::getInvestmentAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}