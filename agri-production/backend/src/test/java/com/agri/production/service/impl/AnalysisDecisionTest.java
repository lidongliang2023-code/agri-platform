package com.agri.production.service.impl;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.controller.AiNotAvailableController;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.agri.production.service.IotDeviceStatsService;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;

class AnalysisDecisionTest {
    HarvestBatchMapper harvest = mock(HarvestBatchMapper.class);
    TaskMapper tasks = mock(TaskMapper.class);
    ProductionReportMapper reports = mock(ProductionReportMapper.class);
    ReportAnalyticsServiceImpl service = new ReportAnalyticsServiceImpl(harvest, tasks,
        mock(InspectionMapper.class), mock(InputUsageRecordMapper.class), mock(AlertRecordMapper.class),
        mock(IoTDeviceMapper.class), mock(IotDeviceStatsService.class), mock(TraceCodeMapper.class),
        mock(PlotMapper.class), mock(FarmMapper.class), mock(PlantingPlanMapper.class), reports,
        mock(ReportSubscriptionMapper.class));
    HarvestBatch batch(String unit, String qty) {
        HarvestBatch b = new HarvestBatch(); b.setUnit(unit); b.setQuantity(new BigDecimal(qty));
        b.setCropName("番茄"); b.setHarvestDate(LocalDate.of(2026,11,5)); return b;
    }
    @Test void convertsWeights() {
        assertEquals(0, new BigDecimal("1000").compareTo(ReportAnalyticsServiceImpl.weightKg(batch("吨","1"))));
        assertEquals(0, new BigDecimal("5").compareTo(ReportAnalyticsServiceImpl.weightKg(batch("斤","10"))));
        assertThrows(BusinessException.class, () -> ReportAnalyticsServiceImpl.weightKg(batch("箱","2")));
    }
    @Test void trendAggregatesConvertedWeights() {
        when(harvest.selectList(any())).thenReturn(List.of(batch("kg","10"), batch("吨","1")));
        var result = service.trend("2001", 1L, "YIELD", "2026-11-01", "2026-11-05");
        assertEquals(1, result.size()); assertEquals(0, new BigDecimal("1010").compareTo(result.get(0).getMetricValue()));
    }
    @Test void rejectsReversedRangeBeforeReadingData() {
        assertThrows(BusinessException.class, () -> service.dimension("2001",1L,"crop","2026-11-05","2026-11-01"));
        verifyNoInteractions(harvest,tasks);
    }
    @Test void onlyAcceptedTasksCountAsCompleted() {
        when(harvest.selectList(any())).thenReturn(List.of());
        Task pending = new Task(); pending.setCropName("番茄"); pending.setStatus("completed"); pending.setAcceptStatus(0);
        Task accepted = new Task(); accepted.setCropName("番茄"); accepted.setStatus("completed"); accepted.setAcceptStatus(1);
        when(tasks.selectList(any())).thenReturn(List.of(pending,accepted));
        var result=service.dimension("2001",1L,"crop","2026-11-01","2026-11-05");
        assertEquals(2,result.get(0).getTaskCount()); assertEquals(1,result.get(0).getDoneCount());
    }
    @Test void mixedUnknownUnitCannotGenerateSnapshot() {
        when(harvest.selectList(any())).thenReturn(List.of(batch("箱","2")));
        assertThrows(BusinessException.class, () -> service.generate("2001",1L,1,"2026-11-05","user1"));
        verify(reports,never()).insert(any(ProductionReport.class));
    }
    @Test void legacyFakeEndpointsAreUnavailable() {
        assertThrows(BusinessException.class, () -> new AiNotAvailableController().legacyCapabilities());
    }
}
