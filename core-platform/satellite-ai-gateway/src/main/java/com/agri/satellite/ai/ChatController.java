package com.agri.satellite.ai;

import com.agri.shared.result.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 对话接口：SAAI 撮合助手 / AI 种养助手共用（场景路由不同供应商）。
 */
@RestController
@RequestMapping("/api/v1/ai")
@RequiredArgsConstructor
public class ChatController {

    private final AiGatewayService aiGatewayService;

    public record ChatRequest(String scenario, @NotEmpty List<AiGatewayService.ChatMessage> messages) {
    }

    @PostMapping("/chat")
    public ApiResponse<AiGatewayService.ChatResult> chat(@Valid @RequestBody ChatRequest req) {
        return ApiResponse.ok(aiGatewayService.chat(req.scenario(), req.messages()));
    }
}
