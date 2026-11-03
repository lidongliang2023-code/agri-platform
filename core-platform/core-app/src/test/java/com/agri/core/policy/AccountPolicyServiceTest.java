package com.agri.core.policy;

import com.agri.platform.internal.uc.AccountPolicyService;
import com.agri.platform.internal.uc.SystemConfigEntity;
import com.agri.platform.internal.uc.SystemConfigMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 账号侧策略的执行逻辑。
 *
 * <p>为什么这些必须是单测而不是点页面：注册开关、密码复杂度、弱口令拦截一旦回归，
 * 表现是"注册不了了"或"弱密码能过"，只有把规则钉在测试里才拦得住。
 * 而且这些断言不依赖数据库、不依赖短信通道，跑一次不到 1 秒。</p>
 */
class AccountPolicyServiceTest {

    private AccountPolicyService serviceWith(String... keyValues) {
        SystemConfigMapper mapper = mock(SystemConfigMapper.class);
        List<SystemConfigEntity> rows = new ArrayList<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            SystemConfigEntity entity = new SystemConfigEntity();
            entity.setConfigKey(keyValues[i]);
            entity.setConfigValue(keyValues[i + 1]);
            rows.add(entity);
        }
        when(mapper.selectList(any())).thenReturn(rows);
        return new AccountPolicyService(mapper);
    }

    // ==================== 注册开关 ====================

    @Test
    @DisplayName("注册开关=closed 时明确拒绝，并说明是运营暂停")
    void closedRegistrationIsRejected() {
        AccountPolicyService policy = serviceWith("register.mode", "closed");
        assertThatThrownBy(() -> policy.assertRegistrationAllowed("phone"))
                .hasMessageContaining("已暂停新用户注册");
    }

    @Test
    @DisplayName("注册开关=invt 时不静默放行，而是说清楚要走邀请链接")
    void inviteOnlyIsRejectedWithReason() {
        AccountPolicyService policy = serviceWith("register.mode", "invt");
        assertThatThrownBy(() -> policy.assertRegistrationAllowed("phone"))
                .hasMessageContaining("邀请制");
    }

    @Test
    @DisplayName("注册开关=open 时放行")
    void openRegistrationPasses() {
        AccountPolicyService policy = serviceWith("register.mode", "open", "register.channels", "phone,wechat");
        assertThatCode(() -> policy.assertRegistrationAllowed("phone")).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("注册方式不含该渠道时拒绝，并列出可用方式")
    void channelNotEnabledIsRejected() {
        AccountPolicyService policy = serviceWith("register.mode", "open", "register.channels", "phone,wechat");
        assertThatThrownBy(() -> policy.assertRegistrationAllowed("email"))
                .hasMessageContaining("邮箱")
                .hasMessageContaining("手机号");
    }

    // ==================== 密码复杂度 ====================

    @Test
    @DisplayName("letter_digit：8-20 位含字母和数字")
    void letterDigitPolicy() {
        AccountPolicyService policy = serviceWith("password.policy", "letter_digit", "password.weak.block", "0");
        // 注意不能用 abc12345：它含 1234 连续串，默认开着的弱口令拦截会（正确地）拦下
        assertThatCode(() -> policy.validatePassword("Nong2026Chan", null)).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.validatePassword("abcdefgh", null))
                .hasMessageContaining("同时包含字母和数字");
        assertThatThrownBy(() -> policy.validatePassword("12345678", null))
                .hasMessageContaining("同时包含字母和数字");
        assertThatThrownBy(() -> policy.validatePassword("abc123", null))
                .hasMessageContaining("8-20 位");
    }

    @Test
    @DisplayName("mix_digit：必须有大小写")
    void mixDigitPolicy() {
        AccountPolicyService policy = serviceWith("password.policy", "mix_digit", "password.weak.block", "0");
        assertThatCode(() -> policy.validatePassword("Abc12345", null)).doesNotThrowAnyException();
        assertThatThrownBy(() -> policy.validatePassword("abc12345", null))
                .hasMessageContaining("大小写");
    }

    @Test
    @DisplayName("mix_special：12-32 位，且要有特殊字符")
    void mixSpecialPolicy() {
        AccountPolicyService policy = serviceWith("password.policy", "mix_special", "password.weak.block", "0");
        assertThatCode(() -> policy.validatePassword("Abcd1234!@#$", null)).doesNotThrowAnyException();
        // 长度够但没有特殊字符
        assertThatThrownBy(() -> policy.validatePassword("Abcd12345678", null))
                .hasMessageContaining("特殊字符");
        // 有特殊字符但只有 8 位
        assertThatThrownBy(() -> policy.validatePassword("Abc1!@#$", null))
                .hasMessageContaining("12-32 位");
    }

    // ==================== 弱口令 ====================

    @Test
    @DisplayName("弱口令拦截：连续字符、手机号、生日")
    void weakPasswordRules() {
        AccountPolicyService policy = serviceWith("password.policy", "letter_digit", "password.weak.block", "1");
        assertThatThrownBy(() -> policy.validatePassword("abcd1234", null))
                .hasMessageContaining("连续字符");
        assertThatThrownBy(() -> policy.validatePassword("13800138000a", "13800138000"))
                .hasMessageContaining("手机号");
        assertThatThrownBy(() -> policy.validatePassword("Abc19900101", null))
                .hasMessageContaining("生日");
        // 正常密码不该被误杀
        assertThatCode(() -> policy.validatePassword("Nong2026Chan", null)).doesNotThrowAnyException();
    }

    @Test
    @DisplayName("关掉弱口令拦截后，连续字符可以过")
    void weakBlockCanBeDisabled() {
        AccountPolicyService policy = serviceWith("password.policy", "letter_digit", "password.weak.block", "0");
        assertThatCode(() -> policy.validatePassword("abcd1234", null)).doesNotThrowAnyException();
    }

    // ==================== 其它读取 ====================

    @Test
    @DisplayName("配置缺失时回落到安全默认值，不让注册登录整体不可用")
    void fallsBackToDefaultsWhenConfigMissing() {
        AccountPolicyService policy = serviceWith();
        assertThatCode(() -> policy.assertRegistrationAllowed("phone")).doesNotThrowAnyException();
        // 注意不能用 abc12345：它含 1234 连续串，默认开着的弱口令拦截会（正确地）拦下
        assertThatCode(() -> policy.validatePassword("Nong2026Chan", null)).doesNotThrowAnyException();
        org.assertj.core.api.Assertions.assertThat(policy.rememberDays()).isEqualTo(7);
        org.assertj.core.api.Assertions.assertThat(policy.smsCodeTtlSeconds()).isEqualTo(300);
        org.assertj.core.api.Assertions.assertThat(policy.defaultRole()).isEqualTo("FARMER");
    }
}
