package com.agri.produce.internal.message;

import com.agri.shared.result.ApiResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 未读数必须序列化为 JSON <b>数字</b>，不能是字符串。
 *
 * <p>背景：{@code JacksonConfig} 全局把 {@code Long}/{@code long} 序列化成字符串
 * （防止雪花 ID 超出 JS Number 精度，见
 * {@code core-infra/src/main/java/com/agri/core/infra/web/JacksonConfig.java}）。
 *
 * <p>因此若 unread-count 返回 {@code Long}，响应体是 {@code "data":"0"}（字符串）；前端
 * {@code BasicLayout.tsx} 用 {@code unreadCount ?? 0} 兜底，<b>非空字符串不会被该兜底命中</b>，
 * Antd Badge 会把字符串 "0" 当作角标内容渲染，导致没有未读消息时也常驻显示一个红点。
 * 返回值改为 {@code Integer} 后输出 {@code "data":0}（数字），兜底与 Badge 行为均正确。
 *
 * <p>本测试直接复现该序列化规则（与 JacksonConfig 等价），不需要启动容器、不需要数据库。
 */
class UnreadCountSerializationTest {

    /**
     * 复刻 JacksonConfig 对 Long 的处理。
     *
     * @return 与线上同规则的 ObjectMapper
     */
    private ObjectMapper mapper() {
        SimpleModule module = new SimpleModule();
        module.addSerializer(Long.class, ToStringSerializer.instance);
        module.addSerializer(Long.TYPE, ToStringSerializer.instance);
        return new ObjectMapper().registerModule(module);
    }

    @Test
    void integerZeroIsSerializedAsNumber() throws Exception {
        String json = mapper().writeValueAsString(ApiResponse.ok(0));
        assertThat(json).contains("\"data\":0");
        assertThat(json).doesNotContain("\"data\":\"0\"");
    }

    @Test
    void integerNonZeroAlsoNumber() throws Exception {
        assertThat(mapper().writeValueAsString(ApiResponse.ok(1))).contains("\"data\":1");
        assertThat(mapper().writeValueAsString(ApiResponse.ok(12))).contains("\"data\":12");
    }

    @Test
    void longIsSerializedAsString_regressionGuard() throws Exception {
        // 对照组：确认 Long 在此规则下确实变成字符串——这正是常驻红点的根因
        String json = mapper().writeValueAsString(ApiResponse.ok(0L));
        assertThat(json).contains("\"data\":\"0\"");
    }
}
