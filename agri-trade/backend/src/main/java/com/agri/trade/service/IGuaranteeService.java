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

    /**
     * 带操作人与原因的冻结 / 解冻。
     *
     * <p>金额变动要留痕：谁、什么时候、因为什么动的。原因是必填项 ——
     * 冻结商家的钱而不能回答"为什么"，是最容易被投诉也最难自证的一类问题。</p>
     */
    boolean freezeGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason);

    boolean unfreezeGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason);

    /** 保证金账户的流水（按时间倒序）。 */
    List<com.agri.trade.entity.GuaranteeLog> getLogs(Long guaranteeId);

    boolean deductGuarantee(Long guaranteeId, BigDecimal amount);

    boolean replenishGuarantee(Long guaranteeId, BigDecimal amount);

    BigDecimal getAvailableBalance(Long merchantId);

    List<MerchantGuarantee> getGuaranteesByMerchant(Long merchantId);

    boolean transferToCompensation(Long guaranteeId, Long disputeId, BigDecimal amount);
}
