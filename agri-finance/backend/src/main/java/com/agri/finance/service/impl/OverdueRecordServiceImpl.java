package com.agri.finance.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.mapper.OverdueRecordMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Service
public class OverdueRecordServiceImpl extends ServiceImpl<OverdueRecordMapper, OverdueRecord> {

    private final MessageNotificationServiceImpl messageService;

    public OverdueRecordServiceImpl(MessageNotificationServiceImpl messageService) {
        this.messageService = messageService;
    }

    public OverdueRecord createOverdue(OverdueRecord record) {
        record.setOverdueNo("OD" + System.currentTimeMillis());
        record.setStatus("待分配");
        record.setOverdueDate(LocalDateTime.now());
        record.setCreatedAt(LocalDateTime.now());
        record.setUpdatedAt(LocalDateTime.now());
        record.setDelFlag(0);
        save(record);
        return record;
    }

    /** 同一期账单只应有一条未关闭的台账（重复扫描要累加天数，而不是再开一条）。 */
    public OverdueRecord findOpenByPeriod(String loanId, Integer period) {
        return getOne(new LambdaQueryWrapper<OverdueRecord>()
                .eq(OverdueRecord::getLoanId, loanId)
                .eq(OverdueRecord::getPeriod, period)
                .eq(OverdueRecord::getDelFlag, 0)
                .ne(OverdueRecord::getStatus, "已结清")
                .last("LIMIT 1"));
    }

    @Transactional
    public OverdueRecord registerOverdue(String loanId, String loanNo, String userId, String userName,
                                         String productType, BigDecimal principal, BigDecimal interest,
                                         int days, int period) {
        BigDecimal amount = principal.add(interest).setScale(2, java.math.RoundingMode.HALF_UP);
        OverdueRecord open = findOpenByPeriod(loanId, period);
        if (open != null) {
            open.setOverdueDays(days);
            open.setOverdueStage(stageOf(days));
            open.setOverduePrincipal(principal);
            open.setOverdueInterest(interest);
            open.setOverdueAmount(amount);
            open.setUpdatedAt(LocalDateTime.now());
            updateById(open);
            return open;
        }
        OverdueRecord record = new OverdueRecord();
        record.setLoanId(loanId);
        record.setLoanNo(loanNo);
        record.setUserId(userId);
        record.setUserName(userName);
        record.setProductType(productType);
        record.setOverduePrincipal(principal);
        record.setOverdueInterest(interest);
        record.setOverdueAmount(amount);
        record.setOverdueDays(days);
        record.setPeriod(period);
        record.setOverdueStage(stageOf(days));
        record.setOverdueReason("第" + period + "期账单到期未还，系统自动登记");
        OverdueRecord saved = createOverdue(record);
        messageService.notify(userId, "OVERDUE", "第" + period + "期已逾期",
                "借款 " + loanNo + " 第" + period + "期应还 " + amount
                        + " 元已逾期 " + days + " 天（" + saved.getOverdueStage() + "），请尽快还款，逾期将影响授信评分。",
                "OVERDUE_RECORD", saved.getId(), "HIGH");
        return saved;
    }

    @Transactional
    public OverdueRecord assignCollector(String id, String collectorId, String collectorName) {
        OverdueRecord record = getById(id);
        if (record == null || Integer.valueOf(1).equals(record.getDelFlag())) {
            throw new BusinessException(404, "逾期记录不存在");
        }
        if ("已结清".equals(record.getStatus())) {
            throw new BusinessException(409, "该逾期台账已结清，无需再分配催收");
        }
        if (collectorId == null || collectorId.isBlank()) {
            throw new BusinessException(400, "请指定催收人员");
        }
        record.setCollectorId(collectorId);
        record.setCollectorName(collectorName == null || collectorName.isBlank() ? collectorId : collectorName);
        record.setStatus("催收中");
        record.setUpdatedAt(LocalDateTime.now());
        updateById(record);
        messageService.notify(record.getUserId(), "OVERDUE", "逾期台账已分配催收",
                "逾期台账 " + record.getOverdueNo() + " 已由 " + record.getCollectorName()
                        + " 跟进，请保持联系方式畅通。", "OVERDUE_RECORD", record.getId(), "MEDIUM");
        return record;
    }

    @Transactional
    public OverdueRecord markPaid(String id) {
        OverdueRecord record = getById(id);
        if (record == null || Integer.valueOf(1).equals(record.getDelFlag())) {
            throw new BusinessException(404, "逾期记录不存在");
        }
        if ("已结清".equals(record.getStatus())) {
            return record;
        }
        record.setStatus("已结清");
        record.setUpdatedAt(LocalDateTime.now());
        updateById(record);
        messageService.notify(record.getUserId(), "OVERDUE", "逾期台账已结清",
                "逾期台账 " + record.getOverdueNo() + " 已结清，授信评分将按新的履约情况重算。",
                "OVERDUE_RECORD", record.getId(), "MEDIUM");
        return record;
    }

    private String stageOf(int days) {
        if (days <= 7) {
            return "早期";
        }
        if (days <= 30) {
            return "中期";
        }
        return "严重";
    }
}
