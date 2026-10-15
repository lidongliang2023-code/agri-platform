package com.agri.production.controller.admin;

import com.agri.production.common.entity.ApiResponse;
import com.agri.production.common.entity.PageResult;
import com.agri.production.service.IDomainEventOpsService;
import com.agri.production.service.TenantContextService;
import com.agri.production.vo.DomainEventContractVO;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 领域事件投递台账（运营端）。
 *
 * <p>路径在 {@code /api/v1/production/admin/**} 下 → 由 agri-common 的平台 RBAC 组件按
 * {read,write}-permission（production:read / production:write）把关，且必须带令牌
 * （见 application.yml 的 platform.rbac 段）。</p>
 *
 * <p>这一页存在的理由只有一个：**让"事件发出去了没有"变成看得见的东西**。
 * 状态停在 NEW / DEAD 且带着失败原因，比在日志里翻 100 行强。</p>
 */
@RestController
@RequestMapping("/api/v1/production/admin/events")
public class DomainEventAdminController {

    private final IDomainEventOpsService opsService;

    public DomainEventAdminController(IDomainEventOpsService opsService) {
        this.opsService = opsService;
    }

    /** 事件台账（可按状态筛）。 */
    @GetMapping
    public ApiResponse<PageResult<DomainEventContractVO>> page(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageNum,
            @RequestParam(required = false) Integer size,
            @RequestParam(required = false) Integer pageSize) {
        return ApiResponse.success(opsService.page(
                status,
                firstNonNull(pageNum, page, 1),
                firstNonNull(pageSize, size, 20),
                TenantContextService.currentTenantId()));
    }

    /** 各状态条数。 */
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        return ApiResponse.success(opsService.summary(TenantContextService.currentTenantId()));
    }

    /** 重放一条已投递/死信的事件（消费端就位后用）。 */
    @PostMapping("/{id}/replay")
    public ApiResponse<DomainEventContractVO> replay(@PathVariable Long id) {
        return ApiResponse.success(opsService.replay(id, TenantContextService.currentTenantId()));
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
