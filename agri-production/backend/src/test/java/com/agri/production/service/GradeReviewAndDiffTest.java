package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.integration.TradeLogisticsClient;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

public class GradeReviewAndDiffTest {

    private GradeReviewMapper reviewMapper;
    private P2tDiffTicketMapper diffMapper;
    private P2tOfferMapper offerMapper;
    private HarvestBatchMapper batchMapper;
    private InspectionMapper inspectionMapper;
    private InventoryMapper inventoryMapper;
    private TradeLogisticsClient diffEvidenceClient;
    private GradeReviewService reviewService;
    private P2tService p2tService;

    private static final String TENANT = "2001";

    @BeforeEach
    void setUp() {
        reviewMapper = mock(GradeReviewMapper.class);
        diffMapper = mock(P2tDiffTicketMapper.class);
        offerMapper = mock(P2tOfferMapper.class);
        batchMapper = mock(HarvestBatchMapper.class);
        inspectionMapper = mock(InspectionMapper.class);
        inventoryMapper = mock(InventoryMapper.class);
        diffEvidenceClient = mock(TradeLogisticsClient.class);

        reviewService = new GradeReviewService(reviewMapper, diffMapper, offerMapper, batchMapper, inspectionMapper);
        p2tService = new P2tService(mock(P2tVarietyMapMapper.class), offerMapper, mock(P2tSubscriptionMapper.class),
                diffMapper, batchMapper, inventoryMapper);

        // 利用反射注入依赖，避免重构既有构造器签名
        try {
            var f = P2tService.class.getDeclaredField("gradeReviewService");
            f.setAccessible(true);
            f.set(p2tService, reviewService);
            var f2 = P2tService.class.getDeclaredField("diffEvidenceClient");
            f2.setAccessible(true);
            f2.set(p2tService, diffEvidenceClient);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private P2tDiffTicket gradeDownTicket() {
        P2tDiffTicket t = new P2tDiffTicket();
        t.setId(101L);
        t.setTenantId(TENANT);
        t.setTicketNo("DIFF-GD-001");
        t.setDiffType("GRADE_DOWN");
        t.setOfferNo("OFFER-001");
        t.setOrderNo("SO-001");
        t.setOwnerSide("PRODUCTION");
        t.setStatus("PROCESSING");
        return t;
    }

    private P2tOffer offer() {
        P2tOffer o = new P2tOffer();
        o.setId(11L);
        o.setTenantId(TENANT);
        o.setOfferNo("OFFER-001");
        o.setBatchId(1001L);
        o.setUnit("kg");
        return o;
    }

    private HarvestBatch batch(String grade) {
        HarvestBatch b = new HarvestBatch();
        b.setBatchId(1001L);
        b.setTenantId(TENANT);
        b.setGrade(grade);
        return b;
    }

    private Inspection passInspection() {
        Inspection i = new Inspection();
        i.setInspectionId(501L);
        i.setInspectionNo("INS-501");
        i.setTenantId(TENANT);
        i.setBatchId(1001L);
        i.setStatus("DONE");
        i.setResult("PASS");
        return i;
    }

    @Test
    void applyRejectsSameOrHigherGrade() {
        when(diffMapper.selectOne(any())).thenReturn(gradeDownTicket());
        when(offerMapper.selectOne(any())).thenReturn(offer());
        when(reviewMapper.selectCount(any())).thenReturn(0L);
        when(batchMapper.selectById(1001L)).thenReturn(batch("B"));

        var app = new GradeReviewService.Apply(101L, 501L, "A", "复核");
        BusinessException ex = assertThrows(BusinessException.class, () -> reviewService.apply(app, TENANT, "farmer1"));
        assertTrue(ex.getMessage().contains("低于原批次等级"));
    }

    @Test
    void applyRejectsFailedInspection() {
        when(diffMapper.selectOne(any())).thenReturn(gradeDownTicket());
        when(offerMapper.selectOne(any())).thenReturn(offer());
        when(reviewMapper.selectCount(any())).thenReturn(0L);
        when(batchMapper.selectById(1001L)).thenReturn(batch("A"));

        Inspection fail = passInspection();
        fail.setResult("FAIL");
        when(inspectionMapper.selectById(501L)).thenReturn(fail);

        var app = new GradeReviewService.Apply(101L, 501L, "B", "复核");
        BusinessException ex = assertThrows(BusinessException.class, () -> reviewService.apply(app, TENANT, "farmer1"));
        assertTrue(ex.getMessage().contains("已完成且合格的检测单"));
    }

    @Test
    void decideRejectsSelfApproval() {
        GradeReview r = new GradeReview();
        r.setId(88L);
        r.setTenantId(TENANT);
        r.setTicketId(101L);
        r.setApplicantId("farmer1");
        r.setStatus("PENDING");
        when(reviewMapper.selectOne(any())).thenReturn(r);
        when(diffMapper.selectOne(any())).thenReturn(gradeDownTicket());

        var dec = new GradeReviewService.Decision(true, "自核不合规");
        BusinessException ex = assertThrows(BusinessException.class, () -> reviewService.decide(88L, dec, TENANT, "farmer1"));
        assertTrue(ex.getMessage().contains("申请人不可确认自己的复核"));
    }

    @Test
    void closeDiffConsumesApprovedReviewAndRejectsReuse() {
        P2tDiffTicket t = gradeDownTicket();
        when(diffMapper.selectOne(any())).thenReturn(t);
        when(offerMapper.selectOne(any())).thenReturn(offer());
        when(diffMapper.updateById(any())).thenReturn(1);

        GradeReview approved = new GradeReview();
        approved.setId(88L);
        approved.setReviewNo("GR-2026-01");
        approved.setTenantId(TENANT);
        approved.setTicketId(101L);
        approved.setTicketNo(t.getTicketNo());
        approved.setOfferNo(t.getOfferNo());
        approved.setOrderNo(t.getOrderNo());
        approved.setBatchId(1001L);
        approved.setOriginalGrade("A");
        approved.setReviewedGrade("B");
        approved.setInspectionId(501L);
        approved.setApplicantId("farmer1");
        approved.setReviewerId("farmer2");
        approved.setStatus("APPROVED");

        when(reviewMapper.selectOne(any())).thenReturn(approved);
        when(batchMapper.selectById(1001L)).thenReturn(batch("A"));
        when(inspectionMapper.selectById(501L)).thenReturn(passInspection());
        when(reviewMapper.updateById(any())).thenReturn(1);

        P2tDiffTicket closed = p2tService.handleDiff(101L, "CLOSED", "降级", "按复核闭环", "GR-2026-01", "PROCESSING", TENANT);
        assertEquals("CLOSED", closed.getStatus());
        assertEquals("CONSUMED", approved.getStatus());
        assertNotNull(approved.getConsumedAt());
        assertTrue(closed.getHandleRemark().contains("等级复核=GR-2026-01"));

        // 尝试再次核销同一凭据，已核销的凭据应被拒绝
        P2tDiffTicket processingTicket = gradeDownTicket();
        BusinessException ex = assertThrows(BusinessException.class,
                () -> reviewService.consume("GR-2026-01", processingTicket, offer(), TENANT));
        assertTrue(ex.getMessage().contains("已核销") || ex.getMessage().contains("未通过双人确认"));
    }
}
