package com.agri.core.infra.web;

import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.format.DateTimeFormatter;

/**
 * Jackson 全局序列化：
 * 1) Long → String，避免雪花 ID 超出 JS Number 精度；
 * 2) LocalDateTime 统一格式。
 */
@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> builder
                .serializerByType(Long.class, ToStringSerializer.instance)
                .serializerByType(Long.TYPE, ToStringSerializer.instance)
                .serializers(new LocalDateTimeSerializer(DATE_TIME))
                // 反序列化放宽：既认 yyyy-MM-dd HH:mm:ss，也认前端 dayjs 产出的
                // yyyy-MM-dd'T'HH:mm:ss —— 否则带时间字段的提交一律 400
                .deserializers(new LenientLocalDateTimeDeserializer());
    }
}
