package com.agri.government.controller;

import com.agri.common.result.ApiResponse;
import com.agri.government.security.GovernmentIdentityService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 当前登录者在政府监管侧的身份卡。
 *
 * <p>三个入口（主体端、移动执法端、监管运营端）原先各自在代码里认人：主体端写死
 * {@code subject_id=1}、执法端写死 {@code '王磊'}。前端要显示"我现在是谁"就必须也写死一份，
 * 于是页面右上角永远显示绿源蔬菜专业合作社。这里给出唯一解析入口，前端只读不算。</p>
 */
@RestController
@RequestMapping("/api/v1/government")
public class GovernmentIdentityController {

    private final GovernmentIdentityService identity;

    public GovernmentIdentityController(GovernmentIdentityService identity) {
        this.identity = identity;
    }

    @GetMapping("/identity")
    public ApiResponse<Map<String, Object>> identity() {
        Map<String, Object> data = new LinkedHashMap<>();
        try {
            data.put("merchantId", identity.currentMerchantId());
            data.put("merchantName", identity.currentMerchantName());
            data.put("merchantError", null);
        } catch (Exception e) {
            data.put("merchantId", null);
            data.put("merchantName", null);
            data.put("merchantError", e.getMessage());
        }
        try {
            Map<String, Object> subject = identity.currentSubject();
            data.put("subjectId", subject.get("id"));
            data.put("subjectName", subject.get("subject_name"));
            data.put("creditCode", subject.get("credit_code"));
            data.put("creditScore", subject.get("credit_score"));
            data.put("riskLevel", subject.get("risk_level"));
            data.put("subjectError", null);
        } catch (Exception e) {
            data.put("subjectId", null);
            data.put("subjectName", null);
            data.put("subjectError", e.getMessage());
        }
        Map<String, Object> inspector = identity.currentInspector();
        data.put("inspectorId", inspector == null ? null : inspector.get("id"));
        data.put("inspectorName", inspector == null ? null : inspector.get("name"));
        data.put("inspectorTeam", inspector == null ? null : inspector.get("organization"));
        data.put("inspectorGrid", inspector == null ? null : inspector.get("grid_name"));
        data.put("certificateNo", inspector == null ? null : inspector.get("certificate_no"));
        data.put("operatorName", identity.operatorName());
        Map<String, Boolean> roles = new LinkedHashMap<>();
        roles.put("citizen", identity.hasPermission("gov:citizen"));
        roles.put("inspector", identity.hasPermission("gov:inspector"));
        roles.put("admin", identity.hasPermission("gov:admin"));
        data.put("roles", roles);
        return ApiResponse.success(data);
    }
}
