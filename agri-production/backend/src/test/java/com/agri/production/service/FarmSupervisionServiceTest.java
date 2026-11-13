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

    private com.agri.production.controller.admin.FarmSupervisionController controller(FarmSupervisionService source) {
        var controller = new com.agri.production.controller.admin.FarmSupervisionController(source);
        org.springframework.test.util.ReflectionTestUtils.setField(controller, "platformUrl", "http://platform.test");
        return controller;
    }

    private org.springframework.test.web.client.MockRestServiceServer platform(com.agri.production.controller.admin.FarmSupervisionController controller) {
        return org.springframework.test.web.client.MockRestServiceServer.bindTo(
            (org.springframework.web.client.RestTemplate) org.springframework.test.util.ReflectionTestUtils.getField(controller, "rest")).build();
    }

    @Test
    void supervisionListResolvesEachSubjectOnceWithoutChangingIds() {
        var source = mock(FarmSupervisionService.class);
        var first = com.agri.production.vo.FarmVO.of(farm(1L, "2001"));
        var second = com.agri.production.vo.FarmVO.of(farm(2L, "2001"));
        var third = com.agri.production.vo.FarmVO.of(farm(3L, "2002"));
        when(source.farms(1, 20, null, null, null)).thenReturn(
            com.agri.production.common.entity.PageResult.of(List.of(first, second, third), 3L, 1, 20));
        var controller = controller(source);
        var server = platform(controller);
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2001"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess("{\"code\":0,\"data\":{\"name\":\"示范农业公司\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2002"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess("{\"code\":0,\"data\":{\"name\":\"绿田合作社\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        controller.farms(1, 20, null, null, null);
        assertEquals("示范农业公司", first.getTenantName());
        assertEquals(first.getTenantName(), second.getTenantName());
        assertEquals("绿田合作社", third.getTenantName());
        assertEquals("2001", first.getTenantId());
        server.verify();
    }

    @Test
    void supervisionDetailResolvesSubjectName() {
        var source = mock(FarmSupervisionService.class);
        var farm = com.agri.production.vo.FarmVO.of(farm(1L, "2001"));
        when(source.detail(1L)).thenReturn(new LinkedHashMap<>(Map.of("farm", farm)));
        var controller = controller(source);
        var server = platform(controller);
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2001"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess("{\"code\":0,\"data\":{\"name\":\"示范农业公司\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        controller.detail(1L);
        assertEquals("示范农业公司", farm.getTenantName());
        server.verify();
    }

    @Test
    void supervisionMapResolvesSubjectAndDistinguishesMissingAssociation() {
        var source = mock(FarmSupervisionService.class);
        var row = new LinkedHashMap<String,Object>(Map.of("farmId", 1L, "tenantId", "2001"));
        var unbound = new LinkedHashMap<String,Object>(Map.of("farmId", 2L));
        when(source.mapPoints(null)).thenReturn(List.of(row, unbound));
        var controller = controller(source);
        var server = platform(controller);
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2001"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess("{\"code\":0,\"data\":{\"name\":\"示范农业公司\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        controller.map();
        assertEquals("示范农业公司", row.get("tenantName"));
        assertEquals("未关联经营主体", unbound.get("tenantName"));
        server.verify();
    }

    @Test
    void unavailableSubjectServiceKeepsFarmRowsAndStopsRepeatedFailures() {
        var source = mock(FarmSupervisionService.class);
        var first = com.agri.production.vo.FarmVO.of(farm(1L, "2001"));
        var second = com.agri.production.vo.FarmVO.of(farm(2L, "2002"));
        when(source.farms(1, 20, null, null, null)).thenReturn(
            com.agri.production.common.entity.PageResult.of(List.of(first, second), 2L, 1, 20));
        var controller = controller(source);
        var server = platform(controller);
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2001"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withServerError());
        controller.farms(1, 20, null, null, null);
        assertEquals("主体名称暂不可用", first.getTenantName());
        assertEquals("主体名称暂不可用", second.getTenantName());
        assertEquals("2002", second.getTenantId());
        server.verify();
    }

    @Test
    void deletedSubjectDoesNotPreventResolvingOtherSubjects() {
        var source = mock(FarmSupervisionService.class);
        var deleted = com.agri.production.vo.FarmVO.of(farm(1L, "2001"));
        var existing = com.agri.production.vo.FarmVO.of(farm(2L, "2002"));
        when(source.farms(1, 20, null, null, null)).thenReturn(
            com.agri.production.common.entity.PageResult.of(List.of(deleted, existing), 2L, 1, 20));
        var controller = controller(source);
        var server = platform(controller);
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2001"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withStatus(org.springframework.http.HttpStatus.NOT_FOUND));
        server.expect(org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo("http://platform.test/api/v1/admin/merchants/2002"))
            .andRespond(org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess("{\"code\":0,\"data\":{\"name\":\"绿田合作社\"}}", org.springframework.http.MediaType.APPLICATION_JSON));
        controller.farms(1, 20, null, null, null);
        assertEquals("主体已注销或不存在", deleted.getTenantName());
        assertEquals("绿田合作社", existing.getTenantName());
        server.verify();
    }
}
