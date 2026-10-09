package com.agri.core.infra.web;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

/**
 * 会话上下文（线程级）：由认证过滤器写入，请求结束清理。
 * market_id 内建于核心实体（ADR-005），框架层统一注入，业务开发无感。
 */
public final class MarketContext {

    @Data
    @AllArgsConstructor
    public static class Session {
        private Long userId;
        private String username;
        private Long marketId;
        private List<String> roles;
    }

    private static final ThreadLocal<Session> HOLDER = new ThreadLocal<>();

    private MarketContext() {
    }

    public static void set(Session session) {
        HOLDER.set(session);
    }

    public static Session get() {
        return HOLDER.get();
    }

    public static void clear() {
        HOLDER.remove();
    }

    public static Long currentUserId() {
        Session s = HOLDER.get();
        return s == null ? null : s.getUserId();
    }

    public static Long currentMarketId() {
        Session s = HOLDER.get();
        return s == null ? null : s.getMarketId();
    }

    /** 无会话（后台任务/系统调度）→ 市场隔离拦截器整体旁路，允许跨市场批处理 */
    public static boolean isSystemMode() {
        return HOLDER.get() == null;
    }
}
