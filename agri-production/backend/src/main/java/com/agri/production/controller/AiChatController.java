package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.IAiChatService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.AiDiagnosisVO;
import com.agri.production.vo.AiMessageVO;
import com.agri.production.vo.AiSessionVO;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * AI 助手：诊断记录列表 + 问答会话与消息（{@code /api/v1/production/ai}）。
 *
 * <p>页面用到的路径：{@code GET /ai}（诊断记录分页）、{@code /ai/assistant/sessions}（列表/新建）、
 * {@code PATCH /ai/assistant/sessions/{id}}（重命名）、{@code DELETE /ai/assistant/sessions/{id}}（删除）、
 * {@code GET /ai/assistant/sessions/{id}/messages}（消息）、{@code POST /ai/assistant/messages}（提问）。</p>
 *
 * <p><b>刻意未实现</b>：{@code POST /ai/pest-detection}、{@code GET|POST /ai/yield-forecast}、
 * {@code GET /ai/yield-forecast/accuracy} —— 本部署没有模型，识别与预测类数字一旦被当真会直接影响
 * 生产决策（方案第五节的定论）。这些路径经网关 404 回退平台侧，不受本服务影响。</p>
 */
@RestController
@RequestMapping("/api/v1/production/ai")
public class AiChatController {

    private final IAiChatService aiChatService;

    public AiChatController(IAiChatService aiChatService) {
        this.aiChatService = aiChatService;
    }

    /** 诊断记录分页（页面「病虫害识别」列表；本服务只承载已有记录，不产生新诊断）。 */
    @GetMapping
    public ApiResponse<PageResult<AiDiagnosisVO>> diagnoses(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ApiResponse.success(aiChatService.pageDiagnoses(TenantContextService.currentTenantId(),
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), keyword, status));
    }

    /* ==================== 会话 ==================== */

    /** 会话列表。 */
    @GetMapping("/assistant/sessions")
    public ApiResponse<List<AiSessionVO>> sessions() {
        return ApiResponse.success(aiChatService.listSessions(TenantContextService.currentTenantId()));
    }

    /** 新建会话。 */
    @PostMapping("/assistant/sessions")
    public ApiResponse<AiSessionVO> createSession(@RequestBody(required = false) Map<String, Object> body) {
        String title = body == null ? null : str(body.get("title"));
        return ApiResponse.success(aiChatService.createSession(TenantContextService.currentTenantId(), title));
    }

    /** 重命名会话（页面按返回值提示成功与否）。 */
    @PatchMapping("/assistant/sessions/{sessionId}")
    public ApiResponse<Boolean> renameSession(@PathVariable String sessionId,
                                             @RequestBody(required = false) Map<String, Object> body) {
        String title = body == null ? null : str(body.get("title"));
        if (title == null) {
            throw new BusinessException(400, "会话标题不能为空");
        }
        return ApiResponse.success(aiChatService.renameSession(
                TenantContextService.currentTenantId(), sessionId, title));
    }

    /** 删除会话（连同其消息）。 */
    @DeleteMapping("/assistant/sessions/{sessionId}")
    public ApiResponse<Boolean> deleteSession(@PathVariable String sessionId) {
        aiChatService.deleteSession(TenantContextService.currentTenantId(), sessionId);
        return ApiResponse.success(true);
    }

    /* ==================== 消息 ==================== */

    /** 会话消息（按时间升序）。 */
    @GetMapping("/assistant/sessions/{sessionId}/messages")
    public ApiResponse<List<AiMessageVO>> messages(@PathVariable String sessionId) {
        return ApiResponse.success(aiChatService.messages(TenantContextService.currentTenantId(), sessionId));
    }

    /**
     * 发一条消息，返回**助手回复**。

     *
     * <p>回复是规则式应答（engine=rule-based）：只回答本服务库里有据可查的问题，
     * 答不了的直接说答不了 —— 响应里带 refDocIds 标明数字出处。</p>
     */
    @PostMapping("/assistant/messages")
    public ApiResponse<AiMessageVO> send(@RequestBody(required = false) Map<String, Object> body) {
        Map<String, Object> payload = body == null ? Map.of() : body;
        return ApiResponse.success(aiChatService.send(TenantContextService.currentTenantId(),
                str(payload.get("sessionId")), str(payload.get("content"))));
    }

    /* ==================== 参数小工具 ==================== */

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private static int firstNonNull(Integer... values) {
        for (Integer value : values) {
            if (value != null) {
                return value;
            }
        }
        return 1;
    }
}
