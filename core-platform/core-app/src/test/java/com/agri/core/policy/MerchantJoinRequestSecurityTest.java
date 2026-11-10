package com.agri.core.policy;

import com.agri.platform.internal.account.*;
import com.agri.platform.internal.merchant.*;
import com.agri.platform.internal.sso.SsoSessionService;
import com.agri.shared.exception.BusinessException;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.baomidou.mybatisplus.core.conditions.Wrapper;
import jakarta.servlet.http.HttpServletRequest;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MerchantJoinRequestSecurityTest {
    @Mock SsoSessionService sessions;
    @Mock UserMerchantMapper bindings;
    @Mock MerchantJoinRequestMapper requests;
    @Mock HttpServletRequest request;
    private SsoAccountController controller;

    @BeforeEach void setup() throws Exception {
        for (Class<?> entity : List.of(UserMerchantEntity.class, MerchantJoinRequestEntity.class)) {
            TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "join-security"), entity);
        }
        var constructor = SsoAccountController.class.getConstructors()[0];
        Object[] args = new Object[constructor.getParameterCount()];
        Class<?>[] types = constructor.getParameterTypes();
        for (int i = 0; i < types.length; i++) args[i] = mock(types[i]);
        controller = (SsoAccountController) constructor.newInstance(args);
        ReflectionTestUtils.setField(controller, "sessionService", sessions);
        ReflectionTestUtils.setField(controller, "userMerchantMapper", bindings);
        ReflectionTestUtils.setField(controller, "joinRequestMapper", requests);
    }

    private void authenticated() { when(sessions.resolve(request)).thenReturn(new long[]{101L, 1L}); }
    private UserMerchantEntity owner(long merchant) {
        UserMerchantEntity entity = new UserMerchantEntity();
        entity.setUserId(101L); entity.setMerchantId(merchant);
        entity.setRoleInMerchant("owner"); entity.setStatus(1);
        return entity;
    }
    private void denied() {
        assertEquals(403, assertThrows(BusinessException.class,
                () -> controller.merchantJoinRequests(3001L, null, request)).getCode());
        verifyNoInteractions(requests);
    }
    @Test void anonymousCannotList() {
        assertEquals(401, assertThrows(BusinessException.class,
                () -> controller.merchantJoinRequests(3001L, null, request)).getCode());
        verifyNoInteractions(bindings, requests);
    }
    @Test void memberOrExternalAccountCannotList() {
        authenticated(); when(bindings.selectList(any(Wrapper.class))).thenReturn(List.of()); denied();
    }
    @Test void otherMerchantOwnerCannotList() {
        authenticated(); when(bindings.selectList(any(Wrapper.class))).thenReturn(List.of(owner(4001L))); denied();
    }
    @Test void ownerQueryRequiresActiveAccountBinding() {
        authenticated();
        when(bindings.selectList(any(Wrapper.class))).thenAnswer(invocation -> {
            Wrapper<?> wrapper = invocation.getArgument(0);
            String sql = wrapper.getSqlSegment();
            assertTrue(sql.contains("user_id =")); assertTrue(sql.contains("status ="));
            assertTrue(sql.contains("role_in_merchant ="));
            var values = ((com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<?>) wrapper).getParamNameValuePairs().values();
            assertTrue(values.contains(101L)); assertTrue(values.contains(1)); assertTrue(values.contains("owner"));
            return List.of();
        });
        denied();
    }
    @Test void ownerCanListOnlyRequestedMerchantAndStatus() {
        authenticated(); when(bindings.selectList(any(Wrapper.class))).thenReturn(List.of(owner(3001L)));
        when(requests.selectList(any(Wrapper.class))).thenAnswer(invocation -> {
            var wrapper = (com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper<?>) invocation.getArgument(0);
            String sql = wrapper.getSqlSegment();
            assertTrue(sql.contains("merchant_id =")); assertTrue(sql.contains("status ="));
            assertTrue(wrapper.getParamNameValuePairs().containsValue(3001L));
            assertTrue(wrapper.getParamNameValuePairs().containsValue("pending"));
            return List.of();
        });
        assertNotNull(controller.merchantJoinRequests(3001L, "pending", request));
        verify(requests).selectList(any(Wrapper.class));
    }
}
