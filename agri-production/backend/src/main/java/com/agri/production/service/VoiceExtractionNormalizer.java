package com.agri.production.service;

import com.agri.production.dto.VoiceRecordDraft;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;

/** 隔离客户端JSON空值及模型不完整字段，不把未知日期补零点，不猜默认值。 */
public final class VoiceExtractionNormalizer {
    private VoiceExtractionNormalizer(){}
    public static Map<String,Object> normalize(ObjectMapper json,Object value) {
        try {
            Map<String,Object> result=json.readValue(cn.hutool.json.JSONUtil.toJsonStr(value),new TypeReference<Map<String,Object>>(){});
            if(!(result.get("draft") instanceof Map<?,?> raw))throw new IllegalArgumentException("缺少候选字段对象");
            var safe=new LinkedHashMap<String,Object>();
            List<String> uncertain=new ArrayList<>();
            if(result.get("uncertainFields") instanceof List<?> list)list.stream().limit(30).map(Objects::toString).forEach(uncertain::add);
            for(String field:List.of("plotId","operationType","operatedAt","operatorId","areaMu","inputId","quantity","unit","durationHours","description")) {
                Object input=raw.get(field);
                if(input==null){safe.put(field,null);continue;}
                try {
                    // 独立转换每个字段，非法/不完整字段留空，其他候选仍可核对。
                    VoiceRecordDraft checked=json.convertValue(Collections.singletonMap(field,input),VoiceRecordDraft.class);
                    Object normalized=json.convertValue(checked,new TypeReference<Map<String,Object>>(){}).get(field);
                    if(input instanceof String text&&text.isBlank())normalized=null;
                    safe.put(field,normalized);
                }catch(IllegalArgumentException e){safe.put(field,null);if(!uncertain.contains(field))uncertain.add(field);}
            }
            result.put("draft",safe);result.put("uncertainFields",uncertain);
            return result;
        }catch(Exception e){throw new IllegalArgumentException("模型字段不是有效结构化对象",e);}
    }
}
