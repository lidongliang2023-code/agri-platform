package com.agri.satellite.ai;

import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 进程内滑动窗口限流（单实例起步；多实例部署时替换为 Redis 令牌桶）。
 */
@Component
public class RateLimiter {

    private final Map<String, Deque<Long>> windows = new ConcurrentHashMap<>();

    public boolean allow(String scenario, int limitPerMinute) {
        long now = System.currentTimeMillis();
        Deque<Long> window = windows.computeIfAbsent(scenario, k -> new ArrayDeque<>());
        synchronized (window) {
            while (!window.isEmpty() && now - window.peekFirst() > 60_000) {
                window.pollFirst();
            }
            if (window.size() >= limitPerMinute) {
                return false;
            }
            window.addLast(now);
            return true;
        }
    }
}
