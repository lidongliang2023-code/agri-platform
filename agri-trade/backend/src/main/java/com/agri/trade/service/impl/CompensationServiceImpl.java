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

        // 这里原先在核准通过后**直接调用 executeCompensation 打款** ——
        // 也就是"审批"与"付款"两个动作被合成了一次调用：
        //   · 审核接口返回时单据已是 paid 并带上了打款流水号，界面上再点"打款"必然报"执行失败"
        //     （那时状态已不是 approved，守卫直接返回 false），而钱其实早就出去了；
        //   · 财务口径上审批与付款本就应该分开 —— 审批是"该不该赔"，付款是"钱出没出"，
        //     合成一步之后，出了争议也说不清是哪一环的问题。
        // 现在拆开：核准只置 approved（待打款），打款走独立的 execute 接口。
        // 大盘待办里的"已核准待打款"这一项，正是等这个动作来清。
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
