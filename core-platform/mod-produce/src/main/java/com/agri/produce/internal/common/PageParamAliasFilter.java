package com.agri.produce.internal.common;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * 分页参数别名过滤器。
 *
 * <p>平台侧统一分页入参为 {@code page}/{@code size}（见
 * {@code com.agri.shared.result.PageResult}），而前端早期契约使用
 * {@code pageNum}/{@code pageSize}。为避免前端分页请求静默退化为「永远第 1 页、
 * 每页 10 条」，此处在请求进入 Handler 之前把别名补齐为平台标准参数。</p>
 *
 * <p>仅当标准参数缺失时才会用别名填充，不会覆盖调用方显式传入的
 * {@code page}/{@code size}，因此对其它模块无副作用。</p>
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 100)
public class PageParamAliasFilter extends OncePerRequestFilter {

    /** 别名 → 标准参数名。 */
    private static final Map<String, String> ALIAS_TO_STANDARD = Map.of(
            "pageNum", "page",
            "pageSize", "size"
    );

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        HttpServletRequest wrapped = needWrap(request) ? new PageParamAliasRequest(request) : request;
        filterChain.doFilter(wrapped, response);
    }

    /**
     * 判断当前请求是否携带了尚未被解析的别名参数。
     *
     * @param request 原始请求
     * @return true 表示需要包装
     */
    private boolean needWrap(HttpServletRequest request) {
        for (Map.Entry<String, String> entry : ALIAS_TO_STANDARD.entrySet()) {
            String alias = entry.getKey();
            String standard = entry.getValue();
            if (request.getParameter(alias) != null && request.getParameter(standard) == null) {
                return true;
            }
        }
        return false;
    }

    /**
     * 把别名参数映射为标准参数的请求包装器。
     */
    private static final class PageParamAliasRequest extends HttpServletRequestWrapper {

        private final Map<String, String[]> extraParams;

        private PageParamAliasRequest(HttpServletRequest request) {
            super(request);
            Map<String, String[]> extra = new HashMap<>(8);
            for (Map.Entry<String, String> entry : ALIAS_TO_STANDARD.entrySet()) {
                String alias = entry.getKey();
                String standard = entry.getValue();
                String value = request.getParameter(alias);
                if (value != null && request.getParameter(standard) == null) {
                    extra.put(standard, new String[]{value});
                }
            }
            this.extraParams = Collections.unmodifiableMap(extra);
        }

        @Override
        public String getParameter(String name) {
            String[] values = extraParams.get(name);
            if (values != null && values.length > 0) {
                return values[0];
            }
            return super.getParameter(name);
        }

        @Override
        public Map<String, String[]> getParameterMap() {
            Map<String, String[]> merged = new HashMap<>(super.getParameterMap());
            for (Map.Entry<String, String[]> entry : extraParams.entrySet()) {
                merged.putIfAbsent(entry.getKey(), entry.getValue());
            }
            return Collections.unmodifiableMap(merged);
        }

        @Override
        public Enumeration<String> getParameterNames() {
            Set<String> names = new HashSet<>(Collections.list(super.getParameterNames()));
            names.addAll(extraParams.keySet());
            return Collections.enumeration(names);
        }

        @Override
        public String[] getParameterValues(String name) {
            String[] values = extraParams.get(name);
            if (values != null) {
                return values.clone();
            }
            return super.getParameterValues(name);
        }
    }
}
