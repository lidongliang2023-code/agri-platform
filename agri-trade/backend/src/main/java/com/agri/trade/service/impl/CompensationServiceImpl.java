package com.agri.trade.service.impl;

import com.agri.trade.entity.CompensationRecord;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.Dispute;
import com.agri.trade.mapper.CompensationRecordMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.service.ICompensationService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CompensationServiceImpl extends ServiceImpl<CompensationRecordMapper, CompensationRecord> implements ICompensationService {

    private final TradeOrderMapper orderMapper;
    private final DisputeMapper disputeMapper;

    @Override
    @Transactional
    public CompensationRecord createCompensation(Long orderId, Long disputeId, String compensationType,
                                                 BigDecimal amount, Long applicantId, String applicantName) {
        CompensationRecord compensation = new CompensationRecord();
        compensation.setCompensationNo("CP" + System.currentTimeMillis());
        compensation.setOrderId(orderId);
        compensation.setDisputeId(disputeId);
        compensation.setCompensationType(compensationType);
        compensation.setApplicantId(applicantId);
        compensation.setApplicantName(applicantName);
        compensation.setCompensationAmount(amount);
        compensation.setCompensationStatus("pending");
        compensation.setDelFlag(0);
        compensation.setCreateTime(new Date());
        compensation.setUpdateTime(new Date());

        if (orderId != null) {
            TradeOrder order = orderMapper.selectById(orderId);
            if (order != null) {
                compensation.setOrderNo(order.getOrderNo());
                compensation.setRecipientId(order.getBuyerId());
                compensation.setRecipientName(order.getBuyerName());
            }
        }

        baseMapper.insert(compensation);
        return compensation;
    }

    @Override
    @Transactional
    public CompensationRecord reviewCompensation(Long compensationId, String reviewResult, String reviewer, String remark) {
        CompensationRecord compensation = baseMapper.selectById(compensationId);
        if (compensation == null) {
            return null;
        }

        compensation.setReviewResult(reviewResult);
        compensation.setReviewer(reviewer);
        compensation.setReviewTime(new Date());
        compensation.setReviewRemark(remark);

        if ("approved".equals(reviewResult)) {
            compensation.setCompensationStatus("approved");
        } else if ("rejected".equals(reviewResult)) {
            compensation.setCompensationStatus("rejected");
        }

        compensation.setUpdateTime(new Date());
        baseMapper.updateById(compensation);

        if ("approved".equals(reviewResult)) {
            executeCompensation(compensationId);
        }

        return compensation;
    }

    @Override
    @Transactional
    public boolean executeCompensation(Long compensationId) {
        CompensationRecord compensation = baseMapper.selectById(compensationId);
        if (compensation == null || !"approved".equals(compensation.getCompensationStatus())) {
            return false;
        }

        compensation.setCompensationStatus("paid");
        compensation.setPayTime(new Date());
        compensation.setTransactionId("TX" + UUID.randomUUID().toString().substring(0, 20));
        compensation.setPayChannel("platform");
        compensation.setUpdateTime(new Date());

        baseMapper.updateById(compensation);

        if (compensation.getDisputeId() != null) {
            Dispute dispute = disputeMapper.selectById(compensation.getDisputeId());
            if (dispute != null) {
                dispute.setDisputeStatus("completed");
                disputeMapper.updateById(dispute);
            }
        }

        return true;
    }

    @Override
    public CompensationRecord getByDispute(Long disputeId) {
        LambdaQueryWrapper<CompensationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CompensationRecord::getDisputeId, disputeId);
        wrapper.eq(CompensationRecord::getDelFlag, 0);
        return baseMapper.selectOne(wrapper);
    }

    @Override
    public List<CompensationRecord> getByOrder(Long orderId) {
        LambdaQueryWrapper<CompensationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CompensationRecord::getOrderId, orderId);
        wrapper.eq(CompensationRecord::getDelFlag, 0);
        wrapper.orderByDesc(CompensationRecord::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    public List<CompensationRecord> getByRecipient(Long recipientId) {
        LambdaQueryWrapper<CompensationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(CompensationRecord::getRecipientId, recipientId);
        wrapper.eq(CompensationRecord::getDelFlag, 0);
        wrapper.orderByDesc(CompensationRecord::getCreateTime);
        return baseMapper.selectList(wrapper);
    }
}