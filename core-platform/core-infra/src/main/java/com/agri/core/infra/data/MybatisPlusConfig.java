package com.agri.core.infra.data;

import com.agri.core.infra.web.MarketContext;
import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.TenantLineInnerInterceptor;
import lombok.RequiredArgsConstructor;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.LongValue;
import net.sf.jsqlparser.expression.NullValue;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * MyBatis-Plus 拦截器：
 * 1) market_id 行级隔离（ADR-005）——由框架统一拦截注入，业务 SQL 无感；
 * 2) 分页。
 * 系统模式（后台任务/无会话）整体旁路，允许跨市场批处理（如 T+1 结算任务）。
 */
@Configuration
@RequiredArgsConstructor
public class MybatisPlusConfig {

    private final MarketScopeProperties properties;

    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new TenantLineInnerInterceptor(new TenantLineHandler() {
            @Override
            public Expression getTenantId() {
                Long marketId = MarketContext.currentMarketId();
                return marketId == null ? new NullValue() : new LongValue(marketId);
            }

            @Override
            public String getTenantIdColumn() {
                return "market_id";
            }

            @Override
            public boolean ignoreTable(String tableName) {
                if (MarketContext.isSystemMode()) {
                    return true;
                }
                return properties.getIgnoreTables().contains(tableName.toLowerCase());
            }
        }));
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }
}
