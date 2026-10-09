package com.agri.produce.internal.ai;

import com.agri.shared.result.ApiResponse;
import com.agri.shared.result.PageResult;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI 识别与诊断（用户端，模型能力在 satellite-ai-gateway）。
 */
@RestController
@RequestMapping("/api/v1/production/ai")
@RequiredArgsConstructor
public class AiController {

    private final AiDiagnosisService aiDiagnosisService;

    @GetMapping
    public ApiResponse<PageResult<AiDiagnosisEntity>> page(@RequestParam(defaultValue = "1") long page,
                                                           @RequestParam(defaultValue = "10") long size,
                                                           @RequestParam(required = false) String keyword,
                                                           @RequestParam(required = false) String status) {
        return ApiResponse.ok(aiDiagnosisService.page(page, size, keyword, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<AiDiagnosisEntity> detail(@PathVariable String id) {
        return ApiResponse.ok(aiDiagnosisService.detail(id));
    }

    @PostMapping
    public ApiResponse<String> create(@RequestBody AiDiagnosisEntity entity) {
        return ApiResponse.ok(aiDiagnosisService.create(entity).getDiagnosisId());
    }

    @PutMapping("/{id}")
    public ApiResponse<AiDiagnosisEntity> update(@PathVariable String id, @RequestBody AiDiagnosisEntity entity) {
        return ApiResponse.ok(aiDiagnosisService.update(id, entity));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        aiDiagnosisService.delete(id);
        return ApiResponse.ok();
    }

    /** 发起 AI 诊断 */
    @PostMapping("/diagnose")
    public ApiResponse<AiDiagnosisEntity> diagnose(@RequestBody AiDiagnosisEntity diagnosis) {
        return ApiResponse.ok(aiDiagnosisService.diagnose(diagnosis));
    }

    /** 地块历史诊断 */
    @GetMapping("/by-plot")
    public ApiResponse<List<AiDiagnosisEntity>> byPlot(@RequestParam String plotId) {
        return ApiResponse.ok(aiDiagnosisService.listByPlot(plotId));
    }

    /** 病虫害识别 */
    @PostMapping("/pest-detection")
    public ApiResponse<AiDiagnosisEntity> pestDetection(@RequestBody AiDiagnosisEntity diagnosis) {
        diagnosis.setDiagnosisType("PEST");
        return ApiResponse.ok(aiDiagnosisService.diagnose(diagnosis));
    }

    /** AI 助手会话（骨架：历史诊断会话摘要） */
    @GetMapping("/assistant/sessions")
    public ApiResponse<List<Map<String, Object>>> assistantSessions(@RequestParam(required = false) String plotId) {
        return ApiResponse.ok(aiDiagnosisService.sessions(plotId));
    }

    /** 产量预测 */
    @GetMapping("/yield-forecast")
    public ApiResponse<Map<String, Object>> yieldForecast(@RequestParam(required = false) String plotId) {
        return ApiResponse.ok(aiDiagnosisService.yieldForecast(plotId));
    }
}
