package com.agri.production.service;

import com.agri.common.rbac.*;
import com.agri.production.common.capability.ProductionApiCapabilityInterceptor;
import com.agri.production.common.exception.GlobalExceptionHandler;
import com.agri.production.controller.FarmRectificationController;
import com.agri.production.controller.admin.FarmSupervisionController;
import com.agri.production.entity.*;
import com.agri.production.mapper.*;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.servlet.handler.MappedInterceptor;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup;

/** Runs the real controllers, tenant resolver, capability/RBAC interceptors and service.
 * Only the authoritative platform and persistence adapters are test doubles. */
class FarmRectificationIsolationTest {
    private static final String USER = "/api/v1/production/farm-rectifications";
    private static final String ADMIN = "/api/v1/production/admin/farm-supervision";
    private static final ObjectMapper JSON = new ObjectMapper();
    private HttpServer platform;
    private MockMvc mvc;
    private FarmMapper farms;
    private FarmComplianceCheckMapper checks;
    private FarmComplianceCheck record;
    private TenantContextService previousContext;
    private final List<String> checkedSubjects = new ArrayList<>();

    @BeforeAll static void metadata() {
        for (Class<?> type : List.of(Farm.class, FarmComplianceCheck.class))
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "rectification-isolation"), type);
    }

    @BeforeEach void setup() throws Exception {
        previousContext = (TenantContextService) ReflectionTestUtils.getField(TenantContextService.class, "instance");
        platform = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        platform.createContext("/", exchange -> {
            String token = Objects.toString(exchange.getRequestHeaders().getFirst("Authorization"), "");
            String account = token.replace("Bearer ", "");
            boolean known = Set.of("farmer-a", "colleague-a", "farmer-b", "readonly-a", "ops-read", "ops-write", "unbound", "multi").contains(account);
            String path = exchange.getRequestURI().getPath();
            Object data;
            int status = known ? 200 : 401;
            String merchant = "farmer-b".equals(account) ? "2002" : "2001";
            if (path.endsWith("/merchants/mine")) {
                data = "unbound".equals(account) ? List.of() : "multi".equals(account)
                    ? List.of(binding("2001", account), binding("2002", account)) : List.of(binding(merchant, account));
            } else if (path.endsWith("/permissions/mine")) {
                data = Map.of("permissions", "ops-write".equals(account) ? List.of("production:read", "production:write")
                    : "ops-read".equals(account) ? List.of("production:read") : List.of("produce:read", "produce:write"));
            } else if (path.endsWith("/capability-check")) {
                var body = JSON.readTree(exchange.getRequestBody());
                synchronized (checkedSubjects) { checkedSubjects.add(body.path("merchantId").asText()); }
                boolean granted = Set.of("farmer-a", "colleague-a", "farmer-b", "multi").contains(account);
                data = Map.of("granted", granted, "reason", "当前账号未开通生产管理能力");
            } else if (path.endsWith("/auth/me")) {
                data = Map.of("id", account, "username", account);
            } else { status = 404; data = Map.of(); }
            byte[] body = JSON.writeValueAsBytes(Map.of("code", status == 200 ? 0 : status, "data", data));
            exchange.getResponseHeaders().set("Content-Type", "application/json;charset=UTF-8");
            exchange.sendResponseHeaders(status, body.length);
            try (var output = exchange.getResponseBody()) { output.write(body); }
        });
        platform.start();
        String url = "http://127.0.0.1:" + platform.getAddress().getPort();
        new TenantContextService(url);
        farms = mock(FarmMapper.class); checks = mock(FarmComplianceCheckMapper.class);
        PlotMapper plots = mock(PlotMapper.class);
        Farm farm = new Farm(); farm.setId(410L); farm.setFarmName("隔离测试农场"); farm.setTenantId("2001");
        when(farms.selectById(410L)).thenReturn(farm);
        record = new FarmComplianceCheck(); record.setId(1L); record.setFarmId(410L); record.setFarmName(farm.getFarmName());
        record.setCheckCode("FC-ISOLATION"); record.setTenantId("2001"); record.setCheckResult(2); record.setRectifyStatus("pending");
        when(checks.selectOne(any())).thenAnswer(invocation -> {
            LambdaQueryWrapper<FarmComplianceCheck> wrapper = invocation.getArgument(0);
            wrapper.getSqlSegment();
            return wrapper.getParamNameValuePairs().containsValue("FC-ISOLATION") ? record : null;
        });
        doAnswer(invocation -> {
            Page<FarmComplianceCheck> page = invocation.getArgument(0);
            LambdaQueryWrapper<FarmComplianceCheck> wrapper = invocation.getArgument(1);
            wrapper.getSqlSegment();
            var params = wrapper.getParamNameValuePairs().values();
            // Assert the SQL adapter was supplied a tenant constraint for user lists.
            boolean other = params.contains("2002");
            page.setRecords(other ? List.of() : List.of(record)); page.setTotal(other ? 0 : 1);
            assertTrue(params.contains("2001") || other, "用户台账查询必须包含主体条件");
            return page;
        }).when(checks).selectPage(any(Page.class), any());
        var service = new FarmSupervisionService(farms, checks, plots);
        var admin = new FarmSupervisionController(service);
        ReflectionTestUtils.setField(admin, "platformUrl", url);
        var capability = new ProductionApiCapabilityInterceptor();
        ReflectionTestUtils.setField(capability, "checkUrl", url + "/api/v1/internal/capability-check");
        ReflectionTestUtils.setField(capability, "internalToken", "test-only");
        var properties = new RbacProperties(); properties.setRequireAuth(true);
        properties.setOperatorPaths(List.of("/api/v1/production/admin/**"));
        properties.setReadPermission("production:read"); properties.setWritePermission("production:write");
        var guard = new OperatorGuardInterceptor(new PlatformPermissionResolver(new RestTemplate(), url), properties);
        mvc = standaloneSetup(new FarmRectificationController(service, new FarmIdResolver(farms)), admin)
            .setControllerAdvice(new GlobalExceptionHandler())
            .addInterceptors(new MappedInterceptor(new String[]{"/api/v1/production/**"},
                new String[]{"/api/v1/production/admin/**"}, capability), guard).build();
    }

    private static Map<String,Object> binding(String merchant, String account) {
        return Map.of("merchantId", merchant, "userId", account, "roleInMerchant", "member");
    }
    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, String account, String merchant) {
        return request.header("Authorization", "Bearer " + account).header("X-Merchant-Id", merchant);
    }
    private MockHttpServletRequestBuilder submit(String account, String merchant) {
        return as(post(USER + "/FC-ISOLATION/submit"), account, merchant).contentType(MediaType.APPLICATION_JSON)
            .content("{\"remark\":\"已完成测试整改\",\"actor\":\"伪造运营员\",\"tenantId\":\"2002\"}");
    }
    private MockHttpServletRequestBuilder review(String account) {
        return as(post(ADMIN + "/checks/FC-ISOLATION/review"), account, "2001")
            .contentType(MediaType.APPLICATION_JSON).content("{\"approved\":true,\"remark\":\"测试复核依据充分\",\"actor\":\"伪造审核人\"}");
    }
    private void unchanged() { assertEquals("pending", record.getRectifyStatus()); verify(checks, never()).updateById(any(FarmComplianceCheck.class)); }

    @AfterEach void cleanup() {
        if (platform != null) platform.stop(0);
        RequestContextHolder.resetRequestAttributes();
        ReflectionTestUtils.setField(TenantContextService.class, "instance", previousContext);
    }

    @Test void anonymousCannotReadUserRecord() throws Exception { mvc.perform(get(USER + "/FC-ISOLATION")).andExpect(status().isUnauthorized()); unchanged(); }
    @Test void anonymousCannotReadAdminRecord() throws Exception { mvc.perform(get(ADMIN + "/checks/FC-ISOLATION")).andExpect(status().isUnauthorized()); unchanged(); }
    @Test void anonymousCannotSubmit() throws Exception { mvc.perform(post(USER + "/FC-ISOLATION/submit").contentType(MediaType.APPLICATION_JSON).content("{\"remark\":\"test\"}")).andExpect(status().isUnauthorized()); unchanged(); }
    @Test void ownSubjectCanRead() throws Exception { mvc.perform(as(get(USER + "/FC-ISOLATION"), "farmer-a", "2001")).andExpect(status().isOk()).andExpect(jsonPath("$.data.tenantId").value("2001")); unchanged(); }
    @Test void otherAccountOtherSubjectCannotRead() throws Exception { mvc.perform(as(get(USER + "/FC-ISOLATION"), "farmer-b", "2002")).andExpect(status().isNotFound()); unchanged(); }
    @Test void otherSubjectListIsFiltered() throws Exception { mvc.perform(as(get(USER), "farmer-b", "2002")).andExpect(status().isOk()).andExpect(jsonPath("$.data.total").value(0)); unchanged(); }
    @Test void ownSubjectListIsFiltered() throws Exception { mvc.perform(as(get(USER), "farmer-a", "2001")).andExpect(status().isOk()).andExpect(jsonPath("$.data.records[0].tenantId").value("2001")); unchanged(); }
    @Test void otherSubjectCannotFilterForeignFarm() throws Exception { mvc.perform(as(get(USER).param("farmId", "410"), "farmer-b", "2002")).andExpect(status().isNotFound()); unchanged(); }
    @Test void otherSubjectCannotSubmitKnownCode() throws Exception { mvc.perform(submit("farmer-b", "2002")).andExpect(status().isNotFound()); unchanged(); }
    @Test void forgedMerchantHeaderIsDenied() throws Exception { mvc.perform(submit("farmer-b", "2001")).andExpect(status().isForbidden()); assertTrue(checkedSubjects.isEmpty()); unchanged(); }
    @Test void boundButNoProductionCapabilityCannotSubmit() throws Exception { mvc.perform(submit("readonly-a", "2001")).andExpect(status().isForbidden()); unchanged(); }
    @Test void noSubjectBindingCannotRead() throws Exception { mvc.perform(as(get(USER), "unbound", "2001")).andExpect(status().isForbidden()); unchanged(); }
    @Test void invalidTokenCannotRead() throws Exception { mvc.perform(as(get(USER), "expired", "2001")).andExpect(status().isUnauthorized()); unchanged(); }
    @Test void businessAccountCannotReadOperations() throws Exception { mvc.perform(as(get(ADMIN + "/checks/FC-ISOLATION"), "farmer-a", "2001")).andExpect(status().isForbidden()); unchanged(); }
    @Test void businessAccountCannotReview() throws Exception { mvc.perform(review("farmer-a")).andExpect(status().isForbidden()); unchanged(); }
    @Test void businessAccountCannotRegisterCheck() throws Exception { mvc.perform(as(post(ADMIN + "/checks"), "farmer-a", "2001").contentType(MediaType.APPLICATION_JSON).content("{}" )).andExpect(status().isForbidden()); verify(checks, never()).insert(any(FarmComplianceCheck.class)); unchanged(); }
    @Test void readOnlyOperatorCanRead() throws Exception { mvc.perform(as(get(ADMIN + "/checks/FC-ISOLATION"), "ops-read", "2001")).andExpect(status().isOk()); unchanged(); }
    @Test void readOnlyOperatorCannotReview() throws Exception { mvc.perform(review("ops-read")).andExpect(status().isForbidden()); unchanged(); }
    @Test void productionCapabilityIsRequiredEvenForOperatorUserSubmission() throws Exception { mvc.perform(submit("ops-write", "2001")).andExpect(status().isForbidden()); unchanged(); }
    @Test void allowedSubmissionUsesAuthenticatedActor() throws Exception {
        mvc.perform(submit("farmer-a", "2001")).andExpect(status().isOk()).andExpect(jsonPath("$.data.rectifyStatus").value("reviewing"));
        assertTrue(record.getRectifyRemark().contains("用户 ID：farmer-a")); assertFalse(record.getRectifyRemark().contains("伪造运营员"));
        assertEquals(List.of("2001"), checkedSubjects); verify(checks, times(1)).updateById(record);
    }
    @Test void sameSubjectDifferentAccountMayCollaborate() throws Exception {
        mvc.perform(submit("colleague-a", "2001")).andExpect(status().isOk());
        assertTrue(record.getRectifyRemark().contains("用户 ID：colleague-a")); verify(checks, times(1)).updateById(record);
    }
    @Test void authorizedOperatorCanReviewWithTrustedActor() throws Exception {
        record.setRectifyStatus("reviewing"); mvc.perform(review("ops-write")).andExpect(status().isOk()).andExpect(jsonPath("$.data.rectifyStatus").value("rectified"));
        assertNotNull(record.getRectifiedAt()); assertTrue(record.getRectifyRemark().contains("ops-write"));
        assertFalse(record.getRectifyRemark().contains("伪造审核人")); verify(checks, times(1)).updateById(record);
    }
    @Test void multiSubjectAccountMustChooseSubject() throws Exception {
        mvc.perform(get(USER).header("Authorization", "Bearer multi")).andExpect(status().isBadRequest()); unchanged();
    }
    @Test void multiSubjectAccountCannotUseOtherSubjectForRecord() throws Exception {
        mvc.perform(submit("multi", "2002")).andExpect(status().isNotFound()); assertEquals(List.of("2002"), checkedSubjects); unchanged();
    }
}
