package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IAdminFoodSafetyColdChainService;
import com.agri.production.vo.AdminFsColdChainMatchVO;
import com.agri.production.vo.AdminFsColdChainResourceVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 运营端：食品安全 - 冷链资源撮合（{@code /api/v1/production/admin/food-safety/cold-chain}）。
 *
 * <p>本控制器负责这一域的**第四子域**（P19，5 条端点）：统计 / 资源分页 / 撮合记录分页 /
 * 立即撮合 / 加入队列。做完这一块，食品安全的 23 条端点在本服务全部就位。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/food-safety/cold-chain")
public class AdminFoodSafetyColdChainController {

    private final IAdminFoodSafetyColdChainService coldChainService;

    public AdminFoodSafetyColdChainController(IAdminFoodSafetyColdChainService coldChainService) {
        this.coldChainService = coldChainService;
    }

    /** 冷链资源统计（total / available / busy / offline / matchRate）。 */
    @GetMapping("/stats")
    public ApiResponse<Map<String, Object>> stats() {
        return ApiResponse.success(coldChainService.stats());
    }

    /** 冷链资源分页（type / status / city / keyword 均可选）。 */
    @GetMapping("/resources")
    public ApiResponse<PageResult<AdminFsColdChainResourceVO>> resources(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String city,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(coldChainService.pageResources(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10),
                type, status, city, keyword));
    }

    /** 撮合记录分页（status / keyword 可选）。 */
    @GetMapping("/matches")
    public ApiResponse<PageResult<AdminFsColdChainMatchVO>> matches(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.success(coldChainService.pageMatches(
                firstNonNull(pageNum, page, 1), firstNonNull(pageSize, size, 10), status, keyword));
    }

    /** 立即撮合（body {resourceId, demander, cargo, startTime, tempRequire, remark?}）。 */
    @PostMapping("/matches")
    public ApiResponse<AdminFsColdChainMatchVO> createMatch(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(coldChainService.createMatch(
                body == null ? null : str(body.get("resourceId")),
                body == null ? null : str(body.get("demander")),
                body == null ? null : str(body.get("cargo")),
                body == null ? null : str(body.get("startTime")),
                body == null ? null : str(body.get("tempRequire")),
                body == null ? null : str(body.get("remark"))));
    }

    /** 加入撮合队列（body {resourceId, expectTime, demander, remark?}）。 */
    @PostMapping("/queue")
    public ApiResponse<AdminFsColdChainMatchVO> queue(@RequestBody(required = false) Map<String, Object> body) {
        return ApiResponse.success(coldChainService.enqueue(
                body == null ? null : str(body.get("resourceId")),
                body == null ? null : str(body.get("demander")),
                body == null ? null : str(body.get("expectTime")),
                body == null ? null : str(body.get("remark"))));
    }

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
