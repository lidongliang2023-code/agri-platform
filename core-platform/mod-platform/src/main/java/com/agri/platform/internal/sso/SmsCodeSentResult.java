package com.agri.platform.internal.sso;

/**
 * 发送验证码的结果（2026-10-16）。

 *
 * <p><b>刻意不含验证码本身</b>：dev 通道也只把码写后端日志，不回响应体 ——
 * 这样页面流程与生产完全一致，也不会出现"验证码被前端拿到"的口子。</p>

 *
 * @param sent 是否已发送（能走到这里就是 true，失败会以业务异常返回）
 * @param devMode 是否处于开发通道（页面据此提示"验证码见后端日志"）
 * @param hint 给使用者看的说明
 */
public record SmsCodeSentResult(boolean sent, boolean devMode, String hint) {
}
