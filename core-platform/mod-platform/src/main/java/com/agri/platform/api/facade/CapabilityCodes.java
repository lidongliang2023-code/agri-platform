package com.agri.platform.api.facade;

import java.util.List;

/**
 * 能力码常量与常用能力集合。
 *
 * <p>放在 facade 包而不是 internal：业务模块只依赖这些"公开契约"，
 * 不 import 平台的内部实现类。</p>
 */
public final class CapabilityCodes {

    public static final String TRADE_WHOLESALE = "trade.wholesale";
    public static final String TRADE_RETAIL = "trade.retail";
    public static final String SUPPLY_FARMER = "supply.farmer";
    public static final String COOP_MANAGE = "coop.manage";
    public static final String SERVICE_PROVIDER = "service.provider";
    public static final String GOV_OVERSIGHT = "gov.oversight";

    /** 生产管理：已加入经营主体 + 已开通农户 / 合作社管理员业务身份（不"加入主体即开通"） */
    public static final String PRODUCTION_MANAGE = "production.manage";
    /** 融资申请：不来自业务身份，来自"经营主体认证通过" */
    public static final String FINANCE_APPLY = "finance.apply";

    /** S2B2C 消费者：已登录并建立消费者档案即可（商城本地判定，核心仅作能力登记） */
    public static final String S2B2C_CONSUMER = "s2b2c.consumer";
    /** S2B2C 供应商：已加入经营主体 + 已开通「商城供应商」业务身份 */
    public static final String S2B2C_SUPPLIER = "s2b2c.supplier";

    /** 发布供货挂牌（SELL）认可的能力 */
    public static final List<String> TRADE_LISTING_SELL = List.of(TRADE_WHOLESALE, SUPPLY_FARMER, COOP_MANAGE);

    /** 发布采购挂牌（BUY）认可的能力 */
    public static final List<String> TRADE_LISTING_BUY = List.of(TRADE_WHOLESALE, TRADE_RETAIL);

    private CapabilityCodes() {
    }
}
