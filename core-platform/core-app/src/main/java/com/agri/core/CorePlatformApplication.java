package com.agri.core;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * 核心业务层 · 单一部署单元（模块化单体，ADR-001）。
 * 模块间仅经 API + 领域事件通信，由 ArchUnit 门禁强制；卫星服务见 satellite-* 模块。
 *
 * <p>{@code @MapperScan} 必须显式列举各业务模块的 {@code internal} 包：
 * MyBatis-Spring-Boot 的自动扫描只覆盖自动配置包（即 {@code com.agri.core}），
 * 而各模块 Mapper 位于 {@code com.agri.platform.internal} 等包下，
 * 不显式声明会导致 {@code NoSuchBeanDefinitionException}（如 AdminUserInitializer 注入
 * UserMapper 失败）、应用无法启动。</p>
 *
 * <p>{@code annotationClass = Mapper.class} 是必要的收窄条件：ClassPathMapperScanner 会把
 * 扫描路径下<strong>所有接口</strong>都注册成 Mapper Bean，而 {@code com.agri.core.infra.event}
 * 下还有 {@code EventTransport} / {@code TopicListener} 这类非 Mapper 接口，一旦被注册，
 * {@code OutboxRelay} 注入 {@code EventTransport} 会出现两个候选、报
 * {@code NoUniqueBeanDefinitionException}。全仓 56 个 Mapper 均带 {@code @Mapper} 注解，
 * 按注解过滤即可精确命中。</p>
 */
@EnableScheduling
@MapperScan(
        basePackages = {
                "com.agri.core.infra",
                "com.agri.platform.internal",
                "com.agri.produce.internal",
                "com.agri.service.internal",
                "com.agri.trade.internal"
        },
        annotationClass = Mapper.class
)
@SpringBootApplication(scanBasePackages = "com.agri")
public class CorePlatformApplication {

    public static void main(String[] args) {
        SpringApplication.run(CorePlatformApplication.class, args);
    }
}
