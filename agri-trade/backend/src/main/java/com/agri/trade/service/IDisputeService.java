package com.agri.trade.service;

import com.agri.trade.entity.Dispute;
import com.baomidou.mybatisplus.extension.service.IService;

import java.math.BigDecimal;
import java.util.List;

public interface IDisputeService extends IService<Dispute> {

    Dispute createDispute(Long orderId, String complainantType, Long complainantId, String complainantName,
                          String disputeType, String disputeReason, String disputeDescription,
                          BigDecimal claimAmount, String evidenceJson);

    boolean submitEvidence(Long disputeId, String evidenceJson);

    boolean respondDispute(Long disputeId, String responseContent, String evidenceJson);

    boolean startMediation(Long disputeId, String mediator);

    boolean submitMediationResult(Long disputeId, String mediationResult);

    boolean startArbitration(Long disputeId, String arbitrator);

    boolean submitArbitrationResult(Long disputeId, String arbitrationResult, BigDecimal compensationAmount);

    boolean applyReview(Long disputeId, String reviewReason);

    boolean confirmResult(Long disputeId);

    boolean closeDispute(Long disputeId, String closeReason);

    boolean executeCompensation(Long disputeId);

    List<Dispute> getDisputesByUser(Long userId, String userType);

    List<Dispute> getPendingDisputes();

    List<Dispute> getProcessingDisputes();

    Dispute getDisputeByOrder(Long orderId);

    List<Dispute> searchDisputes(String disputeNo, String status, Long orderId);
}