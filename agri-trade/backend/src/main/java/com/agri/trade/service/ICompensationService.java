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
}