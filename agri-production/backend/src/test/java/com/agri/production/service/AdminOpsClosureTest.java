package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.Farm;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.Plot;
import com.agri.production.entity.ReportTask;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.EmergencyPlanMapper;
import com.agri.production.mapper.FarmComplianceCheckMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.ReportTaskMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.impl.AdminAlertServiceImpl;
import com.agri.production.service.impl.AdminReportServiceImpl;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AdminOpsClosureTest {

    private AdminAlertServiceImpl alerts(AlertRecordMapper mapper) {
        return new AdminAlertServiceImpl(mapper, mock(EmergencyPlanMapper.class), mock(PlotMapper.class));
    }

    private AdminReportServiceImpl reports(ReportTaskMapper reportTaskMapper,
                                          FarmMapper farmMapper,
                                          PlotMapper plotMapper,
                                          TaskMapper taskMapper,
                                          HarvestBatchMapper harvestBatchMapper,
                                          InspectionMapper inspectionMapper,
                                          AlertRecordMapper alertRecordMapper) {
        return new AdminReportServiceImpl(
                reportTaskMapper,
                mock(FarmComplianceCheckMapper.class),
                farmMapper,
                plotMapper,
                taskMapper,
                harvestBatchMapper,
                inspectionMapper,
                alertRecordMapper
        );
    }

    @Test
    void pendingMustBecomeHandlingAndKeepEvidence() {
        AlertRecordMapper mapper = mock(AlertRecordMapper.class);
        AlertRecord row = new AlertRecord();
        row.setId(1L);
        row.setStatus("pending");
        row.setHandleResult("原始事实");
        when(mapper.lockForHandling(1L)).thenReturn(row);
        when(mapper.updateById(any(AlertRecord.class))).thenReturn(1);
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            identity.when(TenantContextService::currentUserId).thenReturn("42");
            identity.when(TenantContextService::currentOperator).thenReturn("真实运营 · 42");
            alerts(mapper).closeAlert(1L, "伪造操作人", "开始核查");
            assertEquals("handling", row.getStatus());
            assertEquals("真实运营 · 42", row.getHandleUser());
            assertTrue(row.getHandleResult().startsWith("原始事实\n"));
            verify(mapper).updateById(row);
        }
    }

    @Test
    void handlingCanCompleteButTerminalCannotBeRewritten() {
        AlertRecordMapper mapper = mock(AlertRecordMapper.class);
        AlertRecord row = new AlertRecord();
        row.setId(2L);
        row.setStatus("handling");
        when(mapper.lockForHandling(2L)).thenReturn(row);
        when(mapper.updateById(any(AlertRecord.class))).thenReturn(1);
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            identity.when(TenantContextService::currentUserId).thenReturn("42");
            identity.when(TenantContextService::currentOperator).thenReturn("运营42");
            AdminAlertServiceImpl service = alerts(mapper);
            service.closeAlert(2L, null, "现场核验完成");
            assertEquals("handled", row.getStatus());
            assertThrows(BusinessException.class, () -> service.closeAlert(2L, null, "再次改写"));
            verify(mapper, times(1)).updateById(row);
        }
    }

    @Test
    void reviewCannotOverwriteOriginalResult() {
        AlertRecordMapper mapper = mock(AlertRecordMapper.class);
        assertThrows(BusinessException.class, () -> alerts(mapper).updateReview(1L, Map.of("handleProcess", "覆盖原记录")));
        verify(mapper, never()).updateById(any(AlertRecord.class));
    }

    @Test
    void missingActorAndEmptyRemarkFailWithoutWrites() {
        AlertRecordMapper mapper = mock(AlertRecordMapper.class);
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            assertThrows(BusinessException.class, () -> alerts(mapper).closeAlert(1L, "假名字", "处置"));
            assertThrows(BusinessException.class, () -> alerts(mapper).closeAlert(1L, "假名字", " "));
            verify(mapper, never()).updateById(any(AlertRecord.class));
        }
    }

    @Test
    void reportPersistsTrustedCreatorAndCanReadBack() {
        ReportTaskMapper mapper = mock(ReportTaskMapper.class);
        AdminReportServiceImpl service = reports(mapper, mock(FarmMapper.class), mock(PlotMapper.class), mock(TaskMapper.class), mock(HarvestBatchMapper.class), mock(InspectionMapper.class), mock(AlertRecordMapper.class));
        final ReportTask[] stored = new ReportTask[1];
        when(mapper.insert(any(ReportTask.class))).thenAnswer(i -> {
            stored[0] = i.getArgument(0);
            return 1;
        });
        when(mapper.selectOne(any())).thenAnswer(i -> stored[0]);
        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            identity.when(TenantContextService::currentUserId).thenReturn("42");
            identity.when(TenantContextService::currentTenantId).thenReturn("3002");
            String code = service.createReport(Map.of("reportName", "质量月报", "reportType", "QUALITY", "bizDateFrom", "2026-11-01", "bizDateTo", "2026-11-05", "generatorId", "伪造人"));
            ReportTask result = service.getReport(code);
            assertEquals("42", result.getGeneratorId());
            assertEquals("3002", result.getTenantId());
            assertEquals("PENDING", result.getStatus());
            assertNull(result.getFileUrl());
            assertEquals(code, result.getReportCode());
        }
    }

    @Test
    void invalidReportDatesNeverPersist() {
        ReportTaskMapper mapper = mock(ReportTaskMapper.class);
        AdminReportServiceImpl service = reports(mapper, mock(FarmMapper.class), mock(PlotMapper.class), mock(TaskMapper.class), mock(HarvestBatchMapper.class), mock(InspectionMapper.class), mock(AlertRecordMapper.class));
        assertThrows(BusinessException.class, () -> service.createReport(Map.of("reportName", "非法期间", "reportType", "QUALITY", "bizDateFrom", "2026-11-05", "bizDateTo", "2026-11-01")));
        assertThrows(BusinessException.class, () -> service.createReport(Map.of("reportName", "超过一年", "reportType", "QUALITY", "bizDateFrom", "2025-01-01", "bizDateTo", "2026-01-03")));
        verify(mapper, never()).insert(any(ReportTask.class));
    }

    @Test
    void generateReportFilePersistsCsvAndCanDownload() {
        ReportTaskMapper reportTaskMapper = mock(ReportTaskMapper.class);
        FarmMapper farmMapper = mock(FarmMapper.class);
        PlotMapper plotMapper = mock(PlotMapper.class);
        TaskMapper taskMapper = mock(TaskMapper.class);
        HarvestBatchMapper harvestBatchMapper = mock(HarvestBatchMapper.class);
        InspectionMapper inspectionMapper = mock(InspectionMapper.class);
        AlertRecordMapper alertRecordMapper = mock(AlertRecordMapper.class);

        ReportTask task = new ReportTask();
        task.setId(101L);
        task.setReportCode("RPT" + java.util.UUID.randomUUID().toString().replace("-", ""));
        task.setReportName("华南示范农场综合监管报表");
        task.setReportType("GOV");
        task.setBizDateFrom(LocalDate.of(2026, 11, 1));
        task.setBizDateTo(LocalDate.of(2026, 11, 5));
        task.setStatus("PENDING");

        Farm farm = new Farm();
        farm.setId(1L);
        farm.setFarmName("华南绿色蔬菜示范农场");
        farm.setTenantId("2001");

        Plot plot = new Plot();
        plot.setId(11L);
        plot.setFarmId(1L);
        plot.setArea(new BigDecimal("50.5"));

        Task farmTask = new Task();
        farmTask.setId(21L);
        farmTask.setFarmId(1L);
        farmTask.setStatus("completed");
        farmTask.setAcceptStatus(1);
        farmTask.setPlanStartTime(LocalDateTime.of(2026, 11, 2, 9, 0));

        HarvestBatch batch = new HarvestBatch();
        batch.setBatchId(31L);
        batch.setFarmId(1L);
        batch.setQuantity(new BigDecimal("2.5"));
        batch.setUnit("吨");
        batch.setHarvestDate(LocalDate.of(2026, 11, 3));

        Inspection inspection = new Inspection();
        inspection.setInspectionId(41L);
        inspection.setFarmId(1L);
        inspection.setStatus("DONE");
        inspection.setResult("PASS");
        inspection.setSampleAt(LocalDateTime.of(2026, 11, 4, 10, 0));

        AlertRecord alert = new AlertRecord();
        alert.setId(51L);
        alert.setFarmId(1L);
        alert.setStatus("1");
        alert.setCreateTime(LocalDateTime.of(2026, 11, 5, 8, 0));

        when(reportTaskMapper.selectOne(any())).thenReturn(task);
        when(reportTaskMapper.lockByCode(task.getReportCode())).thenReturn(task);
        when(farmMapper.selectList(any())).thenReturn(List.of(farm));
        when(plotMapper.selectList(any())).thenReturn(List.of(plot));
        when(taskMapper.selectList(any())).thenReturn(List.of(farmTask));
        when(harvestBatchMapper.selectList(any())).thenReturn(List.of(batch));
        when(inspectionMapper.selectList(any())).thenReturn(List.of(inspection));
        when(alertRecordMapper.selectList(any())).thenReturn(List.of(alert));
        when(reportTaskMapper.updateById(any(ReportTask.class))).thenReturn(1);

        AdminReportServiceImpl service = reports(reportTaskMapper, farmMapper, plotMapper, taskMapper, harvestBatchMapper, inspectionMapper, alertRecordMapper);

        try (MockedStatic<TenantContextService> identity = mockStatic(TenantContextService.class)) {
            identity.when(TenantContextService::currentOperator).thenReturn("运营主管 · 99");
            ReportTask generated = service.generateReportFile(task.getReportCode());
            assertEquals("DONE", generated.getStatus());
            assertNotNull(generated.getFileUrl());
            assertNotNull(generated.getGeneratedAt());

            IAdminReportService.ReportFile file = service.downloadReportFile(task.getReportCode());
            assertNotNull(file);
            assertTrue(file.fileName().endsWith(".csv"));
            String csv = new String(file.content(), StandardCharsets.UTF_8);
            assertTrue(csv.contains("华南绿色蔬菜示范农场"));
            assertTrue(csv.contains("2500.00"));
            assertTrue(csv.contains("任务验收完成率"));
            assertTrue(csv.contains("检测合格率"));
            assertTrue(csv.contains("告警处置完成率"));
            assertTrue(csv.contains("100.0%"));
            assertTrue(csv.contains("合计,全部选中农场"));
            assertTrue(csv.contains("未换算采收单位"));
            assertTrue(csv.contains("运营主管 · 99"));
            assertTrue(csv.startsWith("\uFEFF"));
            assertEquals(csv, new String(service.downloadReportFile(task.getReportCode()).content(), StandardCharsets.UTF_8));
            assertEquals("DONE", service.generateReportFile(task.getReportCode()).getStatus());
            verify(reportTaskMapper, times(1)).updateById(task);

            task.setStatus("PENDING");
            assertThrows(BusinessException.class, () -> service.downloadReportFile(task.getReportCode()));
        }
    }
    @Test
    void invalidFiltersAreRejectedBeforeQuery() {
        ReportTaskMapper mapper = mock(ReportTaskMapper.class);
        AdminReportServiceImpl service = reports(mapper, mock(FarmMapper.class), mock(PlotMapper.class), mock(TaskMapper.class), mock(HarvestBatchMapper.class), mock(InspectionMapper.class), mock(AlertRecordMapper.class));
        assertThrows(BusinessException.class, () -> service.pageReports(1, 20, null, null, "UNKNOWN", null, null, null));
        assertThrows(BusinessException.class, () -> service.pageReports(1, 20, null, "UNKNOWN", null, null, null, null));
        assertThrows(BusinessException.class, () -> service.pageReports(1, 20, null, null, null, -1L, null, null));
        assertThrows(BusinessException.class, () -> service.pageReports(1, 20, null, null, null, null, "bad-date", null));
        assertThrows(BusinessException.class, () -> service.pageReports(1, 20, null, null, null, null, "2026-11-05", "2026-11-01"));
        org.mockito.Mockito.verifyNoInteractions(mapper);
    }

}
