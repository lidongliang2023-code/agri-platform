package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inventory;
import com.agri.production.entity.P2tOffer;
import com.agri.production.entity.P2tVarietyMap;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InventoryMapper;
import com.agri.production.mapper.P2tDiffTicketMapper;
import com.agri.production.mapper.P2tOfferMapper;
import com.agri.production.mapper.P2tSubscriptionMapper;
import com.agri.production.mapper.P2tVarietyMapMapper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class P2tServiceStockTest {

    @Mock private P2tVarietyMapMapper varietyMapper;
    @Mock private P2tOfferMapper offerMapper;
    @Mock private P2tSubscriptionMapper subscriptionMapper;
    @Mock private P2tDiffTicketMapper diffMapper;
    @Mock private HarvestBatchMapper harvestBatchMapper;
    @Mock private InventoryMapper inventoryMapper;

    private P2tService service;
    private final String tenantId = "2001";

    @BeforeEach
    void setUp() {
        service = new P2tService(varietyMapper, offerMapper, subscriptionMapper, diffMapper, harvestBatchMapper, inventoryMapper);
    }

    private HarvestBatch mockBatch(Long batchId, String batchNo, BigDecimal quantity, String unit) {
        HarvestBatch b = new HarvestBatch();
        b.setBatchId(batchId);
        b.setBatchNo(batchNo);
        b.setCropId(101L);
        b.setCropName("平和蜜柚");
        b.setCropVariety("三红蜜柚");
        b.setFarmId(1L);
        b.setFarmName("南靖示范农场");
        b.setHarvestDate(LocalDate.now().minusDays(2));
        b.setQuantity(quantity);
        b.setUnit(unit);
        b.setTenantId(tenantId);
        return b;
    }

    private Inventory mockInventory(Long invId, Long batchId, String wh, BigDecimal current, BigDecimal frozen,
                                   Integer frozenFlag, LocalDate expireDate, String unit) {
        Inventory inv = new Inventory();
        inv.setInventoryId(invId);
        inv.setBatchId(batchId);
        inv.setWarehouseName(wh);
        inv.setCurrentQty(current);
        inv.setFrozenQty(frozen);
        inv.setFrozen(frozenFlag);
        inv.setExpireDate(expireDate);
        inv.setUnit(unit);
        inv.setTenantId(tenantId);
        return inv;
    }

    private P2tOffer mockOffer(Long id, String offerNo, Long batchId, BigDecimal available, BigDecimal reserved,
                              String auditStatus, String tradeStatus) {
        P2tOffer o = new P2tOffer();
        o.setId(id);
        o.setOfferNo(offerNo);
        o.setBatchId(batchId);
        o.setAvailableQty(available);
        o.setReservedQty(reserved);
        o.setAuditStatus(auditStatus);
        o.setTradeStatus(tradeStatus);
        o.setTenantId(tenantId);
        return o;
    }

    @Test
    @DisplayName("多仓可用库存汇总：排除冻结与过期未冻结，扣除未驳回供给占用")
    void testPageBatchesStockCalculation() {
        HarvestBatch batch = mockBatch(11L, "HB-TEST-001", new BigDecimal("1000.00"), "kg");
        when(harvestBatchMapper.selectPage(any(), any())).thenAnswer(inv -> {
            com.baomidou.mybatisplus.extension.plugins.pagination.Page<HarvestBatch> p = inv.getArgument(0);
            p.setRecords(List.of(batch));
            p.setTotal(1);
            return p;
        });

        List<Inventory> invs = List.of(
                mockInventory(1L, 11L, "1号保鲜仓", new BigDecimal("300.00"), BigDecimal.ZERO, 0, LocalDate.now().plusDays(20), "kg"),
                mockInventory(2L, 11L, "2号冷藏仓", new BigDecimal("200.00"), new BigDecimal("50.00"), 0, LocalDate.now().plusDays(10), "kg"),
                mockInventory(3L, 11L, "3号周转仓", new BigDecimal("100.00"), BigDecimal.ZERO, 1, LocalDate.now().plusDays(5), "kg"),
                mockInventory(4L, 11L, "4号隔离仓", new BigDecimal("40.00"), BigDecimal.ZERO, 0, LocalDate.now().minusDays(1), "kg")
        );
        when(inventoryMapper.selectList(any())).thenReturn(invs);

        List<P2tOffer> offers = List.of(
                mockOffer(101L, "OFF-001", 11L, new BigDecimal("120.00"), new BigDecimal("30.00"), "APPROVED", "LISTED"),
                mockOffer(102L, "OFF-002", 11L, new BigDecimal("80.00"), BigDecimal.ZERO, "REJECTED", "PENDING"),
                mockOffer(103L, "OFF-003", 11L, new BigDecimal("50.00"), new BigDecimal("10.00"), "APPROVED", "CLOSED")
        );
        when(offerMapper.selectList(any())).thenReturn(offers);

        P2tVarietyMap vm = new P2tVarietyMap();
        vm.setCategoryCode("CAT-POMELO");
        when(varietyMapper.selectList(any())).thenReturn(List.of(vm));

        var res = service.pageBatches(1, 10, null, tenantId);
        assertEquals(1L, res.getTotal());
        Map<String, Object> row = res.getRecords().get(0);
        assertEquals(new BigDecimal("640.00"), row.get("stockQty"));
        assertEquals(new BigDecimal("150.00"), row.get("frozenQty"));
        assertEquals(new BigDecimal("40.00"), row.get("unusableQty"));
        assertEquals(new BigDecimal("450.00"), row.get("availableStockQty"));
        assertEquals(new BigDecimal("130.00"), row.get("publishedQty"));
        assertEquals(new BigDecimal("320.00"), row.get("publishableQty"));
        assertEquals(Boolean.FALSE, row.get("stockUnitMismatch"));
        assertEquals(BigDecimal.ZERO, row.get("stockShortfallQty"));
        assertTrue((Boolean) row.get("publishable"));
    }

    @Test
    @DisplayName("现货可供量超过可用库存时拒绝发布")
    void testCreateOfferExceedsStockThrows() {
        HarvestBatch batch = mockBatch(22L, "HB-TEST-002", new BigDecimal("500.00"), "kg");
        when(harvestBatchMapper.lockOwned(eq(22L), eq(tenantId))).thenReturn(batch);
        when(inventoryMapper.selectList(any())).thenReturn(List.of(
                mockInventory(1L, 22L, "主仓", new BigDecimal("100.00"), BigDecimal.ZERO, 0, LocalDate.now().plusDays(10), "kg")
        ));
        when(offerMapper.selectList(any())).thenReturn(List.of(
                mockOffer(1L, "OFF-OLD", 22L, new BigDecimal("60.00"), BigDecimal.ZERO, "PENDING", "PENDING")
        ));
        P2tVarietyMap vm = new P2tVarietyMap();
        vm.setCategoryCode("CAT-POMELO");
        when(varietyMapper.selectList(any())).thenReturn(List.of(vm));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createOffer(Map.of(
                "batchId", 22L,
                "availableQty", new BigDecimal("50.00"),
                "categoryCode", "CAT-POMELO"
        ), tenantId));
        assertTrue(ex.getMessage().contains("现货可用库存不足"));
    }

    @Test
    @DisplayName("库存单位与批次不一致时拒绝发布")
    void testCreateOfferUnitMismatchThrows() {
        HarvestBatch batch = mockBatch(33L, "HB-TEST-003", new BigDecimal("500.00"), "kg");
        when(harvestBatchMapper.lockOwned(eq(33L), eq(tenantId))).thenReturn(batch);
        when(inventoryMapper.selectList(any())).thenReturn(List.of(
                mockInventory(1L, 33L, "主仓", new BigDecimal("200.00"), BigDecimal.ZERO, 0, LocalDate.now().plusDays(10), "箱")
        ));
        P2tVarietyMap vm = new P2tVarietyMap();
        vm.setCategoryCode("CAT-POMELO");
        when(varietyMapper.selectList(any())).thenReturn(List.of(vm));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.createOffer(Map.of(
                "batchId", 33L,
                "availableQty", new BigDecimal("10.00"),
                "categoryCode", "CAT-POMELO"
        ), tenantId));
        assertTrue(ex.getMessage().contains("库存单位与采收批次不一致"));
    }

    @Test
    @DisplayName("未入库批次不能将采收量作为现货发布")
    void noStockCannotPublish() {
        HarvestBatch batch = mockBatch(44L, "HB-NO-STOCK", new BigDecimal("1000"), "kg");
        when(harvestBatchMapper.lockOwned(44L, tenantId)).thenReturn(batch);
        when(inventoryMapper.selectList(any())).thenReturn(List.of());
        when(offerMapper.selectList(any())).thenReturn(List.of());
        P2tVarietyMap map = new P2tVarietyMap(); map.setCategoryCode("CAT");
        when(varietyMapper.selectList(any())).thenReturn(List.of(map));
        assertThrows(BusinessException.class, () -> service.createOffer(Map.of("batchId",44L,"availableQty",1),tenantId));
        verify(offerMapper, never()).insert(any(P2tOffer.class));
    }

    @Test
    @DisplayName("库存下降后重新提交不得重新占用超额库存")
    void resubmitChecksCurrentStock() {
        HarvestBatch batch = mockBatch(55L, "HB-LOW-STOCK", new BigDecimal("1000"), "kg");
        P2tOffer offer = mockOffer(5L,"OFF-REJECTED",55L,new BigDecimal("80"),BigDecimal.ZERO,"REJECTED","PENDING");
        when(offerMapper.selectOne(any())).thenReturn(offer);
        when(harvestBatchMapper.lockOwned(55L,tenantId)).thenReturn(batch);
        when(inventoryMapper.selectList(any())).thenReturn(List.of(mockInventory(1L,55L,"仓A",new BigDecimal("20"),BigDecimal.ZERO,0,LocalDate.now(),"kg")));
        when(offerMapper.selectList(any())).thenReturn(List.of(offer));
        assertThrows(BusinessException.class, () -> service.submitOffer(5L,tenantId));
        verify(offerMapper,never()).updateById(any(P2tOffer.class));
        assertEquals("REJECTED",offer.getAuditStatus());
    }

    @Test
    @DisplayName("库存缺口不产生负可发布量，历史已认购仍保留占用")
    void stockDeficitAndClosedReservations() {
        HarvestBatch batch = mockBatch(66L,"HB-DEFICIT",new BigDecimal("200"),"kg");
        when(harvestBatchMapper.selectPage(any(),any())).thenAnswer(inv -> {
            com.baomidou.mybatisplus.extension.plugins.pagination.Page<HarvestBatch> page = inv.getArgument(0);
            page.setRecords(List.of(batch)); page.setTotal(1); return page;
        });
        when(inventoryMapper.selectList(any())).thenReturn(List.of(mockInventory(1L,66L,"仓A",new BigDecimal("20"),BigDecimal.ZERO,0,LocalDate.now(),"kg")));
        when(offerMapper.selectList(any())).thenReturn(List.of(mockOffer(6L,"OFF-CLOSED",66L,new BigDecimal("100"),new BigDecimal("30"),"APPROVED","CLOSED")));
        when(varietyMapper.selectList(any())).thenReturn(List.of());
        Map<String,Object> row = service.pageBatches(1,10,null,tenantId).getRecords().get(0);
        assertEquals(BigDecimal.ZERO,row.get("publishableQty"));
        assertEquals(new BigDecimal("10"),row.get("stockShortfallQty"));
        assertEquals(new BigDecimal("30"),row.get("publishedQty"));
        assertEquals(new BigDecimal("20"),row.get("availableStockQty"));
    }
}
