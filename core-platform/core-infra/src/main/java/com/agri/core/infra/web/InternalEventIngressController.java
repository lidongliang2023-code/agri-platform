package com.agri.core.infra.web;

import com.agri.core.infra.event.TopicListener;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 内部事件入口（开发态 http 传输的接收端）：卫星服务 → 核心单体。
 * 以内部令牌校验代替 JWT（部署上仅限内网可达；生产建议叠加网段白名单/ mTLS）。
 */
@RestController
@RequestMapping("/internal/events")
@RequiredArgsConstructor
public class InternalEventIngressController {

    private final List<TopicListener> listeners;

    @Value("${agri.event.http.internal-token:dev-internal-token}")
    private String internalToken;

    @PostMapping("/{topic}")
    public ApiResponse<Void> ingest(@PathVariable String topic,
                                    @RequestHeader(value = "X-Internal-Token", required = false) String givenToken,
                                    @RequestBody String payload) throws Exception {
        if (!internalToken.equals(givenToken)) {
            throw new BusinessException(ErrorCode.FORBIDDEN);
        }
        boolean matched = false;
        for (TopicListener listener : listeners) {
            if (listener.topic().equals(topic)) {
                matched = true;
                listener.onMessage(payload);
            }
        }
        if (!matched) {
            return ApiResponse.fail(ErrorCode.NOT_FOUND);
        }
        return ApiResponse.ok();
    }
}
