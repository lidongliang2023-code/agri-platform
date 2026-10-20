package com.agri.platform.internal.sso.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * 手机号验证码注册请求（2026-10-16）：注册成功即按同一授权上下文登录（签码回跳），
 * 用户不必再登一次。

 *
 * <p>2026-10-20 按原型补齐注册资料：密码、会员身份、企业/个人档案。所有档案字段都真实落库
 * （企业写经营主体 + 待审核认证；个人写经营主体，填写了身份证时另写实名认证记录）。</p>
 *
 * @param phone 手机号（同时作为登录账号名）
 * @param code 短信验证码（场景 register）
 * @param nickname 昵称（可空）
 * @param marketId 进入的市场（缺省 1）
 * @param password 登录密码（8-20 位，含字母和数字；为空则保持随机占位密码）
 * @param identity 会员身份 enterprise / personal（缺省 enterprise，兼容旧调用）
 * @param companyName 企业名称（企业必填）
 * @param creditCode 统一社会信用代码（企业必填）
 * @param industry 所属行业
 * @param companySize 企业规模
 * @param address 注册地址
 * @param realName 真实姓名（个人必填）
 * @param idCard 身份证号（个人必填；只落掩码与加盐摘要）
 * @param businessType 个人经营类型
 * @param contactName 联系人姓名
 * @param clientId 子系统标识
 * @param redirectUri 回跳地址
 * @param state 透传状态
 * @param codeChallenge PKCE challenge
 * @param codeChallengeMethod PKCE 方法
 */
public record SmsRegisterRequest(
        @NotBlank(message = "手机号不能为空") String phone,
        @NotBlank(message = "验证码不能为空") String code,
        String nickname,
        Long marketId,
        String password,
        String identity,
        String companyName,
        String creditCode,
        String industry,
        String companySize,
        String address,
        String realName,
        String idCard,
        String businessType,
        String contactName,
        /** 子系统标识；直接从认证中心访问注册页时为空（只注册、不签授权码） */
        String clientId,
        /** 回跳地址；为空时返回 redirect=null，页面引导用户去子系统登录 */
        String redirectUri,
        String state,
        String codeChallenge,
        String codeChallengeMethod) {
}
