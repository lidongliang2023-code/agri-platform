package com.agri.production.service;

import com.agri.production.dto.VoiceRecordDraft;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class VoiceExtractionNormalizerTest {
    @Test void dateWithoutTimeRemainsUnknown(){var json=new ObjectMapper().findAndRegisterModules();var result=VoiceExtractionNormalizer.normalize(json,Map.of("draft",Map.of("operatedAt","2026-11-14","durationHours",2)));var d=json.convertValue(result.get("draft"),VoiceRecordDraft.class);assertNull(d.operatedAt());assertEquals(2,d.durationHours().intValue());assertTrue(((java.util.List<?>)result.get("uncertainFields")).contains("operatedAt"));}
    @Test void realClientNullFieldsRemainUnknownInsteadOfBreakingExtraction() {
        var json=new ObjectMapper().findAndRegisterModules();
        var payload=cn.hutool.json.JSONUtil.parseObj("{\"draft\":{\"plotId\":null,\"operatorId\":null,\"quantity\":null,\"operationType\":\"ventilation\",\"durationHours\":2},\"confidence\":0.52,\"uncertainFields\":[\"plotId\",\"operatorId\"],\"evidence\":null}");
        var normalized=VoiceExtractionNormalizer.normalize(json,payload);
        var d=json.convertValue(normalized.get("draft"),VoiceRecordDraft.class);
        assertNull(d.plotId());assertNull(d.operatorId());assertNull(d.quantity());
        assertEquals("ventilation",d.operationType());assertEquals(2,d.durationHours().intValue());assertNull(normalized.get("evidence"));
        assertDoesNotThrow(()->json.writeValueAsString(normalized));
    }
}
