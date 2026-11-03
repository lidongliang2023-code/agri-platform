package com.agri.admin.job;

import com.agri.admin.service.PermissionAnomalyScanner;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * 权限巡检定时任务。
 *
 * <p>审计页只写"重新检测"按钮的话，异常要等人点开才看得见；每天扫一次才叫巡检。
 * 判定与手动触发共用 {@link PermissionAnomalyScanner#scan()}，所以两条路径结论必然一致。</p>
 *
 * <p>扫描失败只影响"异常晚一天被发现"，但不能静默：日志必须留下，
 * 否则页面会一直显示上一次的结果，谁都不知道它已经过期。</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PermissionAnomalyJob {

    private final PermissionAnomalyScanner scanner;

    /** 默认每天 03:30；可用 {@code agri.permission.anomaly-scan-cron} 覆盖。 */
    @Scheduled(cron = "${agri.permission.anomaly-scan-cron:0 30 3 * * ?}")
    public void scan() {
        try {
            Map<String, Object> result = scanner.scan();
            log.info("权限巡检定时任务完成：命中 {} 条，自动消解 {} 条",
                    result.get("findings"), result.get("resolved"));
        } catch (Exception e) {
            log.error("权限巡检定时任务失败，审计页显示的仍是上一次扫描的结果：{}", e.getMessage(), e);
        }
    }
}
