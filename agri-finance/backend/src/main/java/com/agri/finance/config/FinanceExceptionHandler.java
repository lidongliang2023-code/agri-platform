package com.agri.finance.config;

import com.agri.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

/**
 * 金融侧业务异常的统一响应体。
 *
 * <p>本模块所有接口都用 HTTP 200 + {@code {code,message,data}} 表达业务失败
 * （前端 {@code request()} 按 {@code code !== 200} 抛出 message）。身份/归属校验
 * 抛出的 BusinessException 若走 Spring 默认错误页，前端只会显示
 * "Request failed with status code 403" —— 用户看不出该重新登录还是该申请权限。</p>
 *
 * <p>401 也保持 HTTP 200：认证拦截器把 HTTP 401 当成"令牌失效"直接清会话跳登录，
 * 而"没绑定经营主体"这类 401/403 是业务状态，跳登录解决不了。</p>
 */
@Slf4j
@RestControllerAdvice
public class FinanceExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public Map<String, Object> handleBusiness(BusinessException e) {
        log.warn("金融业务异常：code={} message={}", e.getCode(), e.getMessage());
        return Map.of("code", e.getCode(), "message", e.getMessage(), "data", "");
    }
}
