package com.agri.trade.service;

import com.agri.trade.controller.SmartMatchController;
import com.agri.trade.entity.Demand;
import com.agri.trade.entity.MatchRecord;
import com.agri.trade.entity.TradeProduct;
import com.agri.trade.mapper.DemandMapper;
import com.agri.trade.mapper.MatchRecordMapper;
import com.agri.trade.mapper.TradeProductCategoryMapper;
import com.agri.trade.mapper.TradeProductMapper;
import com.agri.trade.service.impl.SmartMatchServiceImpl;
import com.agri.trade.vo.MatchResultVO;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 撮合记录不得因重复打开详情而累积（2026-11-19 回归）。
 *
 * <p>修复前：同一需求每触发一次撮合就无条件 insert 一批记录，实测一个「需求 + 货源」组合累积到 17 条；
 * 而且任何人打开别家的采购详情都会往人家的需求上写记录。</p>
 */
class SmartMatchRecordIdempotencyTest {

    private DemandMapper demandMapper;
    private TradeProductMapper productMapper;
    private MatchRecordMapper matchRecordMapper;
    private SmartMatchServiceImpl service;
    private final List<MatchRecord> table = new ArrayList<>();

    @BeforeAll
    static void initLambdaCache() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "");
        TableInfoHelper.initTableInfo(assistant, MatchRecord.class);
        TableInfoHelper.initTableInfo(assistant, TradeProduct.class);
    }

    @BeforeEach
    void setUp() {
        demandMapper = mock(DemandMapper.class);
        productMapper = mock(TradeProductMapper.class);
        matchRecordMapper = mock(MatchRecordMapper.class);
        service = spy(new SmartMatchServiceImpl(demandMapper, productMapper, matchRecordMapper,
                mock(TradeProductCategoryMapper.class)));
        table.clear();

        Demand demand = new Demand();
        demand.setId(7250L);
        demand.setBuyerId(2001L);
        when(demandMapper.selectById(7250L)).thenReturn(demand);
        for (long pid : new long[]{7003L, 7005L}) {
            TradeProduct p = new TradeProduct();
            p.setId(pid);
            p.setSellerId(3000L + pid);
            when(productMapper.selectById(pid)).thenReturn(p);
        }
        doAnswer(inv -> {
            TradeProduct p = inv.getArgument(1);
            MatchResultVO vo = new MatchResultVO();
            vo.setProductId(p.getId());
            vo.setMatchScore(BigDecimal.valueOf(80));
            vo.setMatchReason("同品类");
            return vo;
        }).when(service).calculateMatchScore(any(), any());

        // 内存里模拟一张表：insert 分配自增 id；selectOne 按 demand/product 找未删除的最早一条
        when(matchRecordMapper.insert(any(MatchRecord.class))).thenAnswer(inv -> {
            MatchRecord r = inv.getArgument(0);
            r.setId((long) (table.size() + 1));
            table.add(r);
            return 1;
        });
        when(matchRecordMapper.updateById(any(MatchRecord.class))).thenReturn(1);
    }

    @Test
    void repeatedMatchKeepsOneRecordPerPairAndPreservesBusinessState() {
        // 第一次：表里没有，逐条新增
        when(matchRecordMapper.selectOne(any())).thenReturn(null);
        service.batchCreateMatchRecords(7250L, List.of(7003L, 7005L));
        assertEquals(2, table.size());

        // 买家已对 7003 发起询价；再触发两次撮合
        table.get(0).setInquiryStatus("inquired");
        when(matchRecordMapper.selectOne(any())).thenReturn(table.get(0), table.get(1), table.get(0), table.get(1));
        service.batchCreateMatchRecords(7250L, List.of(7003L, 7005L));
        service.batchCreateMatchRecords(7250L, List.of(7003L, 7005L));

        assertEquals(2, table.size(), "重复撮合不应新增记录");
        assertEquals("inquired", table.get(0).getInquiryStatus(), "询价状态必须保留");
        verify(matchRecordMapper, times(2)).insert(any(MatchRecord.class));
        verify(matchRecordMapper, times(4)).updateById(any(MatchRecord.class));
    }

    @Test
    void concurrentInsertHittingUniqueKeyMergesIntoWinner() {
        // 并发：预查时还没有，插入时对方已先提交 → 唯一索引报重复键
        MatchRecord winner = new MatchRecord();
        winner.setId(7521L);
        winner.setDemandId(7250L);
        winner.setProductId(7003L);
        winner.setInquiryStatus("inquired");
        when(matchRecordMapper.selectOne(any())).thenReturn(null, winner);
        when(matchRecordMapper.insert(any(MatchRecord.class)))
                .thenThrow(new org.springframework.dao.DuplicateKeyException("uk_match_pair_active"));

        List<MatchRecord> saved = service.batchCreateMatchRecords(7250L, List.of(7003L));

        assertEquals(1, saved.size());
        assertEquals(7521L, saved.get(0).getId(), "应归并到对方写入的那条");
        assertEquals("inquired", saved.get(0).getInquiryStatus());
        verify(matchRecordMapper, times(1)).insert(any(MatchRecord.class));
        verify(matchRecordMapper, times(1)).updateById(winner);
    }

    @Test
    void matchNoCollisionRetriesWithNewNumber() {
        List<String> tried = new ArrayList<>();
        when(matchRecordMapper.selectOne(any())).thenReturn(null);
        when(matchRecordMapper.insert(any(MatchRecord.class))).thenAnswer(inv -> {
            MatchRecord r = inv.getArgument(0);
            tried.add(r.getMatchNo());
            if (tried.size() == 1) {
                throw new org.springframework.dao.DuplicateKeyException("uk_match_no");
            }
            r.setId(99L);
            return 1;
        });

        List<MatchRecord> saved = service.batchCreateMatchRecords(7250L, List.of(7003L));

        assertEquals(99L, saved.get(0).getId());
        assertEquals(2, tried.size());
        org.junit.jupiter.api.Assertions.assertNotEquals(tried.get(0), tried.get(1), "重试必须换编号");
    }

    @Test
    void matchResultsCarryRealRecordId() {
        when(productMapper.selectList(any())).thenReturn(List.of(product(7003L)));
        when(matchRecordMapper.selectOne(any())).thenReturn(null);
        List<MatchResultVO> first = service.matchDemandToProducts(7250L, 10, true);
        assertEquals(1L, first.get(0).getMatchId());
    }

    @Test
    void previewDoesNotWrite() {
        when(productMapper.selectList(any())).thenReturn(List.of(product(7003L), product(7005L)));
        List<MatchResultVO> results = service.matchDemandToProducts(7250L, 10, false);
        assertEquals(2, results.size());
        verify(matchRecordMapper, never()).insert(any(MatchRecord.class));
        verify(matchRecordMapper, never()).updateById(any(MatchRecord.class));
    }

    @Test
    void controllerPersistsOnlyForDemandOwner() {
        ISmartMatchService matchService = mock(ISmartMatchService.class);
        PlatformIdentityService identity = mock(PlatformIdentityService.class);
        when(matchService.matchDemandToProducts(anyLong(), anyInt(), anyBoolean())).thenReturn(List.of());
        SmartMatchController controller = new SmartMatchController(matchService, identity, demandMapper);

        when(identity.currentScope()).thenReturn(
                new PlatformIdentityService.MerchantScope(true, List.of(9999L), List.<Map<String, Object>>of(), null));
        controller.matchDemandToProducts(7250L, 10);
        verify(matchService).matchDemandToProducts(7250L, 10, false);

        when(identity.currentScope()).thenReturn(
                new PlatformIdentityService.MerchantScope(true, List.of(2001L), List.<Map<String, Object>>of(), null));
        controller.matchDemandToProducts(7250L, 10);
        verify(matchService).matchDemandToProducts(7250L, 10, true);

        when(identity.currentScope()).thenReturn(
                new PlatformIdentityService.MerchantScope(false, List.of(), List.<Map<String, Object>>of(), "未登录"));
        controller.matchDemandToProducts(7250L, 5);
        verify(matchService).matchDemandToProducts(eq(7250L), eq(5), eq(false));
    }

    private static TradeProduct product(long id) {
        TradeProduct p = new TradeProduct();
        p.setId(id);
        p.setSellerId(3000L + id);
        return p;
    }
}
