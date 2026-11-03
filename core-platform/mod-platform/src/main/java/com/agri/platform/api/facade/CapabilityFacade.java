package com.agri.platform.api.facade;

import java.util.Collection;
import java.util.List;

/**
 * 业务能力门面：业务模块用它做"这个人能不能干这件事"的前置校验。
 *
 * <p>能力来源是**已审核通过的业务身份**（见 {@code BusinessCapabilities}）。
 * 模块不直接读身份表，避免每个模块各写一套"哪些身份算批发商"的判断 —— 那种判断一旦分散，
 * 审核口径一改就会漏改一半。</p>
 */
public interface CapabilityFacade {

    /** 账号当前已开通的能力码 */
    List<String> codesOf(Long userId);

    /** 单条能力的判定结果：granted=false 时 reason 说明缺什么 */
    record Decision(boolean granted, String reason) {
    }

    /**
     * 判定单个能力。
     *
     * @param merchantId 业务动作所属主体；为空表示只判"账号层面"（任一主体满足即可）
     */
    Decision check(Long userId, String capabilityCode, Long merchantId);

    /** 是否具备其中任意一项能力；userId 为空一律返回 false */
    boolean hasAny(Long userId, Collection<String> capabilityCodes);

    /**
     * 前置校验：不具备时抛业务异常（403），消息里说明需要开通哪类业务身份。
     *
     * @param actionLabel 动作名，用于拼错误消息，例如"发布挂牌"
     */
    void requireAny(Long userId, Collection<String> capabilityCodes, String actionLabel);
}
