package com.agri.production.service;

import com.agri.production.dto.FarmBoundaryDTO;
import com.agri.production.entity.Farm;
import com.agri.production.mapper.*;
import com.agri.production.common.exception.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class FarmBoundaryTest {
    static final String VALID = "{\"type\":\"Polygon\",\"coordinates\":[[[120,30],[120.01,30],[120.01,30.01],[120,30.01],[120,30]]]}";
    static String polygon(String ring) { return "{\"type\":\"Polygon\",\"coordinates\":[" + ring + "]}"; }
    @BeforeAll static void mapping() {
        com.baomidou.mybatisplus.core.metadata.TableInfoHelper.initTableInfo(
            new org.apache.ibatis.builder.MapperBuilderAssistant(new com.baomidou.mybatisplus.core.MybatisConfiguration(), "boundary-test"), Farm.class);
    }
    @Test void normalizesValidPolygon() throws Exception {
        var parsed = new ObjectMapper().readTree(FarmBoundaryGeometry.normalize(VALID, false));
        assertEquals("Polygon", parsed.get("type").asText());
        assertEquals(5, parsed.get("coordinates").get(0).size());
    }
    @Test void preservesOmittedBoundaryAndRequiresExplicitClear() {
        assertNull(FarmBoundaryGeometry.normalize(null, false));
        assertNull(FarmBoundaryGeometry.normalize(null, true));
        assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(VALID, true));
        assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize("", false));
    }
    @Test void rejectsMalformedAndWrongGeometry() {
        for (String value : new String[]{"null", "{}", "broken", "{\"type\":\"MultiPolygon\",\"coordinates\":[]}"})
            assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(value, false));
    }
    @Test void rejectsOpenRingAndTooFewVertices() {
        assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(polygon("[[120,30],[121,30],[121,31],[120,31]]"), false));
        assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(polygon("[[120,30],[121,30],[120,30]]"), false));
    }
    @Test void rejectsOutOfRangeAndNonNumericCoordinates() {
        for(String ring : new String[]{"[[181,30],[120,30],[121,31],[181,30]]", "[[120,91],[120,30],[121,31],[120,91]]", "[[\"120\",30],[121,30],[121,31],[\"120\",30]]"})
            assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(polygon(ring), false));
    }
    @Test void rejectsDuplicateCollinearAndSelfIntersectingRings() {
        for(String ring : new String[]{"[[120,30],[121,30],[121,31],[121,30],[120,30]]", "[[120,30],[121,30],[122,30],[120,30]]", "[[120,30],[121,31],[120,31],[121,30],[120,30]]", "[[120,30],[122,30],[121,30],[121,31],[120,30]]"})
            assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(polygon(ring), false));
    }
    @Test void rejectsHolesAndTooManyVertices() {
        assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(VALID.replace("]]}","],[[120,30],[121,30],[121,31],[120,30]]]}"), false));
        String ring="[" + "[120,30],".repeat(501) + "[120,30]]";
        assertThrows(BusinessException.class, () -> FarmBoundaryGeometry.normalize(polygon(ring), false));
    }
    @Test void savesOnlyBoundaryAndReadsDatabaseResult() {
        var mapper=mock(FarmMapper.class);
        var old=new Farm();old.setId(1L);old.setFarmName("原农场");
        var saved=new Farm();saved.setId(1L);saved.setFarmName("原农场");saved.setBoundary(VALID);
        when(mapper.selectById(1L)).thenReturn(old,saved);
        when(mapper.update(isNull(),any())).thenReturn(1);
        var service=new FarmSupervisionService(mapper,mock(FarmComplianceCheckMapper.class),mock(PlotMapper.class));
        var dto=new FarmBoundaryDTO();dto.setBoundary(VALID);
        var result=service.updateBoundary(1L,dto,"运营员");
        assertEquals(VALID,result.getBoundary());
        assertEquals("原农场",result.getFarmName());
        verify(mapper,times(2)).selectById(1L);
        verify(mapper).update(isNull(),argThat(w -> w.getSqlSet().contains("boundary") && !w.getSqlSet().contains("longitude") && !w.getSqlSet().contains("total_area") && !w.getSqlSet().contains("farm_name")));
    }
    @Test void explicitClearAndFailedWrites() {
        var mapper=mock(FarmMapper.class);var farm=new Farm();farm.setId(1L);
        when(mapper.selectById(1L)).thenReturn(farm);
        when(mapper.update(isNull(),any())).thenReturn(1,0);
        var service=new FarmSupervisionService(mapper,mock(FarmComplianceCheckMapper.class),mock(PlotMapper.class));
        var dto=new FarmBoundaryDTO();dto.setClearBoundary(true);
        assertNull(service.updateBoundary(1L,dto,"运营员").getBoundary());
        assertThrows(BusinessException.class, () -> service.updateBoundary(1L,dto,"运营员"));
        assertThrows(BusinessException.class, () -> service.updateBoundary(1L,new FarmBoundaryDTO(),"运营员"));
        assertThrows(BusinessException.class, () -> service.updateBoundary(2L,dto,"运营员"));
    }
}
