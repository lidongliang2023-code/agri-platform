package com.agri.finance.service.impl;

import com.agri.finance.entity.OverdueRecord;
import com.agri.finance.mapper.OverdueRecordMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class OverdueRecordServiceImpl extends ServiceImpl<OverdueRecordMapper, OverdueRecord> {

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

    public OverdueRecord assignCollector(String id, String collectorId, String collectorName) {
        OverdueRecord record = getById(id);
        if (record != null) {
            record.setCollectorId(collectorId);
            record.setCollectorName(collectorName);
            record.setStatus("催收中");
            record.setUpdatedAt(LocalDateTime.now());
            updateById(record);
        }
        return record;
    }

    public OverdueRecord markPaid(String id) {
        OverdueRecord record = getById(id);
        if (record != null) {
            record.setStatus("已还款");
            record.setUpdatedAt(LocalDateTime.now());
            updateById(record);
        }
        return record;
    }
}