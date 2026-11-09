package com.agri.production.service;

import com.agri.production.service.impl.TraceLifecycleServiceImpl;
import com.agri.production.mapper.*;
import com.agri.production.entity.TraceCode;
import com.agri.production.common.exception.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TraceLifecycleBoundaryTest {
    private TraceLifecycleServiceImpl service(TraceCodeMapper codes) {
        return new TraceLifecycleServiceImpl(codes, mock(HarvestBatchMapper.class), mock(InspectionMapper.class),
            mock(InventoryFlowMapper.class), mock(InputUsageRecordMapper.class), mock(ChainRecordMapper.class),
            mock(IChainRecordService.class), mock(IDomainEventService.class), mock(PlotCropMapper.class),
            mock(GrowthRecordMapper.class), mock(PlotMapper.class), mock(ProcessRecordMapper.class));
    }
    @Test void rejectsArbitraryBatchState() {
        TraceCodeMapper codes = mock(TraceCodeMapper.class);
        assertThrows(BusinessException.class, () -> service(codes).batchUpdateStatus(List.of("A"), "scanned", "2001"));
        verifyNoInteractions(codes);
    }
    @Test void missingOwnedCodeFailsRatherThanSilentlySkipping() {
        TraceCodeMapper codes = mock(TraceCodeMapper.class);
        assertThrows(BusinessException.class, () -> service(codes).batchUpdateStatus(List.of("OTHER"), "active", "2001"));
        verify(codes, never()).updateById(any(TraceCode.class));
    }
    @Test void batchActivationUsesBatchAndQualityValidation() {
        TraceCodeMapper codes = mock(TraceCodeMapper.class);
        TraceCode code = new TraceCode(); code.setTraceCode("A"); code.setTenantId("2001"); code.setStatus("generated"); code.setHarvestId(1L);
        when(codes.selectOne(any())).thenReturn(code);
        assertThrows(BusinessException.class, () -> service(codes).batchUpdateStatus(List.of("A"), "active", "2001"));
        verify(codes, never()).updateById(any(TraceCode.class));
    }
}
