package com.agri.trade.service.impl;

import com.agri.trade.entity.Dispute;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.service.IDisputeService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class DisputeServiceImpl extends ServiceImpl<DisputeMapper, Dispute> implements IDisputeService {

    private final TradeOrderMapper orderMapper;

    @Override
    @Transactional
    public Dispute createDispute(Long orderId, String complainantType, Long complainantId, String complainantName,
                                  String disputeType, String disputeReason, String disputeDescription,
                                  BigDecimal claimAmount, String evidenceJson) {
        TradeOrder order = orderMapper.selectById(orderId);
        if (order == null) {
            return null;
        }

        Long respondentId = "buyer".equals(complainantType) ? order.getSellerId() : order.getBuyerId();
        String respondentName = "buyer".equals(complainantType) ? order.getSellerName() : order.getBuyerName();

        Dispute dispute = new Dispute();
        dispute.setDisputeNo("DS" + System.currentTimeMillis());
        dispute.setOrderId(orderId);
        dispute.setOrderNo(order.getOrderNo());
        dispute.setComplainantType(complainantType);
        dispute.setComplainantId(complainantId);
        dispute.setComplainantName(complainantName);
        dispute.setRespondentId(respondentId);
        dispute.setRespondentName(respondentName);
        dispute.setDisputeType(disputeType);
        dispute.setDisputeReason(disputeReason);
        dispute.setDisputeDescription(disputeDescription);
        dispute.setClaimAmount(claimAmount);
        dispute.setEvidenceJson(evidenceJson);
        dispute.setDisputeStatus("pending");
        dispute.setProcessStage("evidence_period");
        dispute.setDelFlag(0);
        dispute.setCreateTime(new Date());
        dispute.setUpdateTime(new Date());

        baseMapper.insert(dispute);

        return dispute;
    }

    @Override
    @Transactional
    public boolean submitEvidence(Long disputeId, String evidenceJson) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setEvidenceJson(evidenceJson);
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean respondDispute(Long disputeId, String responseContent, String evidenceJson) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setDisputeDescription(dispute.getDisputeDescription() + "\n\n【对方回应】：" + responseContent);
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean startMediation(Long disputeId, String mediator) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setDisputeStatus("mediating");
        dispute.setProcessStage("mediation");
        dispute.setMediator(mediator);
        dispute.setMediationTime(new Date());
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean submitMediationResult(Long disputeId, String mediationResult) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setMediationResult(mediationResult);
        dispute.setUpdateTime(new Date());

        if ("agreed".equals(mediationResult)) {
            dispute.setDisputeStatus("resolved");
            dispute.setCloseTime(new Date());
            dispute.setCloseReason("双方达成调解协议");
        } else {
            dispute.setProcessStage("arbitration");
        }

        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean startArbitration(Long disputeId, String arbitrator) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setDisputeStatus("arbitrating");
        dispute.setProcessStage("arbitration");
        dispute.setArbitrator(arbitrator);
        dispute.setArbitrationTime(new Date());
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean submitArbitrationResult(Long disputeId, String arbitrationResult, BigDecimal compensationAmount) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setArbitrationResult(arbitrationResult);
        dispute.setCompensationAmount(compensationAmount);
        dispute.setDisputeStatus("arbitrated");
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean applyReview(Long disputeId, String reviewReason) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setDisputeStatus("reviewing");
        dispute.setProcessStage("review");
        dispute.setRemark(reviewReason);
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean confirmResult(Long disputeId) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setDisputeStatus("confirmed");
        dispute.setCloseTime(new Date());
        dispute.setCloseReason("双方确认仲裁结果");
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        if (dispute.getCompensationAmount() != null && dispute.getCompensationAmount().compareTo(BigDecimal.ZERO) > 0) {
            executeCompensation(disputeId);
        }

        return true;
    }

    @Override
    @Transactional
    public boolean closeDispute(Long disputeId, String closeReason) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setDisputeStatus("closed");
        dispute.setCloseTime(new Date());
        dispute.setCloseReason(closeReason);
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    @Transactional
    public boolean executeCompensation(Long disputeId) {
        Dispute dispute = baseMapper.selectById(disputeId);
        if (dispute == null) {
            return false;
        }

        dispute.setCompensationTime(new Date());
        dispute.setDisputeStatus("compensated");
        dispute.setUpdateTime(new Date());
        baseMapper.updateById(dispute);

        return true;
    }

    @Override
    public List<Dispute> getDisputesByUser(Long userId, String userType) {
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);
        
        if ("buyer".equals(userType)) {
            wrapper.and(w -> w.eq(Dispute::getComplainantType, "buyer").eq(Dispute::getComplainantId, userId)
                    .or().eq(Dispute::getRespondentId, userId));
        } else {
            wrapper.and(w -> w.eq(Dispute::getComplainantType, "seller").eq(Dispute::getComplainantId, userId)
                    .or().eq(Dispute::getRespondentId, userId));
        }
        
        wrapper.orderByDesc(Dispute::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Dispute> getPendingDisputes() {
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);
        wrapper.eq(Dispute::getDisputeStatus, "pending");
        wrapper.orderByDesc(Dispute::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<Dispute> getProcessingDisputes() {
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);
        wrapper.in(Dispute::getDisputeStatus, "mediating", "arbitrating", "reviewing");
        wrapper.orderByDesc(Dispute::getUpdateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public Dispute getDisputeByOrder(Long orderId) {
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getOrderId, orderId);
        wrapper.eq(Dispute::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public List<Dispute> searchDisputes(String disputeNo, String status, Long orderId) {
        LambdaQueryWrapper<Dispute> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Dispute::getDelFlag, 0);

        if (disputeNo != null && !disputeNo.isEmpty()) {
            wrapper.like(Dispute::getDisputeNo, disputeNo);
        }
        if (status != null && !status.isEmpty()) {
            wrapper.eq(Dispute::getDisputeStatus, status);
        }
        if (orderId != null) {
            wrapper.eq(Dispute::getOrderId, orderId);
        }

        wrapper.orderByDesc(Dispute::getCreateTime);
        return baseMapper.selectList(wrapper);
    }
}