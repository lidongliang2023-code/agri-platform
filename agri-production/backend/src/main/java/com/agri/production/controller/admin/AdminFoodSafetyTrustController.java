package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IAdminFoodSafetyTrustService;
import com.agri.production.vo.AdminFsTrustProductVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 运营端：食品安全 - 可信农产品管理（{@code /api/v1/production/admin/food-safety/trust-label}）。
 *
 * <p>本控制器负责这一域的**第三子域**（P18，4 条端点）：统计 / 名单分页 / 编辑 / 审核。
 * 最后一个子域（P19 冷链）单独一个控制器。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/food-safety/trust-label")
public class AdminFoodSafetyTrustController {

    private final IAdminFoodSafetyTrustService trustService;

    public AdminFoodSafetyTrustController(IAdminFoodSafetyTrustService trustService) {
        this.trustService = trustService;
    }

    /** 可信农产品统计（全部由本服务实时聚合）。 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats() {
        return ApiResponse.success(trustService.stats());
    }

    /** 可信农产品名单分页（level / auditStatus / name / keyword 均可选）。 */
    @GetMapping("/products")
    public ApiResponse<PageResult<AdminFsTrustProductVO>> products(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String level,
            @RequestParam(required = false) String auditStatus,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(trustService.pageProducts(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                level, auditStatus, name, keyword));
    }

    /** 编辑可信农产品（body {level, score, cert, validUntil, certOrg}）。 */
    @PutMapping("/products/{productId}")
    public ApiResponse<AdminFsTrustProductVO> update(@PathVariable String productId,
                                                    @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(trustService.updateProduct(productId,
                body == null ? null : str(body.get("level")),
                body == null ? null : num(body.get("score")),
                body == null ? null : str(body.get("cert")),
                body == null ? null : str(body.get("validUntil")),
                body == null ? null : str(body.get("certOrg"))));
    }

    /** 审核可信农产品（body {action, remark}）。 */
    @PostMapping("/products/{productId}/audit")
    public ApiResponse<AdminFsTrustProductVO> audit(@PathVariable String productId,
                                                  @RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(trustService.auditProduct(productId,
                body == null ? null : str(body.get("action")),
                body == null ? null : str(body.get("remark"))));
    }

    private static String str(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    /**
     * 信任分数解析。
     *
     * <p>非法值统一交给服务层的范围校验报 400（"应为 0~100 的整数"），
     * 而不是在这里抛 NumberFormatException 被兜底成 500。</p>
     */
    private static Integer num(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.valueOf(String.valueOf(value).trim());
        } catch (NumberFormatException e) {
            return null;
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
