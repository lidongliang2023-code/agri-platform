package com.agri.iot.support;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SamplingPolicyTest {
    @Test
    void metricPolicyOverridesDeviceDefaultAndUnconfiguredFallsBack() {
        SamplingPolicy policy = SamplingPolicy.read("""
                {"reportInterval":30,"samplingToleranceSeconds":5,
                 "samplingByMetric":{"temperature":{"reportInterval":10,"samplingToleranceSeconds":2}}}
                """);

        assertEquals(10, policy.policyFor("temperature").intervalSeconds());
        assertEquals(2, policy.policyFor("temperature").toleranceSeconds());
        assertEquals(30, policy.policyFor("humidity").intervalSeconds());
        assertEquals(5, policy.policyFor("humidity").toleranceSeconds());
        assertEquals(12, policy.policyFor("temperature").maxGapSeconds(600));
        assertEquals(35, policy.policyFor("humidity").maxGapSeconds(600));
    }

    @Test
    void invalidMetricToleranceIsRejectedAndOldConfigStillReads() {
        assertThrows(IllegalArgumentException.class, () -> SamplingPolicy.validate(SamplingPolicy.object(
                "{\"samplingByMetric\":{\"temperature\":{\"reportInterval\":10,\"samplingToleranceSeconds\":11}}}")));
        SamplingPolicy old = SamplingPolicy.read("{\"reportInterval\":60,\"samplingToleranceSeconds\":10}");
        assertTrue(old.byMetric().isEmpty());
        assertEquals(60, old.policyFor("temperature").intervalSeconds());
    }

    @Test
    void normalizeRefreshesOnlyChangedMetricEffectiveTime() {
        String previous = "{\"reportInterval\":30,\"samplingToleranceSeconds\":5,"
                + "\"samplingEffectiveAt\":\"2026-11-13T10:00:00\","
                + "\"samplingByMetric\":{\"temperature\":{\"reportInterval\":10,\"samplingToleranceSeconds\":2,"
                + "\"samplingEffectiveAt\":\"2026-11-13T10:00:00\"}}}";
        String next = SamplingPolicy.normalize("{\"reportInterval\":30,\"samplingToleranceSeconds\":5,"
                + "\"samplingByMetric\":{\"temperature\":{\"reportInterval\":20,\"samplingToleranceSeconds\":2},"
                + "\"humidity\":{\"reportInterval\":15,\"samplingToleranceSeconds\":0}}}", previous, false);
        SamplingPolicy policy = SamplingPolicy.read(next);
        assertEquals(20, policy.policyFor("temperature").intervalSeconds());
        assertEquals(15, policy.policyFor("humidity").intervalSeconds());
        assertNotNull(policy.byMetric().get("temperature").effectiveAt());
        assertNotNull(policy.byMetric().get("humidity").effectiveAt());
        assertEquals(30, policy.intervalSeconds());
        assertEquals(5, policy.toleranceSeconds());
    }
}
