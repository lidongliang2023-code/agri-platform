package com.agri.production.service;

import com.agri.production.dto.FarmPageDTO;
import org.apache.ibatis.builder.xml.XMLMapperBuilder;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.session.Configuration;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class FarmListQueryTest {
    private BoundSql query(FarmPageDTO dto) throws Exception {
        Configuration configuration = new Configuration();
        String resource = "mapper/FarmMapper.xml";
        try (var input = getClass().getClassLoader().getResourceAsStream(resource)) {
            assertNotNull(input);
            new XMLMapperBuilder(input, configuration, resource, configuration.getSqlFragments()).parse();
        }
        return configuration.getMappedStatement("com.agri.production.mapper.FarmMapper.pageQuery")
                .getBoundSql(Map.of("dto", dto, "tenantId", "tenant-list-test"));
    }

    @Test void filtersBusinessTypeInThePaginatedQuery() throws Exception {
        FarmPageDTO dto = new FarmPageDTO();
        dto.setTypeLabel("水稻种植");
        BoundSql sql = query(dto);
        assertTrue(sql.getSql().contains("LOCATE('产业类型:'"));
        assertTrue(sql.getParameterMappings().stream().anyMatch(p -> p.getProperty().equals("dto.typeLabel")));
        assertFalse(sql.getSql().contains("水稻种植"), "类型值必须参数化，不能拼入 SQL");
        assertTrue(sql.getSql().indexOf("COALESCE(") < sql.getSql().indexOf("ORDER BY"));
        assertTrue(sql.getSql().contains("tenant_id = ?"));
    }

    @Test void combinesKeywordDisabledStatusAndBusinessType() throws Exception {
        FarmPageDTO dto = new FarmPageDTO();
        dto.setKeyword("FRM001");
        dto.setStatus("0");
        dto.setTypeLabel("蔬菜种植");
        BoundSql sql = query(dto);
        assertEquals("inactive", dto.getStatus());
        var properties = sql.getParameterMappings().stream().map(p -> p.getProperty()).toList();
        assertTrue(properties.containsAll(java.util.List.of("tenantId", "dto.keyword", "dto.status", "dto.typeLabel")));
        assertTrue(sql.getSql().contains("OR farm_code LIKE"));
    }

    @Test void omitsTypeFilterWhenReset() throws Exception {
        FarmPageDTO dto = new FarmPageDTO();
        assertFalse(query(dto).getSql().contains("LOCATE("));
        dto.setTypeLabel("");
        assertFalse(query(dto).getSql().contains("LOCATE("));
    }
}
