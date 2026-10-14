package com.agri.production.common.config;

import com.baomidou.mybatisplus.annotation.DbType;
import com.baomidou.mybatisplus.core.handlers.MetaObjectHandler;
import com.baomidou.mybatisplus.extension.plugins.MybatisPlusInterceptor;
import com.baomidou.mybatisplus.extension.plugins.inner.PaginationInnerInterceptor;
import org.apache.ibatis.reflection.MetaObject;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
public class MyBatisPlusConfig {

    /**
     * 分页插件。
     *
     * <p>此前这里只注册了自动填充，**没有注册分页插件** —— 后果是所有
     * {@code Page} 参数被忽略：查询照样返回全表（LIMIT 没生效）、
     * 分页对象里的 total 恒为 0。实测表现是运营端农场列表"共 0 条、却列出了两条"，
     * 前端翻页翻到第 2 页还是同一批数据。</p>
     *
     * <p>数据源已从 SQLite 换到 MySQL，这里显式指定 dbType（MySQL 的分页是 LIMIT，
     * SQLite 也支持 LIMIT，但交给方言判断更稳）。</p>
     */
    @Bean
    public MybatisPlusInterceptor mybatisPlusInterceptor() {
        MybatisPlusInterceptor interceptor = new MybatisPlusInterceptor();
        interceptor.addInnerInterceptor(new PaginationInnerInterceptor(DbType.MYSQL));
        return interceptor;
    }

    @Bean
    public MetaObjectHandler metaObjectHandler() {
        return new MetaObjectHandler() {
            @Override
            public void insertFill(MetaObject metaObject) {
                strictInsertFill(metaObject, "createTime", LocalDateTime::now, LocalDateTime.class);
                strictInsertFill(metaObject, "updateTime", LocalDateTime::now, LocalDateTime.class);
                strictInsertFill(metaObject, "deleted", () -> 0, Integer.class);
            }

            @Override
            public void updateFill(MetaObject metaObject) {
                strictUpdateFill(metaObject, "updateTime", LocalDateTime::now, LocalDateTime.class);
            }
        };
    }
}
