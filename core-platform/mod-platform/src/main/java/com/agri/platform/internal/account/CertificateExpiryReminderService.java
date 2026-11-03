package com.agri.platform.internal.account;

import com.agri.platform.api.facade.MessageFacade;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 证照到期提醒：每天扫一次，把临期 / 刚过期的证照通过站内信发给主体成员。
 *
 * <p><b>为什么按主体分发</b>：证照挂在 merchant_id 上，不属于个人；一条临期证照
 * 应该让该主体的所有有效成员都知道，而不是只提醒上传的人。</p>
 *
 * <p><b>幂等</b>：`platform_cert_reminder` 的 (cert_id, window_key, user_id) 唯一。
 * 同一张证照、同一档提醒对同一个人只发一次 —— 否则每天扫一次就会每天发一遍。
 * 两档提醒：`D30`（30 天内到期）与 `EXPIRED`（过期后 7 天内），换证后新证有新的 cert_id，会重新提醒。</p>
 *
 * <p>提醒只写站内信，不发短信；运营端「消息推送」里的人群 `cert_expiring` 是另一条独立的主动触达路径。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertificateExpiryReminderService {

    private static final String WINDOW_D30 = "D30";
    private static final String WINDOW_EXPIRED = "EXPIRED";
    /** 过期超过这个天数就不再发：再发也只是噪音，用户需要的是换证而不是提醒 */
    private static final int EXPIRED_GRACE_DAYS = 7;
    /** 提前提醒窗口 */
    private static final int EXPIRING_WINDOW_DAYS = 30;

    private final MerchantCertificateMapper certificateMapper;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final CertificateReminderMapper reminderMapper;
    private final MessageFacade messageFacade;

    @Value("${agri.uc.cert-reminder.enabled:true}")
    private boolean enabled = true;

    /** 扫描结果：证照数、目标用户数、实际发出、因发过而跳过 */
    public record ScanResult(int certificates, int targets, int messages, int skipped) {
    }

    @Scheduled(cron = "${agri.uc.cert-reminder.cron:0 0 9 * * *}")
    public void scheduledScan() {
        if (!enabled) {
            return;
        }
        try {
            log.info("证照到期提醒扫描完成：{}", scan(LocalDate.now()));
        } catch (RuntimeException e) {
            // 定时任务不能把异常抛出去：一次数据库抖动不该让调度线程停摆
            log.warn("证照到期提醒扫描失败", e);
        }
    }

    /**
     * 扫一次并发送提醒。
     *
     * @param today 基准日期（测试可传入固定日期）
     * @return 本轮统计
     */
    public ScanResult scan(LocalDate today) {
        LocalDate from = today.minusDays(EXPIRED_GRACE_DAYS);
        LocalDate to = today.plusDays(EXPIRING_WINDOW_DAYS);
        List<MerchantCertificateEntity> certificates = certificateMapper.selectList(
                new LambdaQueryWrapper<MerchantCertificateEntity>()
                        .eq(MerchantCertificateEntity::getStatus, "active")
                        .isNotNull(MerchantCertificateEntity::getExpireDate)
                        .between(MerchantCertificateEntity::getExpireDate, from, to));
        if (certificates.isEmpty()) {
            return new ScanResult(0, 0, 0, 0);
        }

        List<Long> merchantIds = certificates.stream()
                .map(MerchantCertificateEntity::getMerchantId)
                .filter(Objects::nonNull).distinct().toList();
        Map<Long, String> merchantNames = new HashMap<>();
        for (MerchantEntity merchant : merchantMapper.selectBatchIds(merchantIds)) {
            merchantNames.put(merchant.getId(), merchant.getName());
        }
        Map<Long, List<Long>> membersByMerchant = new HashMap<>();
        for (UserMerchantEntity binding : userMerchantMapper.selectList(
                new LambdaQueryWrapper<UserMerchantEntity>()
                        .in(UserMerchantEntity::getMerchantId, merchantIds)
                        .eq(UserMerchantEntity::getStatus, 1))) {
            if (binding.getUserId() == null) {
                continue;
            }
            membersByMerchant.computeIfAbsent(binding.getMerchantId(), key -> new ArrayList<>())
                    .add(binding.getUserId());
        }

        int targets = 0;
        int messages = 0;
        int skipped = 0;
        for (MerchantCertificateEntity certificate : certificates) {
            long days = ChronoUnit.DAYS.between(today, certificate.getExpireDate());
            String window = days < 0 ? WINDOW_EXPIRED : WINDOW_D30;
            String merchantName = merchantNames.getOrDefault(certificate.getMerchantId(), "所属主体");
            String title = "证照到期提醒";
            String content = days < 0
                    ? String.format("【%s】的《%s》已于 %s 过期（已过期 %d 天），请尽快换证并在「用户中心 → 资质证照」更新有效期。",
                    merchantName, certificate.getCertName(), certificate.getExpireDate(), -days)
                    : String.format("【%s】的《%s》将于 %s 到期（剩余 %d 天），请及时换证并在「用户中心 → 资质证照」更新有效期。",
                    merchantName, certificate.getCertName(), certificate.getExpireDate(), days);
            for (Long userId : membersByMerchant.getOrDefault(certificate.getMerchantId(), List.of())) {
                targets++;
                Long sent = reminderMapper.selectCount(new LambdaQueryWrapper<CertificateReminderEntity>()
                        .eq(CertificateReminderEntity::getCertId, certificate.getId())
                        .eq(CertificateReminderEntity::getWindowKey, window)
                        .eq(CertificateReminderEntity::getUserId, userId));
                if (sent != null && sent > 0) {
                    skipped++;
                    continue;
                }
                CertificateReminderEntity reminder = new CertificateReminderEntity();
                reminder.setCertId(certificate.getId());
                reminder.setMerchantId(certificate.getMerchantId());
                reminder.setUserId(userId);
                reminder.setWindowKey(window);
                reminder.setSentAt(LocalDateTime.now());
                try {
                    reminderMapper.insert(reminder);
                } catch (DuplicateKeyException e) {
                    // 并发下另一个实例先插进去了，按已发送处理
                    skipped++;
                    continue;
                }
                messageFacade.notify(userId, certificate.getMarketId(), title, content);
                messages++;
            }
        }
        return new ScanResult(certificates.size(), targets, messages, skipped);
    }
}
