package com.agri.platform.internal.account;

import com.agri.shared.result.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 运营端 · 证照到期提醒。
 *
 * <p>每日扫描由 {@link CertificateExpiryReminderService#scheduledScan()} 自动执行；
 * 这里提供「立即扫描一次」的入口，用于运营在批量导入证照后手动触发，或验证配置是否生效。
 * 扫描本身按 (证照, 提醒档位, 用户) 幂等，重复点击不会重复发信。</p>
 */
@RestController
@RequestMapping("/api/v1/admin/uc/cert-reminders")
@RequiredArgsConstructor
public class CertificateReminderAdminController {

    private final CertificateExpiryReminderService reminderService;
    private final UserOperationLogService operationLogService;

    @PostMapping("/scan")
    public ApiResponse<Map<String, Object>> scan() {
        CertificateExpiryReminderService.ScanResult result = reminderService.scan(LocalDate.now());
        operationLogService.record(com.agri.core.infra.web.MarketContext.currentUserId(),
                "cert_reminder_scan", "扫描证照到期提醒", "证照提醒",
                "证照 " + result.certificates() + " 张，发出 " + result.messages() + " 条，跳过 " + result.skipped() + " 条");
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("certificates", result.certificates());
        data.put("targets", result.targets());
        data.put("messages", result.messages());
        data.put("skipped", result.skipped());
        return ApiResponse.ok(data);
    }
}
