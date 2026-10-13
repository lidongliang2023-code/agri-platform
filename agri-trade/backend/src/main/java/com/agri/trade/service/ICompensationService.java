package com.agri.trade.service;

import com.agri.trade.entity.CompensationRecord;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;

public interface ICompensationService extends IService<CompensationRecord> {

    CompensationRecord createCompensation(Long orderId, Long disputeId, String compensationType,
                                          BigDecimal amount, Long applicantId, String applicantName);

    CompensationRecord reviewCompensation(Long compensationId, String reviewResult, String reviewer, String remark);

    boolean executeCompensation(Long compensationId);

    CompensationRecord getByDispute(Long disputeId);

    List<CompensationRecord> getByOrder(Long orderId);

    List<CompensationRecord> getByRecipient(Long recipientId);

    /**
     * 按"收款方属于我"取赔付单（用户端「我的获赔」用）。
     *
     * <p>一个人可能绑了多家主体，这里一次查完，范围由服务端从令牌推导。</p>
     */
    List<CompensationRecord> getByRecipients(java.util.Collection<Long> recipientIds);
}
