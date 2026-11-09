package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import java.time.LocalDate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class FarmSupervisionServiceTest {
    FarmMapper farms = mock(FarmMapper.class);
    FarmComplianceCheckMapper checks = mock(FarmComplianceCheckMapper.class);
    PlotMapper plots = mock(PlotMapper.class);
    FarmSupervisionService service;

    @BeforeEach
    void setup() {
        service = new FarmSupervisionService(farms, checks, plots);
    }

    private Farm farm(Long id, String tenant) {
        Farm f = new Farm();
        f.setId(id);
        f.setFarmName("示范农场");
        f.setTenantId(tenant);
        f.setStatus("active");
        return f;
    }

    private FarmComplianceCheck check(String code, Long farmId, String tenant, String status, Integer result) {
        FarmComplianceCheck c = new FarmComplianceCheck();
        c.setId(101L);
        c.setCheckCode(code);
        c.setFarmId(farmId);
        c.setFarmName("示范农场");
        c.setTenantId(tenant);
        c.setRectifyStatus(status);
        c.setCheckResult(result);
        c.setRectifyRequirement("停止违规");
        return c;
    }

    @Test
    void rejectsCheckWhenFarmBelongsToOtherTenant() {
        when(farms.selectById(1L)).thenReturn(farm(1L, "T_OTHER"));
        assertThrows(BusinessException.class, () -> service.owned(1L, "2001"));
    }

    @Test
    void createRequiresValidResultAndDeadline() {
        when(farms.selectById(1L)).thenReturn(farm(1L, "2001"));
        assertThrows(BusinessException.class, () -> service.create(Map.of("farmId", "1", "result", "4"), "OP"));
        assertThrows(BusinessException.class, () -> service.create(Map.of("farmId", "1", "result", "2", "checkType", "常规", "checkItem", "项"), "OP"));
    }

    @Test
    void submitAndReviewTransitions() {
        when(farms.selectById(1L)).thenReturn(farm(1L, "2001"));
        FarmComplianceCheck c = check("FC1", 1L, "2001", "pending", 2);
        when(checks.selectOne(any())).thenReturn(c);
        service.submit("FC1", "2001", "已完成清理并留存记录", "张农户 · farmer");
        assertEquals("reviewing", c.getRectifyStatus());
        assertTrue(c.getRectifyRemark().contains("整改提交"));

        // 复核通过
        service.review("FC1", true, "复核现场依据充分，准予通过", "运营员 · admin");
        assertEquals("rectified", c.getRectifyStatus());
        assertNotNull(c.getRectifiedAt());

        // 状态已变化，禁止重复复核
        assertThrows(BusinessException.class, () -> service.review("FC1", true, "再次通过", "运营员"));
    }

    @Test
    void rejectTransitionReturnsToProcessing() {
        when(farms.selectById(1L)).thenReturn(farm(1L, "2001"));
        FarmComplianceCheck c = check("FC2", 1L, "2001", "reviewing", 2);
        when(checks.selectOne(any())).thenReturn(c);
        service.review("FC2", false, "凭证不足，要求重新整改", "运营员 · admin");
        assertEquals("processing", c.getRectifyStatus());
        assertNull(c.getRectifiedAt());
        assertTrue(c.getRectifyRemark().contains("退回整改"));
    }

    @Test
    void otherTenantCannotSubmit() {
        when(farms.selectById(1L)).thenReturn(farm(1L, "2001"));
        FarmComplianceCheck c = check("FC3", 1L, "2001", "pending", 2);
        when(checks.selectOne(any())).thenReturn(c);
        assertThrows(BusinessException.class, () -> service.submit("FC3", "OTHER_TENANT", "越权提交", "黑客"));
    }
}
