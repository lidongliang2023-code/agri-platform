package com.agri.finance.service.impl;

import com.agri.finance.entity.Pledge;
import com.agri.finance.mapper.PledgeMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class PledgeServiceImpl extends ServiceImpl<PledgeMapper, Pledge> {

    public Pledge createPledge(Pledge pledge) {
        if (pledge.getUserId() == null || pledge.getUserId().isBlank()) {
            return null;
        }
        if (pledge.getCommodityType() == null || pledge.getCommodityType().isBlank()
                || pledge.getQuantity() == null || pledge.getQuantity().signum() <= 0
                || pledge.getUnitPrice() == null || pledge.getUnitPrice().signum() <= 0) {
            return null;
        }
        BigDecimal pledgeRate = pledge.getPledgeRate();
        if (pledgeRate == null || pledgeRate.signum() <= 0) {
            pledgeRate = new BigDecimal("70");
        }
        BigDecimal totalValue = pledge.getQuantity().multiply(pledge.getUnitPrice());
        pledge.setTotalValue(totalValue);
        pledge.setPledgeRate(pledgeRate);
        pledge.setLoanAmount(totalValue.multiply(pledgeRate).divide(new BigDecimal("100"), 2, java.math.RoundingMode.HALF_UP));
        pledge.setPledgeNo("PL" + System.currentTimeMillis());
        pledge.setStatus("待审核");
        pledge.setPledgeDate(LocalDateTime.now());
        pledge.setCreatedAt(LocalDateTime.now());
        pledge.setUpdatedAt(LocalDateTime.now());
        pledge.setDelFlag(0);
        save(pledge);
        return pledge;
    }

    public Pledge approvePledge(String id) {
        Pledge pledge = getById(id);
        if (pledge != null) {
            pledge.setStatus("已生效");
            pledge.setUpdatedAt(LocalDateTime.now());
            updateById(pledge);
        }
        return pledge;
    }

    public Pledge releasePledge(String id) {
        Pledge pledge = getById(id);
        if (pledge != null) {
            pledge.setStatus("已释放");
            pledge.setReleaseDate(LocalDateTime.now());
            pledge.setUpdatedAt(LocalDateTime.now());
            updateById(pledge);
        }
        return pledge;
    }
}
