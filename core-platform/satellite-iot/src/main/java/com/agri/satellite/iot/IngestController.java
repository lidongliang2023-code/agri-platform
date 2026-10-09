package com.agri.satellite.iot;

import com.agri.shared.result.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.Map;

/**
 * HTTP 接入通道：调试与无 MQTT 环境联调（MQTT 为主通道）。
 */
@RestController
@RequestMapping("/api/v1/ingest")
@RequiredArgsConstructor
public class IngestController {

    private final IngestService ingestService;

    public record IngestRequest(@NotBlank String deviceNo, @NotBlank String metric,
                                @NotNull BigDecimal value, Long marketId) {
    }

    @PostMapping
    public ApiResponse<Map<String, Object>> ingest(@Valid @RequestBody IngestRequest req) {
        return ApiResponse.ok(ingestService.ingest(req.deviceNo(), req.metric(), req.value(), req.marketId()));
    }
}
