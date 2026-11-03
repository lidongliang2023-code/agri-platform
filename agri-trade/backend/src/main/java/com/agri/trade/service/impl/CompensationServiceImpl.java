package com.agri.trade.service.impl;

import com.agri.trade.entity.CompensationRecord;
import com.agri.trade.entity.TradeOrder;
import com.agri.trade.entity.Dispute;
import com.agri.trade.entity.PaymentRecord;
import com.agri.trade.mapper.CompensationRecordMapper;
import com.agri.trade.mapper.TradeOrderMapper;
import com.agri.trade.mapper.DisputeMapper;
import com.agri.trade.mapper.PaymentRecordMapper;
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
    private final PaymentRecordMapper paymentMapper;

    @Override
    @Transactional
    public CompensationRecord createCompensation(Long orderId, Long disputeId, String compensationType,
                                                 BigDecimal amount, Long applicantId, String applicantName) {
        // 金额必须为正：这是要打出去的钱，0 或负数没有业务含义（原先直接落库）
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        // 一单纠纷只赔一次：原先同一个 disputeId 可以反复建单，
        // 每张单都能各自走到"已打款"，等于同一场纠纷赔了多次。
        // 同时要求赔付必须挂在"一场纠纷"或"一笔订单"上 —— 没有来源的赔付单
        // 事后查不到为什么赔、也进不了资金流水（流水要挂订单号）。
        if (disputeId == null && orderId == null) {
            return null;
        }
        Dispute dispute = disputeId == null ? null : disputeMapper.selectById(disputeId);
        if (disputeId != null && dispute == null) {
            return null;
        }
        if (disputeId != null) {
            CompensationRecord exist = getByDispute(disputeId);
            if (exist != null) {
                return exist;
            }
            if (orderId == null) {
                orderId = dispute.getOrderId();
            }
            // 申请人没带就按纠纷的申请人算（运营建单时不必再手抄一遍主体号）
            if (applicantId == null) {
                applicantId = dispute.getComplainantId();
            }
        }
        TradeOrder order = orderId == null ? null : orderMapper.selectById(orderId);
        if (orderId != null && order == null) {
            // 挂了一张不存在的订单：这笔钱事后对不上任何单据
            return null;
        }
        // 申请人只认单据上的参与方（纠纷申请方、订单买方或卖方）。
        // 原先请求体写谁就当谁 —— 赔付单上的申请人是可以凭空填的，
        // 配上"收款方由订单推导"，就能造出一张"某家应得赔付"的单据。
        if (applicantId != null && !isPartyOf(dispute, order, applicantId)) {
            return null;
        }
        // 申请人名称一律由服务端按单据取，不采信调用方传来的字符串。
        if (applicantId != null) {
            applicantName = nameOfParty(order, applicantId,
                    dispute != null && applicantId.equals(dispute.getComplainantId())
                            ? dispute.getComplainantName() : null);
        }

        CompensationRecord compensation = new CompensationRecord();
        compensation.setCompensationNo(nextCompensationNo());
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

        if (order != null) {
            compensation.setOrderNo(order.getOrderNo());
            // 收款方 = 受损方。纠纷里申请人是买方时赔给买方，是卖方时赔给卖方 ——
            // 原先一律写订单买方，卖方申请成立的赔付会被打给买方。
            if (dispute != null && "seller".equals(dispute.getComplainantType())) {
                compensation.setRecipientId(order.getSellerId());
                compensation.setRecipientName(order.getSellerName());
            } else {
                compensation.setRecipientId(order.getBuyerId());
                compensation.setRecipientName(order.getBuyerName());
            }
        }

        baseMapper.insert(compensation);
        return compensation;
    }

    /** 这个主体号是不是这场纠纷或这张订单的参与方。 */
    private static boolean isPartyOf(Dispute dispute, TradeOrder order, Long applicantId) {
        if (applicantId == null) {
            return false;
        }
        if (dispute != null && applicantId.equals(dispute.getComplainantId())) {
            return true;
        }
        return order != null && (applicantId.equals(order.getBuyerId()) || applicantId.equals(order.getSellerId()));
    }

    /** 按主体号回它在单据上的名字；单据上找不到就用纠纷里的那份。 */
    private static String nameOfParty(TradeOrder order, Long applicantId, String fallback) {
        if (order != null) {
            if (applicantId.equals(order.getBuyerId())) {
                return order.getBuyerName();
            }
            if (applicantId.equals(order.getSellerId())) {
                return order.getSellerName();
            }
        }
        return fallback;
    }

    /**
     * 赔付单号：毫秒 + 6 位随机段。
     *
     * <p>{@code comp_no} 上有唯一索引，仲裁自动建单与运营手工建单落在同一毫秒时，
     * 纯毫秒的编号会撞索引（一边报"建单失败"，另一边其实什么都没写）。</p>
     */
    private static String nextCompensationNo() {
        return "CP" + System.currentTimeMillis()
                + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    @Override
    @Transactional
    public CompensationRecord reviewCompensation(Long compensationId, String reviewResult, String reviewer, String remark) {
        CompensationRecord compensation = baseMapper.selectById(compensationId);
        if (compensation == null) {
            return null;
        }
        // 只有"待审核"的单据能审：原先任何状态都能再审 ——
        // 已经打款的单再点一次"驳回"，状态会从 paid 翻回 rejected，而钱早就出去了；
        // 反过来已驳回的单也能被改成通过。一张单据只能被审一次。
        if (!"pending".equals(compensation.getCompensationStatus())) {
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

        // 资金流水：赔付打款要进支付流水表，否则这块钱在账上没有任何痕迹
        // （原先只写了赔付单自己的 transaction_id，对账时查不到这笔出款）。
        // payment_type = compensation 是这条记录与"订单收款"的区分标记 ——
        // 风控的发货超时规则按最新一条已付流水算"钱什么时候到的"，
        // 赔付出款不能被当成买家付款时间（那边也已按 payment_type 排除）。
        if (compensation.getOrderId() != null) {
            PaymentRecord payout = new PaymentRecord();
            payout.setPaymentNo("PY" + System.currentTimeMillis());
            payout.setOrderId(compensation.getOrderId());
            payout.setOrderNo(compensation.getOrderNo());
            // 出款方是平台，收款方是受损方
            payout.setPayerName("平台");
            payout.setPayeeId(compensation.getRecipientId());
            payout.setPayeeName(compensation.getRecipientName());
            payout.setPaymentType("compensation");
            payout.setAmount(compensation.getCompensationAmount());
            payout.setActualAmount(compensation.getCompensationAmount());
            payout.setPaymentMethod("platform");
            payout.setPaymentChannel("platform");
            payout.setTransactionId(compensation.getTransactionId());
            payout.setPaymentStatus("paid");
            payout.setPaymentTime(compensation.getPayTime());
            payout.setDelFlag(0);
            payout.setCreateTime(new Date());
            payout.setUpdateTime(new Date());
            paymentMapper.insert(payout);
        }

        if (compensation.getDisputeId() != null) {
            Dispute dispute = disputeMapper.selectById(compensation.getDisputeId());
            if (dispute != null) {
                // 纠纷状态词表里没有 completed —— 那个值前端两个页面都认不出来，
                // 会直接显示英文原文，而且"未结"与"已解决"两个筛选也都不认它，
                // 赔完款的纠纷反而从两个列表里同时消失。赔付完成就是已解决。
                dispute.setDisputeStatus("resolved");
                // 赔了多少、什么时候赔的，记在纠纷单上（表里就有这两列，原先从没写过），
                // 否则运营回看纠纷时看不到"最后赔了多少"。
                dispute.setCompensationAmount(compensation.getCompensationAmount());
                dispute.setCompensationTime(compensation.getPayTime());
                dispute.setUpdateTime(new Date());
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

    @Override
    public List<CompensationRecord> getByRecipients(java.util.Collection<Long> recipientIds) {
        if (recipientIds == null || recipientIds.isEmpty()) {
            return List.of();
        }
        LambdaQueryWrapper<CompensationRecord> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(CompensationRecord::getRecipientId, recipientIds);
        wrapper.eq(CompensationRecord::getDelFlag, 0);
        wrapper.orderByDesc(CompensationRecord::getCreateTime);
        return baseMapper.selectList(wrapper);
    }
}
