package com.agri.trade.service.impl;

import com.agri.trade.entity.MerchantGuarantee;
import com.agri.trade.entity.CompensationRecord;
import com.agri.trade.mapper.MerchantGuaranteeMapper;
import com.agri.trade.mapper.CompensationRecordMapper;
import com.agri.trade.mapper.GuaranteeLogMapper;
import com.agri.trade.entity.GuaranteeLog;
import com.agri.trade.service.IGuaranteeService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GuaranteeServiceImpl extends ServiceImpl<MerchantGuaranteeMapper, MerchantGuarantee> implements IGuaranteeService {

    private final CompensationRecordMapper compensationRecordMapper;
    private final GuaranteeLogMapper guaranteeLogMapper;

    @Override
    @Transactional
    public MerchantGuarantee createGuarantee(Long merchantId, String merchantName, BigDecimal amount) {
        MerchantGuarantee guarantee = new MerchantGuarantee();
        guarantee.setGuaranteeNo("GT" + System.currentTimeMillis());
        guarantee.setMerchantId(merchantId);
        guarantee.setMerchantName(merchantName);
        guarantee.setGuaranteeType("cash");
        guarantee.setTotalAmount(amount);
        guarantee.setAvailableAmount(amount);
        guarantee.setFrozenAmount(BigDecimal.ZERO);
        guarantee.setUsedAmount(BigDecimal.ZERO);
        guarantee.setGuaranteeStatus("active");
        guarantee.setApplyTime(new Date());
        guarantee.setVerifyTime(new Date());
        guarantee.setExpireTime(new Date(System.currentTimeMillis() + 365 * 24 * 60 * 60 * 1000L));
        guarantee.setDelFlag(0);
        guarantee.setCreateTime(new Date());
        guarantee.setUpdateTime(new Date());

        baseMapper.insert(guarantee);
        return guarantee;
    }

    @Override
    @Transactional
    public boolean freezeGuarantee(Long guaranteeId, BigDecimal amount) {
        return freezeGuarantee(guaranteeId, amount, null, null);
    }

    @Override
    @Transactional
    public boolean freezeGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason) {
        MerchantGuarantee guarantee = baseMapper.selectById(guaranteeId);
        if (guarantee == null) {
            return false;
        }

        if (guarantee.getAvailableAmount().compareTo(amount) < 0) {
            return false;
        }

        BigDecimal availableBefore = guarantee.getAvailableAmount();
        BigDecimal frozenBefore = guarantee.getFrozenAmount();
        guarantee.setAvailableAmount(guarantee.getAvailableAmount().subtract(amount));
        guarantee.setFrozenAmount(guarantee.getFrozenAmount().add(amount));
        guarantee.setUpdateTime(new Date());
        baseMapper.updateById(guarantee);
        writeLog(guarantee, "freeze", amount, availableBefore, guarantee.getAvailableAmount(),
                frozenBefore, guarantee.getFrozenAmount(), operator, reason);
        return true;
    }

    @Override
    @Transactional
    public boolean unfreezeGuarantee(Long guaranteeId, BigDecimal amount) {
        return unfreezeGuarantee(guaranteeId, amount, null, null);
    }

    @Override
    @Transactional
    public boolean unfreezeGuarantee(Long guaranteeId, BigDecimal amount, String operator, String reason) {
        MerchantGuarantee guarantee = baseMapper.selectById(guaranteeId);
        if (guarantee == null) {
            return false;
        }

        if (guarantee.getFrozenAmount().compareTo(amount) < 0) {
            return false;
        }

        BigDecimal availableBefore = guarantee.getAvailableAmount();
        BigDecimal frozenBefore = guarantee.getFrozenAmount();
        guarantee.setFrozenAmount(guarantee.getFrozenAmount().subtract(amount));
        guarantee.setAvailableAmount(guarantee.getAvailableAmount().add(amount));
        guarantee.setUpdateTime(new Date());
        baseMapper.updateById(guarantee);
        writeLog(guarantee, "unfreeze", amount, availableBefore, guarantee.getAvailableAmount(),
                frozenBefore, guarantee.getFrozenAmount(), operator, reason);
        return true;
    }

    @Override
    @Transactional
    public boolean deductGuarantee(Long guaranteeId, BigDecimal amount) {
        MerchantGuarantee guarantee = baseMapper.selectById(guaranteeId);
        if (guarantee == null) {
            return false;
        }

        if (guarantee.getAvailableAmount().compareTo(amount) < 0) {
            return false;
        }

        guarantee.setAvailableAmount(guarantee.getAvailableAmount().subtract(amount));
        guarantee.setUsedAmount(guarantee.getUsedAmount().add(amount));
        guarantee.setUpdateTime(new Date());
        baseMapper.updateById(guarantee);
        return true;
    }

    @Override
    @Transactional
    public boolean replenishGuarantee(Long guaranteeId, BigDecimal amount) {
        MerchantGuarantee guarantee = baseMapper.selectById(guaranteeId);
        if (guarantee == null) {
            return false;
        }

        guarantee.setTotalAmount(guarantee.getTotalAmount().add(amount));
        guarantee.setAvailableAmount(guarantee.getAvailableAmount().add(amount));
        guarantee.setUpdateTime(new Date());
        baseMapper.updateById(guarantee);
        return true;
    }

    @Override
    public BigDecimal getAvailableBalance(Long merchantId) {
        LambdaQueryWrapper<MerchantGuarantee> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MerchantGuarantee::getMerchantId, merchantId);
        wrapper.eq(MerchantGuarantee::getDelFlag, 0);
        wrapper.eq(MerchantGuarantee::getGuaranteeStatus, "active");

        MerchantGuarantee guarantee = baseMapper.selectOne(wrapper);
        return guarantee != null ? guarantee.getAvailableAmount() : BigDecimal.ZERO;
    }

    @Override
    public List<GuaranteeLog> getLogs(Long guaranteeId) {
        return guaranteeLogMapper.selectList(new LambdaQueryWrapper<GuaranteeLog>()
                .eq(GuaranteeLog::getGuaranteeId, guaranteeId)
                .eq(GuaranteeLog::getDelFlag, 0)
                .orderByDesc(GuaranteeLog::getId));
    }

    /** 记一条流水：动作、金额、动作前后的可用/冻结额、操作人、原因。 */
    private void writeLog(MerchantGuarantee guarantee, String action, BigDecimal amount,
                          BigDecimal availableBefore, BigDecimal availableAfter,
                          BigDecimal frozenBefore, BigDecimal frozenAfter,
                          String operator, String reason) {
        GuaranteeLog log = new GuaranteeLog();
        log.setGuaranteeId(guarantee.getId());
        log.setGuaranteeNo(guarantee.getGuaranteeNo());
        log.setMerchantId(guarantee.getMerchantId());
        log.setMerchantName(guarantee.getMerchantName());
        log.setAction(action);
        log.setAmount(amount);
        log.setAvailableBefore(availableBefore);
        log.setAvailableAfter(availableAfter);
        log.setFrozenBefore(frozenBefore);
        log.setFrozenAfter(frozenAfter);
        log.setOperator(operator);
        log.setReason(reason);
        log.setDelFlag(0);
        log.setCreateTime(new Date());
        guaranteeLogMapper.insert(log);
    }

    @Override
    public List<MerchantGuarantee> getGuaranteesByMerchant(Long merchantId) {
        LambdaQueryWrapper<MerchantGuarantee> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(MerchantGuarantee::getMerchantId, merchantId);
        wrapper.eq(MerchantGuarantee::getDelFlag, 0);
        wrapper.orderByDesc(MerchantGuarantee::getCreateTime);
        return baseMapper.selectList(wrapper);
    }

    @Override
    @Transactional
    public boolean transferToCompensation(Long guaranteeId, Long disputeId, BigDecimal amount) {
        if (!freezeGuarantee(guaranteeId, amount)) {
            return false;
        }

        CompensationRecord compensation = new CompensationRecord();
        compensation.setCompensationNo("CP" + System.currentTimeMillis());
        compensation.setDisputeId(disputeId);
        compensation.setCompensationType("guarantee");
        compensation.setCompensationAmount(amount);
        compensation.setCompensationStatus("pending");
        compensation.setDelFlag(0);
        compensation.setCreateTime(new Date());
        compensation.setUpdateTime(new Date());

        compensationRecordMapper.insert(compensation);
        return true;
    }
}
