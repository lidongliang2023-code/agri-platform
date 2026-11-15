package com.agri.production.service;

import com.agri.production.controller.admin.AdminDashboardController;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.Farm;
import com.agri.production.entity.Plot;
import com.agri.production.entity.Task;
import com.agri.production.integration.IotDeviceClient;
import com.agri.production.mapper.*;
import com.agri.production.service.impl.AdminDashboardServiceImpl;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class AdminDashboardContractTest {
    final FarmMapper farms = mock(FarmMapper.class);
    final PlotMapper plots = mock(PlotMapper.class);
    final TaskMapper tasks = mock(TaskMapper.class);
    final AlertRecordMapper alerts = mock(AlertRecordMapper.class);
    final IotDeviceClient iot = mock(IotDeviceClient.class);
    final AdminDashboardServiceImpl service = new AdminDashboardServiceImpl(farms, plots, tasks,
            mock(HarvestBatchMapper.class), alerts, iot);

    private Task task(String status, Integer accepted) {
        Task t = new Task(); t.setStatus(status); t.setAcceptStatus(accepted); return t;
    }
    private AlertRecord alert(String state, String level) {
        AlertRecord a = new AlertRecord(); a.setStatus(state); a.setLevel(level); return a;
    }
    private void base() {
        when(farms.selectCount(any())).thenReturn(27L);
        when(plots.selectCount(any())).thenReturn(40L);
        when(tasks.selectList(any())).thenReturn(List.of(task("pending", 0), task("completed", 0),
                task("completed", 1), task("cancelled", 0), task("canceled", 0)));
        when(alerts.selectList(any())).thenReturn(List.of(alert("PENDING", "URGENT"),
                alert("processing", "critical"), alert("handled", "urgent"), alert("ignored", "warn")));
    }
    @Test void metricsUseAcceptanceAndNeverInventUnavailableDeviceCounts() {
        base();
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            Map<String,Object> result = service.metrics();
            assertEquals(27L, result.get("farmCount"));
            assertEquals(2L, result.get("taskPending"));
            assertEquals(2L, result.get("alertPending"));
            assertNull(result.get("deviceOnline"));
            assertEquals("UNAVAILABLE", result.get("deviceStatsStatus"));
            assertNotNull(result.get("dataAsOf"));
            verifyNoInteractions(iot);
        }
    }
    @Test void operatorDeviceStatsUseCallerAuthorizationAndLiveMetrics() {
        base();
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            identity.when(TenantContextService::currentAuthorization).thenReturn("Bearer test");
            when(iot.operatorDeviceStats("Bearer test")).thenReturn(Map.of("devices", 31, "online", 18));
            Map<String,Object> result = service.metrics();
            assertEquals("LIVE", result.get("deviceStatsStatus"));
            assertEquals(18, result.get("deviceOnline"));
            assertEquals(31, result.get("deviceTotal"));
        }
    }
    @Test void deviceOutagePreservesProductionMetrics() {
        base();
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            identity.when(TenantContextService::currentAuthorization).thenReturn("Bearer test");
            when(iot.operatorDeviceStats(any())).thenThrow(new IllegalArgumentException("unavailable"));
            Map<String,Object> result = service.metrics();
            assertEquals(27L, result.get("farmCount"));
            assertEquals("UNAVAILABLE", result.get("deviceStatsStatus"));
            assertNull(result.get("deviceOnline"));
        }
    }
    @Test void alertDistributionNormalizesLevelsAndExcludesTerminalRecords() {
        when(alerts.selectList(any())).thenReturn(List.of(alert("PENDING", "URGENT"),
                alert("processing", "CRITICAL"), alert("unhandled", "warn"),
                alert(null, "unknown"), alert("closed", "URGENT"), alert("ignored", "critical")));
        assertEquals(Map.of("urgent", 1, "important", 1, "normal", 1, "info", 1), service.alertTrend());
    }
    @Test void rankUsesPlotAreaRatherThanFarmRegisteredArea() {
        Farm a = new Farm(); a.setId(1L); a.setFarmName("A"); a.setTotalArea(new BigDecimal("9999"));
        Farm b = new Farm(); b.setId(2L); b.setFarmName("B"); b.setTotalArea(BigDecimal.ONE);
        Plot pa = new Plot(); pa.setFarmId(1L); pa.setArea(new BigDecimal("10"));
        Plot pb = new Plot(); pb.setFarmId(2L); pb.setArea(new BigDecimal("30"));
        when(farms.selectList(any())).thenReturn(List.of(a,b));
        when(plots.selectList(any())).thenReturn(List.of(pa,pb));
        assertEquals("B", service.rank(1).get(0).get("farmName"));
        assertEquals(new BigDecimal("30"), service.rank(1).get(0).get("areaTotal"));
    }
    @Test void trendCountsAcceptedTasksAndDeduplicatesWorkersById() {
        LocalDate day = LocalDate.of(2026,11,14);
        Task a = task("completed",1); a.setPlanStartTime(day.atTime(9,0)); a.setExecutorId(1L); a.setExecutorName("同名");
        Task b = task("completed",0); b.setPlanStartTime(day.atTime(10,0)); b.setExecutorId(2L); b.setExecutorName("同名");
        Task c = task("pending",0); c.setPlanStartTime(day.atTime(11,0)); c.setExecutorId(1L); c.setExecutorName("改名");
        when(tasks.selectList(any())).thenReturn(List.of(a,b,c));
        when(alerts.selectList(any())).thenReturn(List.of());
        Map<String,Object> point = service.trend("2026-11-14","2026-11-14").get(0);
        assertEquals(33,point.get("taskRate")); assertEquals(2L,point.get("activeWorkers"));
    }
    @Test void rootDashboardEndpointReturnsExpectedContract() throws Exception {
        IAdminDashboardService backend = mock(IAdminDashboardService.class);
        when(backend.metrics()).thenReturn(Map.of("farmCount",27,"taskPending",5,"alertPending",4));
        MockMvcBuilders.standaloneSetup(new AdminDashboardController(backend),
                new com.agri.production.controller.admin.ProductionAdminController(farms, tasks,
                        mock(TraceCodeMapper.class), mock(HarvestMapper.class), mock(InputMaterialMapper.class),
                        alerts, mock(IoTDeviceMapper.class), mock(InspectionMapper.class),
                        mock(FarmIdResolver.class), mock(IotDeviceStatsService.class), iot)).build()
                .perform(get("/api/v1/production/admin/dashboard"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.code").value(0))
                .andExpect(jsonPath("$.data.taskPending").value(5));
    }
    @Test void listAndDistributionShareLevelDictionaryIncludingNumericLegacyValues() {
        for (String level : List.of("CRITICAL", "important", "URGENT", "4", "3", "normal", "INFO")) {
            assertEquals(com.agri.production.common.constant.AlertDict.codeOfLevel(level),
                    com.agri.production.vo.AdminAlertReviewVO.toLevel(level));
        }
        assertEquals(4, com.agri.production.common.constant.AlertDict.codeOfLevel("4"));
        assertEquals(3, com.agri.production.vo.AdminAlertReviewVO.toLevel("critical"));
    }

}
