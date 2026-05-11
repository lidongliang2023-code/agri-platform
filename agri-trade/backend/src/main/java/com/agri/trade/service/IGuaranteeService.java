package com.agri.trade.service;

import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.entity.CompensationRecord;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;

public interface IGuaranteeService extends IService<MerchantGuarantee> {

    MerchantGuarantee createGuarantee(Long merchantId, String merchantName, BigDecimal amount);

    boolean freezeGuarantee(Long guaranteeId, BigDecimal amount);

    boolean unfreezeGuarantee(Long guaranteeId, BigDecimal amount);

    boolean deductGuarantee(Long guaranteeId, BigDecimal amount);

    boolean replenishGuarantee(Long guaranteeId, BigDecimal amount);

    BigDecimal getAvailableBalance(Long merchantId);

    List<MerchantGuarantee> getGuaranteesByMerchant(Long merchantId);

    boolean transferToCompensation(Long guaranteeId, Long disputeId, BigDecimal amount);
}