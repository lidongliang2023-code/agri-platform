package com.agri.platform.internal.account;

import com.agri.platform.api.facade.CapabilityCodes;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 业务身份 → 平台能力 的映射表。
 *
 * <p><b>为什么要有这一层</b>：身份申请审核通过以前只改单据状态，业务侧无感知，
 * 等于"申请了也没用"。能力层把「身份」翻译成「能做什么」，供业务模块做前置校验
 * （例如交易域发布挂牌要求具备交易类能力）。</p>
 *
 * <p>映射是一对一的、写死的：身份类型是审核口径，能力码是程序口径，两者分开后
 * 以后要调整"某身份给哪些能力"只改这里，不用动审核与业务的代码。</p>
 */
public final class BusinessCapabilities {

    /** 能力定义：code 给程序用，label 给用户看，identity 是该能力的来源身份 */
    public record Definition(String code, String label, String identityCode,
                             String identityLabel, String description) {
    }

    private static final List<Definition> ALL = List.of(
            new Definition(CapabilityCodes.TRADE_WHOLESALE, "批发交易", "wholesaler", "批发商",
                    "发布大宗供货、批量采购挂牌并参与撮合"),
            new Definition(CapabilityCodes.TRADE_RETAIL, "零售经营", "retailer", "零售商",
                    "零售商品上架与零售订单处理"),
            new Definition(CapabilityCodes.SUPPLY_FARMER, "农户直供", "farmer", "农户",
                    "以农户身份发布直供货源"),
            new Definition(CapabilityCodes.COOP_MANAGE, "合作社管理", "coop_admin", "合作社管理员",
                    "统一管理合作社成员与统一销售"),
            new Definition(CapabilityCodes.SERVICE_PROVIDER, "服务接单", "service_provider", "服务商",
                    "承接农机、植保等农业服务订单"),
            new Definition(CapabilityCodes.GOV_OVERSIGHT, "监管协同", "government", "政府人员",
                    "查看辖区监管数据与协同任务"),
            // 下面两个不来自业务身份：identityCode 为空，能力由主体/认证数据推导
            new Definition(CapabilityCodes.PRODUCTION_MANAGE, "生产管理", "", "已加入经营主体",
                    "维护农事计划、批次、设备与溯源数据"),
            new Definition(CapabilityCodes.FINANCE_APPLY, "融资申请", "", "经营主体认证通过",
                    "以认证主体身份申请供应链金融产品"),
            new Definition(CapabilityCodes.S2B2C_CONSUMER, "商城消费", "", "已登录账号",
                    "在 S2B2C 商城下单、使用购物车与收货地址"),
            new Definition(CapabilityCodes.S2B2C_SUPPLIER, "商城供应商", "", "交易类业务身份 + 经营主体",
                    "在 S2B2C 商城上架商品、处理订单与结算"));

    private static final Map<String, Definition> BY_CODE;
    private static final Map<String, Definition> BY_IDENTITY;

    static {
        Map<String, Definition> byCode = new LinkedHashMap<>();
        Map<String, Definition> byIdentity = new LinkedHashMap<>();
        for (Definition definition : ALL) {
            byCode.put(definition.code(), definition);
            if (!definition.identityCode().isEmpty()) {
                byIdentity.put(definition.identityCode(), definition);
            }
        }
        BY_CODE = Map.copyOf(byCode);
        BY_IDENTITY = Map.copyOf(byIdentity);
    }

    private BusinessCapabilities() {
    }

    public static List<Definition> all() {
        return ALL;
    }

    public static Definition byCode(String code) {
        return BY_CODE.get(code);
    }

    public static Definition ofIdentity(String identityCode) {
        return BY_IDENTITY.get(identityCode);
    }
}
