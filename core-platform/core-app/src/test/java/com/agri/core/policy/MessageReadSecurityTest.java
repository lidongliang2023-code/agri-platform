package com.agri.core.policy;

import com.agri.core.infra.web.MarketContext;
import com.agri.platform.internal.message.MessageController;
import com.agri.platform.internal.message.MessageEntity;
import com.agri.platform.internal.message.MessageMapper;
import com.agri.shared.exception.BusinessException;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class MessageReadSecurityTest {
    private MessageMapper mapper;
    private MessageController controller;

    @BeforeEach
    void setup() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), "message-security"), MessageEntity.class);
        mapper = mock(MessageMapper.class);
        controller = new MessageController(mapper);
        MarketContext.set(new MarketContext.Session(101L, "owner", 1L, List.of()));
    }

    @AfterEach
    void cleanup() { MarketContext.clear(); }

    private MessageEntity message(Long owner, int read) {
        MessageEntity m = new MessageEntity();
        m.setId(9001L); m.setUserId(owner); m.setReadFlag(read);
        when(mapper.selectById(9001L)).thenReturn(m);
        return m;
    }

    private void denied(int code) {
        assertEquals(code, assertThrows(BusinessException.class, () -> controller.read(9001L)).getCode());
        verify(mapper, never()).update(isNull(), any(com.baomidou.mybatisplus.core.conditions.Wrapper.class));
        verify(mapper, never()).updateById(any(MessageEntity.class));
    }

    @Test void anotherAccountCannotRead() { message(202L, 0); denied(404); }
    @Test void adminCannotReadOthers() {
        MarketContext.set(new MarketContext.Session(101L, "admin", 1L, List.of("SUPER_ADMIN")));
        message(202L, 0); denied(404);
    }
    @Test void missingMessageIsHidden() { denied(404); }
    @Test void nullRecipientIsHidden() { message(null, 0); denied(404); }
    @Test void anonymousCannotUpdate() {
        MarketContext.clear(); denied(401);
        verify(mapper, never()).selectById(anyLong());
    }
    @Test void ownerMayRepeatReadWithScopedUpdate() {
        message(101L, 0);
        controller.read(9001L); controller.read(9001L);
        var captor = org.mockito.ArgumentCaptor.forClass(com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper.class);
        verify(mapper, times(2)).update(isNull(), captor.capture());
        for (var wrapper : captor.getAllValues()) {
            String sql = wrapper.getSqlSegment();
            assertTrue(sql.contains("id =")); assertTrue(sql.contains("user_id ="));
            assertTrue(wrapper.getParamNameValuePairs().containsValue(9001L));
            assertTrue(wrapper.getParamNameValuePairs().containsValue(101L));
            assertTrue(wrapper.getSqlSet().contains("read_flag="));
        }
        verify(mapper, never()).updateById(any(MessageEntity.class));
    }
}
