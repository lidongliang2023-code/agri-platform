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
        refreshMatured(providerId);
        LambdaQueryWrapper<Investment> query = new LambdaQueryWrapper<>();
        query.eq(Investment::getProviderId, providerId)
             .eq(Investment::getDelFlag, 0)
             .orderByDesc(Investment::getInvestmentTime);
        return list(query);
    }

    public Investment getInvestmentDetail(String investmentId) {
        return getById(investmentId);
    }

    public long countByAsset(String assetId) {
        return lambdaQuery()
                .eq(Investment::getAssetId, assetId)
                .eq(Investment::getDelFlag, 0)
                .count();
    }

    public BigDecimal calculateProviderAssetInvestment(String providerId, String assetId) {
        return lambdaQuery()
                .eq(Investment::getProviderId, providerId)
                .eq(Investment::getAssetId, assetId)
                .eq(Investment::getDelFlag, 0)
                .list()
                .stream()
                .map(Investment::getInvestmentAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public Investment completeInvestment(String investmentId) {
        Investment investment = getById(investmentId);
        if (investment == null || !java.util.Set.of("投资中", "待回款").contains(investment.getStatus())) {
            return null;
        }
        investment.setStatus("已完成");
        investment.setActualReturnTime(LocalDateTime.now());
        investment.setActualReturnAmount(
                investment.getInvestmentAmount().add(
                        investment.getExpectedReturn() == null ? BigDecimal.ZERO : investment.getExpectedReturn()
                )
        );
        investment.setUpdatedAt(LocalDateTime.now());
        updateById(investment);
        return investment;
    }

    /**
     * 到期投资自动进入待回款状态，工作台和投资组合无需依赖前端时间推断。
     */
    public void refreshMatured(String providerId) {
        LocalDateTime now = LocalDateTime.now();
        List<Investment> matured = lambdaQuery()
                .eq(Investment::getProviderId, providerId)
                .eq(Investment::getStatus, "投资中")
                .le(Investment::getExpectedReturnTime, now)
                .eq(Investment::getDelFlag, 0)
                .list();
        if (!matured.isEmpty()) {
            matured.forEach(item -> {
                item.setStatus("待回款");
                item.setUpdatedAt(now);
            });
            updateBatchById(matured);
        }
    }

    public BigDecimal calculateTotalReturn(String providerId) {
        LambdaQueryWrapper<Investment> query = new LambdaQueryWrapper<>();
        query.eq(Investment::getProviderId, providerId)
             .eq(Investment::getStatus, "已完成")
             .eq(Investment::getDelFlag, 0);
        List<Investment> investments = list(query);
        return investments.stream()
                .map(Investment::getActualReturnAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal calculateTotalInvested(String providerId) {
        LambdaQueryWrapper<Investment> query = new LambdaQueryWrapper<>();
        query.eq(Investment::getProviderId, providerId)
             .eq(Investment::getDelFlag, 0);
        List<Investment> investments = list(query);
        return investments.stream()
                .map(Investment::getInvestmentAmount)
                .filter(java.util.Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
