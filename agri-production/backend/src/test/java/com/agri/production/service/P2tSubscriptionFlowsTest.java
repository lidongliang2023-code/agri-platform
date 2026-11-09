package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class P2tSubscriptionFlowsTest {
    private final P2tOfferMapper offers = mock(P2tOfferMapper.class);
    private final P2tSubscriptionMapper flows = mock(P2tSubscriptionMapper.class);
    private P2tService service;
    @BeforeEach void setup() {
        MapperBuilderAssistant assistant = new MapperBuilderAssistant(new MybatisConfiguration(), "test");
        TableInfoHelper.initTableInfo(assistant, P2tSubscription.class);
        TableInfoHelper.initTableInfo(assistant, P2tOffer.class);
        service = new P2tService(mock(P2tVarietyMapMapper.class), offers, flows,
                mock(P2tDiffTicketMapper.class), mock(HarvestBatchMapper.class), mock(InventoryMapper.class));
        when(flows.selectPage(any(Page.class), any())).thenAnswer(inv -> {
            Page<P2tSubscription> page = inv.getArgument(0);
            page.setRecords(List.of()); page.setTotal(0); return page;
        });
    }
    @Test void filtersExactOfferAndSubjectBeforePagination() {
        P2tOffer offer = new P2tOffer(); offer.setOfferNo("OFF-1"); offer.setTenantId("2001");
        when(offers.selectOne(any())).thenReturn(offer);
        service.pageSubscriptionFlows(2, 20, "ORDER", "OFF-1", "ORDER_CANCELLED", "SUCCESS", "2001");
        ArgumentCaptor<LambdaQueryWrapper<P2tSubscription>> cap = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(flows).selectPage(any(Page.class), cap.capture());
        String sql = cap.getValue().getSqlSegment();
        assertTrue(sql.contains("offer_no =")); assertTrue(sql.contains("tenant_id ="));
        assertTrue(sql.contains("event_type =")); assertTrue(sql.contains("writeback_status ="));
        assertTrue(cap.getValue().getParamNameValuePairs().containsValue("OFF-1"));
        assertTrue(cap.getValue().getParamNameValuePairs().containsValue("2001"));
        ArgumentCaptor<LambdaQueryWrapper<P2tOffer>> owned = ArgumentCaptor.forClass(LambdaQueryWrapper.class);
        verify(offers).selectOne(owned.capture());
        assertTrue(owned.getValue().getSqlSegment().contains("tenant_id ="));
    }
    @Test void rejectsMissingSubjectBeforeQuery() {
        assertThrows(BusinessException.class, () -> service.pageSubscriptionFlows(1,10,null,"OFF-1",null,null,null));
        verifyNoInteractions(offers, flows);
    }
    @Test void inaccessibleOfferDoesNotQueryFlows() {
        assertThrows(BusinessException.class, () -> service.pageSubscriptionFlows(1,10,null,"OFF-1",null,null,"2002"));
        verifyNoInteractions(flows);
    }
    @Test void legacyCallStillSupportsSubjectScopedPagination() {
        service.pageSubscriptionFlows(1,10,null,"2001");
        verify(flows).selectPage(any(Page.class), any());
        verifyNoInteractions(offers);
    }
}
