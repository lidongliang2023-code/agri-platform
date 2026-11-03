package com.agri.platform.internal.uc;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 消息推送的后台投递器。
 *
 * <p>为什么单独一个 Bean：{@link MessagePushService#deliverBatch} 带 {@code @Transactional}，
 * 如果在 service 内部自己调自己，会绕过 Spring 的代理，事务注解直接失效 ——
 * 那样"站内信插了一半、名单没删"就无法回滚，重试会重复发送。
 * 由这里（外部 Bean）调用，代理才生效。</p>
 *
 * <p><b>永不抛异常</b>：调度线程抛异常会让后续 tick 一起停掉。
 * 单次失败只记 warn，任务本身会被标记 failed，运营在页面上能看到原因。</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MessagePushWorker {

    private final MessagePushService pushService;

    @Scheduled(fixedDelayString = "${agri.uc.push.interval-ms:3000}")
    public void tick() {
        try {
            // 1) 新任务：解析人群，落投递名单
            pushService.prepareQueued();
            // 2) 在投任务：各投一批（每批 500）
            for (MessagePushTaskEntity task : pushService.pickSending()) {
                pushService.deliverBatch(task);
            }
        } catch (RuntimeException e) {
            log.warn("推送投递调度异常（不影响下一轮）：{}", e.getMessage());
        }
    }
}
