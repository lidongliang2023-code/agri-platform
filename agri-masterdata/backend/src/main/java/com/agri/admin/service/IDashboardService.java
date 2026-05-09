package com.agri.admin.service;

import com.agri.admin.vo.DashboardVO;
import com.agri.admin.vo.HealthDashboardVO;
import com.agri.admin.vo.TenantActivityVO;

import java.util.List;

public interface IDashboardService {

    DashboardVO getDashboard(String timeRange);

    HealthDashboardVO getHealthDashboard();

    List<TenantActivityVO> getTenantActivity(Integer limit);

    List<DashboardVO.AlertItem> getAlerts(Integer limit);

    DashboardVO.PendingAudit getPendingAudit();
}