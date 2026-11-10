package com.agri.production.service;

import com.agri.common.rbac.PermissionResolver;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.mapper.*;
import com.agri.production.service.impl.IoTServiceImpl;
import org.junit.jupiter.api.*;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class SensorDataSecurityTest {
    SensorDataMapper mapper;
    PermissionResolver permissions;
    IoTServiceImpl service;
    MockHttpServletRequest request;
    MockRestServiceServer platform;

    @BeforeEach void setup() {
        TenantContextService tenant = new TenantContextService("http://platform.test");
        platform = MockRestServiceServer.bindTo((RestTemplate) ReflectionTestUtils.getField(tenant, "restTemplate")).build();
        request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer test-token");
        request.addHeader("X-Merchant-Id", "2001");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        mapper = mock(SensorDataMapper.class);
        permissions = mock(PermissionResolver.class);
        when(permissions.currentPermissions()).thenReturn(Set.of("iot:read"));
        service = new IoTServiceImpl(mock(IoTDeviceMapper.class), mapper, mock(AlertRuleMapper.class),
                mock(IAlertService.class), mock(IProductionNotificationService.class), permissions);
    }
    @AfterEach void cleanup() { RequestContextHolder.resetRequestAttributes(); }
    void binding() {
        platform.expect(requestTo("http://platform.test/api/v1/platform/merchants/mine"))
                .andRespond(withSuccess("{\"code\":0,\"data\":[{\"merchantId\":2001,\"userId\":17}]}", MediaType.APPLICATION_JSON));
    }
    @Test void anonymousCannotReadEvenEmptyBatch() {
        request.removeHeader("Authorization");
        assertEquals(401, assertThrows(BusinessException.class, () -> service.getLatestData(List.of())).getCode());
        verifyNoInteractions(mapper);
    }
    @Test void forgedTokenCannotRead() {
        platform.expect(org.springframework.test.web.client.ExpectedCount.twice(), anything())
                .andRespond(withStatus(org.springframework.http.HttpStatus.UNAUTHORIZED));
        assertEquals(401, assertThrows(BusinessException.class, () -> service.getLatestData(List.of(1L))).getCode());
        verifyNoInteractions(mapper);
    }
    @Test void missingPermissionCannotRead() {
        binding(); when(permissions.currentPermissions()).thenReturn(Set.of("finance:read"));
        assertEquals(403, assertThrows(BusinessException.class, () -> service.getLatestData(List.of(1L))).getCode());
        verifyNoInteractions(mapper);
    }
    @Test void failedPermissionResolutionCannotRead() {
        binding(); when(permissions.currentPermissions()).thenReturn(null);
        assertEquals(403, assertThrows(BusinessException.class, () -> service.getLatestData(List.of(1L))).getCode());
        verifyNoInteractions(mapper);
    }
    @Test void latestQueryUsesAuthenticatedTenantAndDeduplicatesIds() {
        binding(); when(mapper.getLatestByDevice(List.of(1L, 2L), "2001")).thenReturn(List.of());
        service.getLatestData(List.of(1L, 2L, 1L));
        verify(mapper).getLatestByDevice(List.of(1L, 2L), "2001");
    }
    @Test void historyAndAggregatesUseAuthenticatedTenant() {
        binding(); service.getSensorHistory(1L, null, null);
        service.getHourlyAverage(1L, null, null); service.getDeviceStatistics(1L, null, null);
        verify(mapper).selectByDeviceId(1L, null, null, "2001");
        verify(mapper).getHourlyAverage(1L, null, null, "2001");
        verify(mapper).getStatistics(1L, null, null, "2001");
    }
    @Test void cannotSelectUnboundTenant() {
        request.removeHeader("X-Merchant-Id"); request.addHeader("X-Merchant-Id", "2003"); binding();
        assertEquals(403, assertThrows(BusinessException.class, () -> service.getLatestData(List.of(1L))).getCode());
        verifyNoInteractions(mapper);
    }
    @Test void invalidDeviceIdsRejectedBeforeQuery() {
        binding();
        assertEquals(400, assertThrows(BusinessException.class, () -> service.getLatestData(List.of(-1L))).getCode());
        verifyNoInteractions(mapper);
    }
    @Test void inputTenantCannotOverrideAuthenticatedTenant() {
        binding(); var data = new com.agri.production.entity.SensorData(); data.setTenantId("2003");
        service.saveSensorData(data);
        assertEquals("2001", data.getTenantId()); verify(mapper).insert(data);
    }
}
