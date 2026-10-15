package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.service.IAdminFoodSafetyComplianceService;
import com.agri.production.vo.AdminFsInputComplianceVO;
import com.agri.production.vo.AdminFsLabelComplianceVO;
import com.agri.production.vo.AdminFsStandardItemVO;
import com.agri.production.vo.AdminFsStandardOptionVO;
import com.agri.production.vo.AdminFsStandardSummaryVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * 运营端：食品安全 - 合规校验管理（{@code /api/v1/production/admin/food-safety/compliance}）。
 *
 * <p>本控制器负责这一域的**第二子域**：P17 三个 Tab（投入品合规 / 产品标签合规 / 行业标准校验）
 * 共 8 条端点。信任标签、冷链两子域另行分批接。</p>
 *
 * <p>与监测子域分控制器是为了让两批的表与端点边界跟提交边界一致 —— 一个 23 条端点的
 * 控制器既不好审也不好回滚。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/food-safety/compliance")
public class AdminFoodSafetyComplianceController {

    private final IAdminFoodSafetyComplianceService complianceService;

    public AdminFoodSafetyComplianceController(IAdminFoodSafetyComplianceService complianceService) {
        this.complianceService = complianceService;
    }

    /* ==================== Tab1 投入品合规 ==================== */

    /** 投入品合规台账分页（result / farmName / keyword 均可选）。 */
    @GetMapping("/inputs")
    public ApiResponse<PageResult<AdminFsInputComplianceVO>> inputs(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String farmName,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(complianceService.pageInputs(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), result, farmName, keyword));
    }

    /** 超标处罚登记（body {action, amount, remark}）。 */
    @PostMapping("/inputs/{recordId}/punish")
    public ApiResponse<AdminFsInputComplianceVO> punishInput(@PathVariable String recordId,
                                                            @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(complianceService.punishInput(recordId,
                body == null ? null : str(body.get("action")),
                body == null ? null : dec(body.get("amount")),
                body == null ? null : str(body.get("remark"))));
    }

    /* ==================== Tab2 产品标签合规 ==================== */

    /** 产品标签合规分页（result / productName / keyword 均可选）。 */
    @GetMapping("/labels")
    public ApiResponse<PageResult<AdminFsLabelComplianceVO>> labels(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String productName,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(complianceService.pageLabels(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), result, productName, keyword));
    }

    /** 下发标签整改通知（body {deadline, remark}）。 */
    @PostMapping("/labels/{labelId}/rectify")
    public ApiResponse<AdminFsLabelComplianceVO> rectifyLabel(@PathVariable String labelId,
                                                             @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(complianceService.rectifyLabel(labelId,
                body == null ? null : str(body.get("deadline")),
                body == null ? null : str(body.get("remark"))));
    }

    /* ==================== Tab3 行业标准校验 ==================== */

    /** 行业标准下拉（出参为 antd 的 value/label 形状，不是分页结构）。 */
    @GetMapping("/standards")
    public ApiResponse<List<AdminFsStandardOptionVO>> standards() {
        return ApiResponse.success(complianceService.listStandards());
    }

    /** 某标准的校验项明细。 */
    @GetMapping("/standards/{standardNo}/items")
    public ApiResponse<List<AdminFsStandardItemVO>> standardItems(@PathVariable String standardNo) {
        return ApiResponse.success(complianceService.listStandardItems(standardNo));
    }

    /** 某标准的校验汇总（未执行过校验返回 404 + 可操作提示，不回一组 0）。 */
    @GetMapping("/standards/{standardNo}/summary")
    public ApiResponse<AdminFsStandardSummaryVO> standardSummary(@PathVariable String standardNo) {
        return ApiResponse.success(complianceService.standardSummary(standardNo));
    }

    /** 执行标准自动校验（body {standardNo, batchScope}；真实重算并 upsert 汇总）。 */
    @PostMapping("/standards/{standardNo}/run")
    public ApiResponse<AdminFsStandardSummaryVO> runStandard(@PathVariable String standardNo,
                                                            @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(complianceService.runStandard(standardNo,
                body == null ? null : str(body.get("standardNo")),
                body == null ? null : str(body.get("batchScope"))));
    }

    /* ==================== 参数小工具 ==================== */

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    /**
     * 金额解析。
     *
     * <p>传了不是数字的金额要**明确报 400**：直接 {@code new BigDecimal(String)} 抛的
     * {@code NumberFormatException} 会被全局兜底成 500「系统异常」，运营看到的是"系统坏了"，
     * 实际是自己填错了。</p>
     */
    private static BigDecimal dec(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return new BigDecimal(number.toString());
        }
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(text);
        } catch (NumberFormatException e) {
            throw new BusinessException(400, "处罚金额不是有效数字：" + text);
        }
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
