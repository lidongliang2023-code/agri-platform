package com.agri.finance.service.impl;

import com.agri.finance.entity.PledgeMonitor;
import com.agri.finance.mapper.PledgeMonitorMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class PledgeMonitorServiceImpl extends ServiceImpl<PledgeMonitorMapper, PledgeMonitor> {

    public PledgeMonitor addMonitor(PledgeMonitor monitor) {
        monitor.setMonitorTime(LocalDateTime.now());
        monitor.setCreatedAt(LocalDateTime.now());
        monitor.setDelFlag(0);
        save(monitor);
        return monitor;
    }

    public List<PledgeMonitor> getMonitorByReceipt(String receiptId) {
        LambdaQueryWrapper<PledgeMonitor> query = new LambdaQueryWrapper<>();
        query.eq(PledgeMonitor::getReceiptId, receiptId)
             .eq(PledgeMonitor::getDelFlag, 0)
             .orderByDesc(PledgeMonitor::getMonitorTime);
        return list(query);
    }

    public PledgeMonitor getLatestMonitor(String receiptId) {
        LambdaQueryWrapper<PledgeMonitor> query = new LambdaQueryWrapper<>();
        query.eq(PledgeMonitor::getReceiptId, receiptId)
             .eq(PledgeMonitor::getDelFlag, 0)
             .orderByDesc(PledgeMonitor::getMonitorTime)
             .last("LIMIT 1");
        return getOne(query);
    }

    public List<PledgeMonitor> getAlertMonitors() {
        LambdaQueryWrapper<PledgeMonitor> query = new LambdaQueryWrapper<>();
        query.ne(PledgeMonitor::getAlertLevel, "无")
             .eq(PledgeMonitor::getDelFlag, 0)
             .orderByDesc(PledgeMonitor::getMonitorTime);
        return list(query);
    }

    public void updateAlert(String monitorId, String alertLevel, String alertContent) {
        PledgeMonitor monitor = getById(monitorId);
        if (monitor != null) {
            monitor.setAlertLevel(alertLevel);
            monitor.setAlertContent(alertContent);
            monitor.setUpdatedAt(LocalDateTime.now());
            updateById(monitor);
        }
    }
}