package com.agri.production.service;

import com.agri.production.common.exception.FarmNotFoundException;
import com.agri.production.common.exception.GlobalExceptionHandler;
import com.agri.production.dto.FarmSaveDTO;
import com.agri.production.entity.Farm;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.service.impl.FarmServiceImpl;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class FarmNotFoundTest {
    private final FarmMapper mapper = mock(FarmMapper.class);
    private final FarmServiceImpl service = new FarmServiceImpl();

    FarmNotFoundTest() {
        ReflectionTestUtils.setField(service, "baseMapper", mapper);
    }

    @Test
    void missingFarmReturnsNotFound() {
        assertEquals(404, assertThrows(FarmNotFoundException.class,
                () -> service.getById(1L, "2001")).getCode());
    }

    @Test
    void foreignFarmReturnsSameNotFound() {
        Farm farm = new Farm();
        farm.setTenantId("2001");
        when(mapper.selectById(1L)).thenReturn(farm);
        assertEquals("农场不存在", assertThrows(FarmNotFoundException.class,
                () -> service.getById(1L, "2003")).getMessage());
    }

    @Test
    void ownFarmRemainsReadable() {
        Farm farm = new Farm();
        farm.setId(1L);
        farm.setTenantId("2001");
        farm.setFarmName("本主体农场");
        when(mapper.selectById(1L)).thenReturn(farm);
        assertEquals(1L, service.getById(1L, "2001").getId());
    }

    @Test
    void missingCodeReturnsNotFound() {
        assertThrows(FarmNotFoundException.class, () -> service.getByCode("MISSING", "2001"));
    }

    @Test
    void foreignUpdateAndDeleteReturnNotFoundWithoutWriting() {
        Farm farm = new Farm();
        farm.setTenantId("2001");
        when(mapper.selectById(1L)).thenReturn(farm);
        FarmSaveDTO dto = new FarmSaveDTO();
        dto.setId(1L);
        assertThrows(FarmNotFoundException.class, () -> service.update(dto, "2003"));
        assertThrows(FarmNotFoundException.class, () -> service.delete(1L, "2003"));
        verify(mapper, times(2)).selectById(1L);
        verifyNoMoreInteractions(mapper);
    }

    @RestController
    static class MissingFarmController {
        @GetMapping("/test/farm-not-found")
        public void missing() {
            throw new FarmNotFoundException();
        }
    }

    @Test
    void exceptionHandlerReturnsHttp404AndBusiness404() throws Exception {
        MockMvc mvc = MockMvcBuilders.standaloneSetup(new MissingFarmController())
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(get("/test/farm-not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value(404))
                .andExpect(jsonPath("$.message").value("农场不存在"))
                .andExpect(jsonPath("$.data").isEmpty());
    }
}
