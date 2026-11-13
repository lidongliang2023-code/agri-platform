package com.agri.production.service;

import com.agri.production.dto.FarmCoordinatesDTO;
import com.agri.production.dto.FarmSaveDTO;
import com.agri.production.entity.Farm;
import com.agri.production.mapper.*;
import com.agri.production.common.exception.BusinessException;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class FarmCoordinatesTest {
    @org.junit.jupiter.api.BeforeAll static void initializeMapping() {
        com.baomidou.mybatisplus.core.metadata.TableInfoHelper.initTableInfo(
            new org.apache.ibatis.builder.MapperBuilderAssistant(new com.baomidou.mybatisplus.core.MybatisConfiguration(), "coordinates-test"), Farm.class);
    }
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    private FarmCoordinatesDTO coordinates(String longitude, String latitude) {
        var dto = new FarmCoordinatesDTO();
        if (longitude != null) dto.setLongitude(new BigDecimal(longitude));
        if (latitude != null) dto.setLatitude(new BigDecimal(latitude));
        return dto;
    }
    @Test void validatesRangePairPrecisionAndZero() {
        assertTrue(validator.validate(coordinates("0", "0")).isEmpty());
        assertTrue(validator.validate(coordinates("180", "90")).isEmpty());
        assertFalse(validator.validate(coordinates("180.1", "20")).isEmpty());
        assertFalse(validator.validate(coordinates("120", "90.1")).isEmpty());
        assertFalse(validator.validate(coordinates("120", null)).isEmpty());
        assertFalse(validator.validate(coordinates(null, "20")).isEmpty());
        assertFalse(validator.validate(coordinates("120.123456789", "20")).isEmpty());
        var clear = coordinates(null, null); clear.setClearCoordinates(true);
        assertTrue(validator.validate(clear).isEmpty());
        var conflict = coordinates("120", "20"); conflict.setClearCoordinates(true);
        assertFalse(validator.validate(conflict).isEmpty());
        var farm = new FarmSaveDTO(); farm.setFarmName("测试农场"); farm.setLatitude(new BigDecimal("91"));
        assertFalse(validator.validate(farm).isEmpty());
    }
    @Test void updatesOnlyCoordinatesAndReturnsDatabaseRead() {
        var mapper = mock(FarmMapper.class);
        var service = new FarmSupervisionService(mapper, mock(FarmComplianceCheckMapper.class), mock(PlotMapper.class));
        var old = new Farm(); old.setId(1L); old.setTenantId("2001"); old.setFarmName("原有农场");
        var saved = new Farm(); saved.setId(1L); saved.setFarmName("原有农场"); saved.setTenantId("2001");
        saved.setLongitude(new BigDecimal("120")); saved.setLatitude(new BigDecimal("25"));
        when(mapper.selectById(1L)).thenReturn(old, saved);
        when(mapper.update(isNull(), any())).thenReturn(1);
        var result = service.updateCoordinates(1L, coordinates("120", "25"), "运营员");
        assertEquals(new BigDecimal("120"), result.getLongitude());
        assertEquals(new BigDecimal("25"), result.getLatitude());
        assertEquals("原有农场", result.getFarmName());
        verify(mapper, times(2)).selectById(1L);
        verify(mapper).update(isNull(), argThat(wrapper -> wrapper.getSqlSet().contains("longitude") && wrapper.getSqlSet().contains("latitude") && !wrapper.getSqlSet().contains("farm_name")));
    }
    @Test void rejectsMissingCoordinatesAndFailedUpdate() {
        var mapper = mock(FarmMapper.class);
        var farm = new Farm(); farm.setId(1L);
        when(mapper.selectById(1L)).thenReturn(farm);
        var service = new FarmSupervisionService(mapper, mock(FarmComplianceCheckMapper.class), mock(PlotMapper.class));
        assertThrows(BusinessException.class, () -> service.updateCoordinates(1L, coordinates(null,null), "运营员"));
        assertThrows(BusinessException.class, () -> service.updateCoordinates(1L, coordinates("120","25"), "运营员"));
        verify(mapper, never()).updateById(any(Farm.class));
    }
}
