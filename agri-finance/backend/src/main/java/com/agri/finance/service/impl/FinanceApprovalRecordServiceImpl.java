package com.agri.finance.service.impl;

import com.agri.finance.entity.FinanceApprovalRecord;
import com.agri.finance.mapper.FinanceApprovalRecordMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class FinanceApprovalRecordServiceImpl
        extends ServiceImpl<FinanceApprovalRecordMapper, FinanceApprovalRecord> {

    public FinanceApprovalRecord create(FinanceApprovalRecord record) {
        record.setCreatedAt(LocalDateTime.now());
        save(record);
        return record;
    }

    public List<FinanceApprovalRecord> listByProvider(String providerId) {
        return lambdaQuery()
                .eq(FinanceApprovalRecord::getProviderId, providerId)
                .orderByDesc(FinanceApprovalRecord::getCreatedAt)
                .list();
    }

    public FinanceApprovalRecord findByApplication(String applicationId, String providerId) {
        return lambdaQuery()
                .eq(FinanceApprovalRecord::getApplicationId, applicationId)
                .eq(FinanceApprovalRecord::getProviderId, providerId)
                .last("LIMIT 1")
                .one();
    }
}
