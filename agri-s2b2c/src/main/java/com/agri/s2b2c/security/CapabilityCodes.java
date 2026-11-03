package com.agri.s2b2c.security;

/**
 * S2B2C 用到的能力码。
 *
 * <p>渠道能力与消费者/供应商不同：`s2b2c.channel` 的判定依据（渠道入驻审核状态）只存在本库，
 * 核心平台看不到，因此它由本子系统在 {@link com.agri.s2b2c.service.ChannelIdentityService} 里落地，
 * 不放进核心的能力清单 —— 避免出现"核心显示已具备、商城却拒绝"的两套口径。</p>
 */
public final class CapabilityCodes {

    public static final String S2B2C_CONSUMER = "s2b2c.consumer";
    public static final String S2B2C_SUPPLIER = "s2b2c.supplier";
    /** 渠道合伙人：入驻审核通过后可择品、看佣金 */
    public static final String S2B2C_CHANNEL = "s2b2c.channel";

    private CapabilityCodes() {
    }
}
