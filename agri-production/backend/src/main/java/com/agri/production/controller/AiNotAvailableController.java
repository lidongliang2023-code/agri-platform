package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 病虫害识别与产量预测：**明确回绝**，不做结果（{@code /api/v1/production/ai}）。

 *
 * <p>方案第五节的定论是"暂不实现，保持缺口"。但**只返回 404 并不足以守住这条口径**：
 * ai 段切到本服务后，404 会被网关回退到平台侧的骨架实现，而平台侧对
 * {@code GET /ai/yield-forecast} 返回的是 {@code 样本量 × 100}（它自己的注释就写着"非真实模型输出"）——
 * 页面上的「开始预测」一按，看到的会是一个**编出来的产量数字**。那正是本项目最忌讳的那类补全。</p>
 *
 * <p>所以这里显式接住这 4 条路径并回绝：状态码用 501（未实现）+ 说明为什么、以及可用什么替代。
 * 这不是"实现了预测"，而是把"没有模型"这件事做成了**看得见的回答**，同时挡掉平台侧的假结果。
 * 将来若产品决定走经验规则，在 {@code AiChatServiceImpl} 里加规则实现并把 engine 标成 rule-based 即可。</p>
 */
@RestController
@RequestMapping("/api/v1/production/ai")
public class AiNotAvailableController {

    private static final String REASON =
            "本部署未接入任何识别/预测模型，按口径不提供该结果（不做近似、不用样本量推算）。";

    /** 病虫害识别（上传图片出结论）——没有模型就没有结论。 */
    @PostMapping("/pest-detection")
    public ApiResponse<Map<String, Object>> pestDetection() {
        throw new BusinessException(501, "病虫害识别未接入。" + REASON
                + "可用的替代：查看历史上已入库的诊断记录（GET /ai），或请农技员现场判断。");
    }

    /** 产量预测（读取口径）。 */
    @GetMapping("/yield-forecast")
    public ApiResponse<Map<String, Object>> yieldForecastList() {
        throw new BusinessException(501, "产量预测未接入。" + REASON
                + "可用的替代：采收台账里的实际产量（/harvests）与地块面积（/plots）。");
    }

    /** 产量预测（发起）。 */
    @PostMapping("/yield-forecast")
    public ApiResponse<Map<String, Object>> yieldForecastCreate() {
        throw new BusinessException(501, "产量预测未接入。" + REASON
                + "可用的替代：采收台账里的实际产量（/harvests）与地块面积（/plots）。");
    }

    /** 产量预测历史准确率——没有预测就没有准确率。 */
    @GetMapping("/yield-forecast/accuracy")
    public ApiResponse<Map<String, Object>> yieldForecastAccuracy() {
        throw new BusinessException(501, "预测准确率未接入：本部署没有产生过任何预测结果。" + REASON);
    }
}
