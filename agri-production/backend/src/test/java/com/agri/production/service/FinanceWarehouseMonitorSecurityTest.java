package com.agri.production.service;

import com.agri.production.controller.FinanceWarehouseMonitorController;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.mapper.*;
import org.junit.jupiter.api.*;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class FinanceWarehouseMonitorSecurityTest {
    HarvestBatchMapper batches=mock(HarvestBatchMapper.class);
    SensorDataMapper sensors=mock(SensorDataMapper.class);
    FinanceWarehouseMonitorController controller;
    MockRestServiceServer server;
    @BeforeEach void setup(){
        controller=new FinanceWarehouseMonitorController(batches,sensors,"secret-test","http://finance.test");
        server=MockRestServiceServer.bindTo((RestTemplate)ReflectionTestUtils.getField(controller,"client")).build();
    }
    void scope(){server.expect(requestTo("http://finance.test/internal/warehouse-monitor/R1/scope"))
        .andExpect(header("Authorization","Bearer verified"))
        .andExpect(header("X-Finance-Warehouse-Token","secret-test"))
        .andRespond(withSuccess("{\"code\":0,\"data\":{\"receiptId\":\"R1\",\"tenantId\":\"2001\",\"batchId\":\"101\",\"batchNo\":\"B101\"}}",MediaType.APPLICATION_JSON));}
    HarvestBatch batch(){HarvestBatch b=new HarvestBatch();b.setBatchId(101L);b.setTenantId("2001");b.setBatchNo("B101");b.setFarmId(5L);b.setPlotId(6L);when(batches.selectById(101L)).thenReturn(b);return b;}
    @Test void wrongServiceKeyDenied(){assertEquals(403,assertThrows(BusinessException.class,()->controller.sensors("R1","wrong","Bearer verified")).getCode());verifyNoInteractions(batches,sensors);}
    @Test void unconfiguredChannelClosed(){controller=new FinanceWarehouseMonitorController(batches,sensors,"","http://finance.test");assertEquals(403,assertThrows(BusinessException.class,()->controller.sensors("R1","","Bearer verified")).getCode());}
    @Test void anonymousDenied(){assertEquals(401,assertThrows(BusinessException.class,()->controller.sensors("R1","secret-test","")).getCode());verifyNoInteractions(sensors);}
    @Test void revokedBusinessScopeDenied(){server.expect(anything()).andRespond(withSuccess("{\"code\":403}",MediaType.APPLICATION_JSON));assertEquals(403,assertThrows(BusinessException.class,()->controller.sensors("R1","secret-test","Bearer verified")).getCode());verifyNoInteractions(sensors);}
    @Test void forgedTenantDenied(){scope();batch().setTenantId("2003");assertEquals(404,assertThrows(BusinessException.class,()->controller.sensors("R1","secret-test","Bearer verified")).getCode());verifyNoInteractions(sensors);}
    @Test void actualBatchScopeUsed(){scope();batch();when(sensors.getWarehouseLatest("2001",5L,6L)).thenReturn(List.of());controller.sensors("R1","secret-test","Bearer verified");verify(sensors).getWarehouseLatest("2001",5L,6L);server.verify();}
    @Test void missingScopeNeverFallsBack(){scope();HarvestBatch b=batch();b.setFarmId(null);b.setPlotId(null);controller.sensors("R1","secret-test","Bearer verified");verifyNoInteractions(sensors);}
    @Test void missingBatchDenied(){scope();assertEquals(404,assertThrows(BusinessException.class,()->controller.sensors("R1","secret-test","Bearer verified")).getCode());verifyNoInteractions(sensors);}
}
