package com.agri.production.controller;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.exception.BusinessException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/** 未实现能力显式拒绝；病虫害入口已统一迁入 PestDiagnosisController。 */
@RestController
@RequestMapping("/api/v1/production/ai")
public class AiNotAvailableController {

    private static final String REASON =
            "本部署未接入任何识别/预测模型，按口径不提供该结果（不做近似、不用样本量推算）。";

    /** 兼容旧入口，禁止回退至静态模拟结果。 */
    @PostMapping({"/ask", "/diagnose", "/predict-yield", "/recommend-input", "/analyze-soil"})
    public ApiResponse<Map<String, Object>> legacyCapabilities() {
        throw new BusinessException(501, "旧版静态决策接口已停用，请使用农事智能助手会话或真实生产台账。" + REASON);
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

    /* ==================== 移动端 PRD §11 / §10.4 的 AI 能力：契约先冻在这里 ==================== */
    /*
     * PRD 6.3 给这些能力定义的路径是 /api/v1/mobile/production/ai/**。
     * 本部署落在既有的 /api/v1/production/ai/** 下（同一服务、同一网关段），理由同
     * FoodSafetyController 的类注释：不为"客户端不同"再开一套前缀。
     *
     * 这些方法**统一 501 + 说明**，不是"实现了"，而是把"没有模型/没有数据"做成看得见的回答：
     * 前端可以按 PRD 的契约把页面接上，接上后用户看到的是后端原文而不是空白或假结果；
     * 将来哪个能力真上了，把对应方法删掉、换成真实现即可。
     */

    /** AI 农艺师对话（PRD §11.2，多智能体路由）。 */
    @PostMapping("/assistant/chat")
    public ApiResponse<Map<String, Object>> assistantChat() {
        throw new BusinessException(501, "AI 农艺师对话未接入。" + REASON
                + "可用的替代：病虫害防治查知识库（/admin/knowledge）、农事记录查 /tasks。");
    }


    /** AI 种植处方列表（PRD §11.3）。 */
    @GetMapping("/prescription/list")
    public ApiResponse<Map<String, Object>> prescriptionList() {
        throw new BusinessException(501, "AI 种植处方未接入：本部署没有处方数据。" + REASON);
    }

    /** AI 种植处方详情（PRD §11.3）。 */
    @GetMapping("/prescription/{prescriptionId}")
    public ApiResponse<Map<String, Object>> prescriptionDetail() {
        throw new BusinessException(501, "AI 种植处方未接入：本部署没有处方数据。" + REASON);
    }

    /** AI 种植处方确认（PRD §11.3）。 */
    @PostMapping("/prescription/{prescriptionId}/confirm")
    public ApiResponse<Map<String, Object>> prescriptionConfirm() {
        throw new BusinessException(501, "AI 种植处方未接入，无法确认。" + REASON);
    }

    /** AI 种植处方执行跟踪（PRD §11.3）。 */
    @GetMapping("/prescription/{prescriptionId}/tracking")
    public ApiResponse<Map<String, Object>> prescriptionTracking() {
        throw new BusinessException(501, "AI 种植处方未接入，没有可跟踪的执行情况。" + REASON
                + "可用的替代：任务执行记录（/tasks/{id}/records）。");
    }

    /** AI 预警中心列表（PRD §11.5，预测性预警）。 */
    @GetMapping("/alert/list")
    public ApiResponse<Map<String, Object>> aiAlertList() {
        throw new BusinessException(501, "AI 预测性预警未接入。" + REASON
                + "可用的替代：已入库的告警（/alerts）与生长监测（/growth）。");
    }

    /** AI 预警详情（PRD §11.5）。 */
    @GetMapping("/alert/{alertId}")
    public ApiResponse<Map<String, Object>> aiAlertDetail() {
        throw new BusinessException(501, "AI 预测性预警未接入。" + REASON);
    }

    /** AI 建议行动一键执行（PRD §11.5，会创建任务）。 */
    @PostMapping("/alert/{alertId}/execute")
    public ApiResponse<Map<String, Object>> aiAlertExecute() {
        throw new BusinessException(501, "AI 预警建议未接入，无法据此建任务。" + REASON
                + "可用的替代：直接建农事任务（POST /tasks）。");
    }

    /** 消费者 AI 验真（PRD §10.4，拍照 + 溯源码出结论）。 */
    @PostMapping("/verify")
    public ApiResponse<Map<String, Object>> consumerVerify() {
        throw new BusinessException(501, "消费者 AI 验真未接入：本部署没有验真模型。" + REASON
                + "可用的替代：溯源码真实链路（GET /trace/full-chain/trace/{code}）与检测记录（/quality）。");
    }

    /** AI 遥感监测（PRD §11.4，NDVI 等）。 */
    @GetMapping("/remote-sensing/plot/{plotId}")
    public ApiResponse<Map<String, Object>> remoteSensing() {
        throw new BusinessException(501, "AI 遥感监测未接入：本部署没有遥感影像源。" + REASON
                + "可用的替代：地块台账（/plots/{id}）与土壤记录（/plots/{id}/soil/latest）。");
    }

    /** AI 产量预测（PRD §11 移动端按地块口径）。 */
    @GetMapping("/yield-forecast/plot/{plotId}")
    public ApiResponse<Map<String, Object>> yieldForecastByPlot() {
        throw new BusinessException(501, "产量预测未接入。" + REASON
                + "可用的替代：采收台账里的实际产量（/harvests）与地块面积（/plots）。");
    }
}
