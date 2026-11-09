package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.CirculationAnomaly;
import com.agri.production.entity.FoodSafetyAlert;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inventory;
import com.agri.production.entity.TraceCode;
import com.agri.production.mapper.CirculationAnomalyMapper;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.FoodSafetyAlertMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.InventoryMapper;
import com.agri.production.mapper.TestingLabMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.impl.AdminFoodSafetyServiceImpl;
import com.agri.production.service.impl.AdminQualityServiceImpl;
import com.agri.production.service.impl.AdminTraceServiceImpl;
import com.agri.production.vo.AdminFsAlertVO;
import com.agri.production.vo.AdminFsCirculationVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

public class QualityAndSafetyIntegrationTest {

    @Test
    public void testRecallBatchFullClosureAndTenantGuard() {
        TraceCodeMapper traceCodeMapper = mock(TraceCodeMapper.class);
        HarvestBatchMapper harvestBatchMapper = mock(HarvestBatchMapper.class);
        InventoryMapper inventoryMapper = mock(InventoryMapper.class);
        InspectionMapper inspectionMapper = mock(InspectionMapper.class);
        TestingLabMapper testingLabMapper = mock(TestingLabMapper.class);
        FarmMapper farmMapper = mock(FarmMapper.class);
        IChainRecordService chainRecordService = mock(IChainRecordService.class);

        AdminTraceServiceImpl traceService = new AdminTraceServiceImpl(
                traceCodeMapper, harvestBatchMapper, inspectionMapper, testingLabMapper, farmMapper,
                chainRecordService, inventoryMapper);

        HarvestBatch batch = new HarvestBatch();
        batch.setBatchId(101L);
        batch.setBatchNo("H_2026_01");
        batch.setTenantId("2001");
        batch.setStatus(1);

        when(harvestBatchMapper.selectById(101L)).thenReturn(batch);
        when(harvestBatchMapper.lockOwned(101L, "2001")).thenReturn(batch);

        TraceCode code = new TraceCode();
        code.setId(555L);
        code.setTraceCode("TC_1");
        code.setTenantId("2001");
        code.setStatus("active");
        when(traceCodeMapper.selectList(any())).thenReturn(List.of(code));

        Inventory inv = new Inventory();
        inv.setInventoryId(888L);
        inv.setCurrentQty(new BigDecimal("200"));
        when(inventoryMapper.selectList(any())).thenReturn(List.of(inv));

        int revoked = traceService.recall("101");
        Assertions.assertEquals(1, revoked);
        Assertions.assertEquals(4, batch.getStatus());
        Assertions.assertTrue(batch.getRemark().contains("监管召回"));
        Assertions.assertEquals(1, inv.getFrozen());
        Assertions.assertEquals(new BigDecimal("200"), inv.getFrozenQty());

        verify(traceCodeMapper).updateById(code);
        verify(inventoryMapper).updateById(inv);
        verify(harvestBatchMapper).updateById(batch);

        // Quality 委托给 TraceServiceImpl
        AdminQualityServiceImpl qualityService = new AdminQualityServiceImpl(
                testingLabMapper, inspectionMapper, harvestBatchMapper, traceService);
        qualityService.recallBatch("101");
    }

    @Test
    public void testAlertHandleOnceAndFailClosedWithoutAuth() {
        FoodSafetyAlertMapper alertMapper = mock(FoodSafetyAlertMapper.class);
        AdminFoodSafetyServiceImpl service = new AdminFoodSafetyServiceImpl(
                alertMapper, mock(CirculationAnomalyMapper.class), mock(com.agri.production.mapper.FarmRiskMapper.class),
                mock(com.agri.production.mapper.FoodSafetyStandardItemMapper.class),
                mock(com.agri.production.mapper.FoodSafetyStandardSummaryMapper.class),
                mock(com.agri.production.mapper.FoodSafetyColdChainResourceMapper.class));

        FoodSafetyAlert alert = new FoodSafetyAlert();
        alert.setAlertId("A_1");
        alert.setStatus("待处理");
        when(alertMapper.lockById("A_1")).thenReturn(alert);

        // 无凭证必须直接拒绝（fail-closed）
        Assertions.assertThrows(BusinessException.class, () -> {
            service.handleAlert("A_1", "措施", "进展说明");
        });
    }

    @Test
    public void testCirculationHandleLocksAndRejectsDone() {
        CirculationAnomalyMapper circulationMapper = mock(CirculationAnomalyMapper.class);
        AdminFoodSafetyServiceImpl service = new AdminFoodSafetyServiceImpl(
                mock(FoodSafetyAlertMapper.class), circulationMapper, mock(com.agri.production.mapper.FarmRiskMapper.class),
                mock(com.agri.production.mapper.FoodSafetyStandardItemMapper.class),
                mock(com.agri.production.mapper.FoodSafetyStandardSummaryMapper.class),
                mock(com.agri.production.mapper.FoodSafetyColdChainResourceMapper.class));

        CirculationAnomaly anomaly = new CirculationAnomaly();
        anomaly.setAnomalyId("C_1");
        anomaly.setStatus("done");
        when(circulationMapper.lockById("C_1")).thenReturn(anomaly);

        Assertions.assertThrows(BusinessException.class, () -> {
            service.handleCirculation("C_1", "方式", "说明");
        });
    }
}
