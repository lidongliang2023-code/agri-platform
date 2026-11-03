package com.agri.production.job;

import com.agri.production.service.ITraceLifecycleService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 溯源码到期扫描。
 *
 * <p>为什么要有这个任务：生成接口一直收 {@code expireDate}、表上一直有 {@code expiry_date} 列，
 * 但既没人写也没人读 —— "有效期"于是只是一个填了不生效的输入框，过期码照旧显示"可核验"。
 * 现在落库、扫描、回显三处都接上了。</p>
 *
 * <p>口径集中在 {@code TraceLifecycleServiceImpl#expireOverdue}：只处理设了有效期、
 * 已过期、且状态还是 generated/active/scanned 的码；已作废与已过期不动；
 * 没设有效期的码不参与（不拿别的日期编一个到期日）。</p>
 *
 * <p>页面另有一条手动触发入口（{@code PATCH /trace/codes/expire-overdue}，只扫本主体），
 * 与本任务共用同一处实现 —— 回归脚本走那条，判定不依赖任务是否刚好跑过。</p>
 */
@Component
@Slf4j
public class TraceCodeExpiryJob {

    private final ITraceLifecycleService traceLifecycleService;

    public TraceCodeExpiryJob(ITraceLifecycleService traceLifecycleService) {
        this.traceLifecycleService = traceLifecycleService;
    }

    /** 默认每小时扫一次全部主体；间隔可用 {@code agri.trace.expiry-scan-interval-ms} 覆盖。 */
    @Scheduled(fixedDelayString = "${agri.trace.expiry-scan-interval-ms:3600000}", initialDelayString = "60000")
    public void scan() {
        try {
            int expired = traceLifecycleService.expireOverdue(null);
            if (expired > 0) {
                log.info("溯源码到期扫描完成：{} 条置为 expired", expired);
            }
        } catch (Exception e) {
            // 扫描失败只影响"过期码晚一点变灰"，不能让任务静默吞掉：必须留日志
            log.error("溯源码到期扫描失败，过期码本轮未置为 expired：{}", e.getMessage(), e);
        }
    }
}
