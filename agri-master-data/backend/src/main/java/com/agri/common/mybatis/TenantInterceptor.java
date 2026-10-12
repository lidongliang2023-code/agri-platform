package com.agri.common.mybatis;

import com.agri.common.security.SecurityUtils;
import org.apache.ibatis.executor.Executor;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlSource;
import org.apache.ibatis.plugin.*;
import org.apache.ibatis.session.ResultHandler;
import org.apache.ibatis.session.RowBounds;

import java.lang.reflect.Field;
import java.util.Properties;

@Intercepts({
        @Signature(type = Executor.class, method = "query", args = {MappedStatement.class, Object.class, RowBounds.class, ResultHandler.class}),
        @Signature(type = Executor.class, method = "update", args = {MappedStatement.class, Object.class})
})
public class TenantInterceptor implements Interceptor {

    private static final String TENANT_ID_FIELD = "tenantId";
    private static final String TENANT_ID_COLUMN = "tenant_id";

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        MappedStatement ms = (MappedStatement) invocation.getArgs()[0];
        Object parameter = invocation.getArgs()[1];

        String tenantId = SecurityUtils.getTenantId();
        if (tenantId == null || tenantId.isEmpty()) {
            tenantId = "000000";
        }

        switch (ms.getSqlCommandType()) {
            case INSERT:
                setTenantId(parameter, tenantId);
                break;
            case UPDATE:
                setTenantId(parameter, tenantId);
                break;
            case DELETE:
                break;
            case SELECT:
                BoundSql boundSql = ms.getBoundSql(parameter);
                String sql = boundSql.getSql();
                if (!sql.toUpperCase().contains(TENANT_ID_COLUMN.toUpperCase())) {
                    String newSql = addTenantCondition(sql);
                    SqlSource newSqlSource = createSqlSource(ms, newSql);
                    MappedStatement newMs = copyMappedStatement(ms, newSqlSource);
                    invocation.getArgs()[0] = newMs;
                }
                break;
        }

        return invocation.proceed();
    }

    private void setTenantId(Object parameter, String tenantId) {
        if (parameter == null) {
            return;
        }

        try {
            Field tenantIdField = parameter.getClass().getDeclaredField(TENANT_ID_FIELD);
            tenantIdField.setAccessible(true);
            Object currentValue = tenantIdField.get(parameter);
            if (currentValue == null || currentValue.toString().isEmpty()) {
                tenantIdField.set(parameter, tenantId);
            }
        } catch (NoSuchFieldException e) {
        } catch (IllegalAccessException e) {
        }
    }

    private String addTenantCondition(String sql) {
        if (sql.toUpperCase().contains("WHERE")) {
            return sql + " AND " + TENANT_ID_COLUMN + " = '" + SecurityUtils.getTenantId() + "'";
        } else {
            return sql + " WHERE " + TENANT_ID_COLUMN + " = '" + SecurityUtils.getTenantId() + "'";
        }
    }

    private SqlSource createSqlSource(MappedStatement ms, String sql) {
        return new SqlSource() {
            @Override
            public BoundSql getBoundSql(Object parameterObject) {
                return new BoundSql(ms.getConfiguration(), sql,
                        ms.getBoundSql(parameterObject).getParameterMappings(), parameterObject);
            }
        };
    }

    private MappedStatement copyMappedStatement(MappedStatement ms, SqlSource sqlSource) {
        MappedStatement.Builder builder = new MappedStatement.Builder(ms.getConfiguration(), ms.getId(),
                sqlSource, ms.getSqlCommandType());
        builder.resource(ms.getResource());
        builder.fetchSize(ms.getFetchSize());
        builder.statementType(ms.getStatementType());
        builder.keyGenerator(ms.getKeyGenerator());
        if (ms.getKeyProperties() != null && ms.getKeyProperties().length > 0) {
            builder.keyProperty(ms.getKeyProperties()[0]);
        }
        builder.timeout(ms.getTimeout());
        builder.parameterMap(ms.getParameterMap());
        builder.resultMaps(ms.getResultMaps());
        builder.resultSetType(ms.getResultSetType());
        builder.cache(ms.getCache());
        builder.flushCacheRequired(ms.isFlushCacheRequired());
        builder.useCache(ms.isUseCache());
        return builder.build();
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }

    @Override
    public void setProperties(Properties properties) {
    }
}