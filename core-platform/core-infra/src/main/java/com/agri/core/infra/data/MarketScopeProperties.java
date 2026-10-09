package com.agri.core.infra.data;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 市场隔离配置：无 market_id 语义的全局表必须显式登记在忽略清单。
 */
@Getter
@Setter
@Component
@ConfigurationProperties(prefix = "agri.market")
public class MarketScopeProperties {

    /** 不参与 market_id 自动过滤的表（全局表：用户/角色/用户角色绑定/事件外送/事件消费） */
    private List<String> ignoreTables = List.of(
            "platform_user",
            "platform_role",
            "platform_user_role",
            "platform_outbox_message",
            "platform_consumed_event");
}
