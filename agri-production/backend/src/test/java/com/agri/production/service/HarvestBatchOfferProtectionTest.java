package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.mapper.*;
import com.agri.production.service.impl.HarvestInventoryServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class HarvestBatchOfferProtectionTest {
    private final HarvestBatchMapper batches = mock(HarvestBatchMapper.class);
    private final P2tOfferMapper offers = mock(P2tOfferMapper.class);
    private HarvestInventoryServiceImpl service;
    private HarvestBatch batch;

    @BeforeEach
    void setUp() {
        service = new HarvestInventoryServiceImpl(batches, mock(InventoryMapper.class),
                mock(InventoryFlowMapper.class), mock(PlotMapper.class),
                mock(IDomainEventService.class), mock(ITraceLifecycleService.class), offers);
        batch = new HarvestBatch();
        batch.setBatchId(101L);
        batch.setTenantId("2001");
        batch.setInboundStatus(0);
        batch.setTraceGenerated(0);
        batch.setQuantity(new BigDecimal("100"));
    }

    @Test
    void linkedOfferBlocksQuantityAndSourceChangesBeforeApplyingPayload() {
        when(batches.lockOwned(101L, "2001")).thenReturn(batch);
        when(offers.lockBatchOfferIds(101L, "2001")).thenReturn(List.of(801L));
        BusinessException ex = assertThrows(BusinessException.class,
                () -> service.updateBatch(101L, Map.of("quantity", 1, "plotId", 999), "2001"));
        assertTrue(ex.getMessage().contains("已关联供给单"));
        assertEquals(new BigDecimal("100"), batch.getQuantity());
        verify(batches, never()).updateById(any(HarvestBatch.class));
        InOrder order = inOrder(batches, offers);
        order.verify(batches).lockOwned(101L, "2001");
        order.verify(offers).lockBatchOfferIds(101L, "2001");
    }

    @Test
    void linkedOfferBlocksDeletionEvenBeforeInboundOrTraceGeneration() {
        when(batches.lockOwned(101L, "2001")).thenReturn(batch);
        when(offers.lockBatchOfferIds(101L, "2001")).thenReturn(List.of(801L));
        assertThrows(BusinessException.class, () -> service.deleteBatch(101L, "2001"));
        verify(batches, never()).deleteById(anyLong());
    }

    @Test
    void unlinkedUnprocessedBatchCanBeDeleted() {
        when(batches.lockOwned(101L, "2001")).thenReturn(batch);
        when(offers.lockBatchOfferIds(101L, "2001")).thenReturn(List.of());
        service.deleteBatch(101L, "2001");
        verify(batches).deleteById(101L);
    }

    @Test
    void otherSubjectCannotInspectAssociationsOrDeleteBatch() {
        when(batches.lockOwned(101L, "2002")).thenReturn(null);
        assertThrows(BusinessException.class, () -> service.deleteBatch(101L, "2002"));
        verifyNoInteractions(offers);
        verify(batches, never()).deleteById(anyLong());
    }

    @Test
    void inboundProtectionRemainsWhenNoOfferExists() {
        batch.setInboundStatus(1);
        when(batches.lockOwned(101L, "2001")).thenReturn(batch);
        when(offers.lockBatchOfferIds(101L, "2001")).thenReturn(List.of());
        assertThrows(BusinessException.class, () -> service.deleteBatch(101L, "2001"));
        verify(batches, never()).deleteById(anyLong());
    }

    @Test
    void detailReturnsAssociationCountAndRestriction() {
        when(batches.selectById(101L)).thenReturn(batch);
        when(offers.selectCount(any())).thenReturn(2L);
        HarvestBatch result = service.detailBatch(101L, "2001");
        assertEquals(2L, result.getLinkedOfferCount());
        assertTrue(result.getMutationBlockedReason().contains("2 条供给单"));
    }
}
