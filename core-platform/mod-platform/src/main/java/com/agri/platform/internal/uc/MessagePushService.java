package com.agri.platform.internal.uc;

import com.agri.platform.internal.account.MerchantCertificateEntity;
import com.agri.platform.internal.account.MerchantCertificateMapper;
import com.agri.platform.internal.identity.UserIdentityEntity;
import com.agri.platform.internal.identity.UserIdentityMapper;
import com.agri.platform.internal.merchant.MerchantEntity;
import com.agri.platform.internal.merchant.MerchantMapper;
import com.agri.platform.internal.merchant.UserMerchantEntity;
import com.agri.platform.internal.merchant.UserMerchantMapper;
import com.agri.platform.internal.message.MessageEntity;
import com.agri.platform.internal.message.MessageMapper;
import com.agri.platform.internal.user.UserEntity;
import com.agri.platform.internal.user.UserMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/**
 * 消息推送：人群解析 + 入队 + 分批投递。
 *
 * <p><b>为什么改成异步</b>：原先是请求里同步循环插站内信，还有 2000 人的硬上限 ——
 * 再多就超时，而超时不会回滚已插入的站内信，用户收到一半、运营看到 500。
 * 现在请求只负责建任务，投递交给 {@link MessagePushWorker} 每批 500 条地做。</p>
 *
 * <p><b>可恢复</b>：人群名单落在 {@code platform_uc_push_target}，投递一条删一条。
 * 进程中途重启，下一次 tick 会接着把剩下的发完，不会重复也不会漏。</p>
 *
 * <p><b>单实例假设</b>：多实例同时跑 worker 可能重复投递同一批（没有分布式锁）。
 * 当前核心平台是模块化单体、单实例部署，故未引入锁；真要多实例需加
 * 任务级的 SELECT ... FOR UPDATE 或 Redis 锁。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MessagePushService {

    /**
     * 每批投递条数：太小网络往返多，太大单事务长且失败重试代价高。
     *
     * <p>做成可配置是为了能在小数据量下验证多批逻辑（把 batch-size 调成 10，
     * 29 个人就会跑 3 批），否则线上永远是"一批就发完"，多批分支等于没被测过。</p>
     */
    @org.springframework.beans.factory.annotation.Value("${agri.uc.push.batch-size:500}")
    private int batchSize = 500;

    public static final String STATUS_QUEUED = "queued";
    public static final String STATUS_SENDING = "sending";
    public static final String STATUS_SENT = "sent";
    public static final String STATUS_FAILED = "failed";

    private final MessagePushTaskMapper taskMapper;
    private final PushTargetMapper targetMapper;
    private final MessageMapper messageMapper;
    private final UserMapper userMapper;
    private final UserIdentityMapper userIdentityMapper;
    private final MerchantMapper merchantMapper;
    private final UserMerchantMapper userMerchantMapper;
    private final MerchantCertificateMapper merchantCertificateMapper;

    // ==================== 人群 ====================

    /**
     * 按人群解析目标用户 ID。口径与用户端「我的身份」一致，不另立标准。
     *
     * <p>{@code wholesaler} 目前仍按全量处理（依赖尚未落地的身份分类），发前页面会标明预估人数。</p>
     *
     * <p>{@code cert_expiring} 按**证照真实有效期**解析：取 30 天内到期（含已过期）的有效证照，
     * 经主体成员关系反查用户。证照属于主体而不是个人，所以一条临期证照会命中该主体的全部成员 ——
     * 与「资质证照」页"同一主体的成员都能看到"的口径一致。</p>
     */
    public List<Long> resolveAudienceIds(String audience) {
        String key = audience == null || audience.isBlank() ? "all" : audience;
        LambdaQueryWrapper<UserEntity> wrapper = new LambdaQueryWrapper<UserEntity>()
                .eq(UserEntity::getStatus, 1);
        switch (key) {
            case "realname" -> {
                // 实名通过态是 verified（不是 approved）
                List<Long> ids = userIdentityMapper.selectList(new LambdaQueryWrapper<UserIdentityEntity>()
                                .eq(UserIdentityEntity::getStatus, "verified"))
                        .stream().map(UserIdentityEntity::getUserId).filter(Objects::nonNull).distinct().toList();
                if (ids.isEmpty()) {
                    return List.of();
                }
                wrapper.in(UserEntity::getId, ids);
            }
            case "enterprise" -> {
                // 先拿已认证组织，再经 platform_user_merchant 反查成员 ——
                // 组织 ID 和用户 ID 都是雪花 ID，混用不会报错，只会查不到人
                List<Long> merchantIds = merchantMapper.selectList(new LambdaQueryWrapper<MerchantEntity>()
                                .eq(MerchantEntity::getVerifyStatus, "approved"))
                        .stream().map(MerchantEntity::getId).toList();
                if (merchantIds.isEmpty()) {
                    return List.of();
                }
                List<Long> userIds = userMerchantMapper.selectList(
                                new LambdaQueryWrapper<UserMerchantEntity>()
                                        .in(UserMerchantEntity::getMerchantId, merchantIds))
                        .stream().map(UserMerchantEntity::getUserId)
                        .filter(Objects::nonNull).distinct().toList();
                if (userIds.isEmpty()) {
                    return List.of();
                }
                wrapper.in(UserEntity::getId, userIds);
            }
            case "inactive" -> wrapper.lt(UserEntity::getUpdatedAt, LocalDateTime.now().minusDays(30));
            case "cert_expiring" -> {
                LocalDate deadline = LocalDate.now().plusDays(30);
                List<Long> merchantIds = merchantCertificateMapper.selectList(
                                new LambdaQueryWrapper<MerchantCertificateEntity>()
                                        .eq(MerchantCertificateEntity::getStatus, "active")
                                        .isNotNull(MerchantCertificateEntity::getExpireDate)
                                        .le(MerchantCertificateEntity::getExpireDate, deadline))
                        .stream().map(MerchantCertificateEntity::getMerchantId)
                        .filter(Objects::nonNull).distinct().toList();
                if (merchantIds.isEmpty()) {
                    return List.of();
                }
                List<Long> userIds = userMerchantMapper.selectList(
                                new LambdaQueryWrapper<UserMerchantEntity>()
                                        .in(UserMerchantEntity::getMerchantId, merchantIds)
                                        .eq(UserMerchantEntity::getStatus, 1))
                        .stream().map(UserMerchantEntity::getUserId)
                        .filter(Objects::nonNull).distinct().toList();
                if (userIds.isEmpty()) {
                    return List.of();
                }
                wrapper.in(UserEntity::getId, userIds);
            }
            default -> {
                // all 及未实现的人群：全量
            }
        }
        return userMapper.selectList(wrapper).stream().map(UserEntity::getId).toList();
    }

    /** 预估触达人数：发之前先让人知道会发给谁，避免"手滑全量群发"。 */
    public int countAudience(String audience) {
        return resolveAudienceIds(audience).size();
    }

    // ==================== 入队 ====================

    /**
     * 建任务并立即返回，投递交给 worker。
     *
     * @return 任务 ID
     */
    public Long enqueue(String title, String content, String templateCode, String audience,
                        String channels, String operatorName) {
        MessagePushTaskEntity task = new MessagePushTaskEntity();
        task.setTitle(title);
        task.setContent(content);
        task.setTemplateCode(templateCode);
        task.setAudience(audience == null || audience.isBlank() ? "all" : audience);
        task.setChannels(channels == null || channels.isBlank() ? "station" : channels);
        task.setTargetCount(0);
        task.setReachCount(0);
        task.setOpenRate(BigDecimal.ZERO);
        task.setStatus(STATUS_QUEUED);
        task.setOperatorName(operatorName);
        taskMapper.insert(task);
        return task.getId();
    }

    // ==================== 投递 ====================

    /**
     * 把 queued 的任务解析成名单，转成 sending。
     *
     * <p>每轮只处理 3 个，避免一次调度把线程占满。</p>
     */
    public void prepareQueued() {
        List<MessagePushTaskEntity> queued = taskMapper.selectList(new LambdaQueryWrapper<MessagePushTaskEntity>()
                .eq(MessagePushTaskEntity::getStatus, STATUS_QUEUED)
                .orderByAsc(MessagePushTaskEntity::getId)
                .last("LIMIT 3"));
        for (MessagePushTaskEntity task : queued) {
            prepareTargets(task);
        }
    }

    /** 取出待投递的任务（每轮最多 3 个）。 */
    public List<MessagePushTaskEntity> pickSending() {
        return taskMapper.selectList(new LambdaQueryWrapper<MessagePushTaskEntity>()
                .eq(MessagePushTaskEntity::getStatus, STATUS_SENDING)
                .orderByAsc(MessagePushTaskEntity::getId)
                .last("LIMIT 3"));
    }

    /** queued → 固化人群名单 → sending。名单为空则直接 sent。 */
    private void prepareTargets(MessagePushTaskEntity task) {
        try {
            List<Long> userIds = resolveAudienceIds(task.getAudience());
            for (Long userId : userIds) {
                PushTargetEntity target = new PushTargetEntity();
                target.setTaskId(task.getId());
                target.setUserId(userId);
                target.setMarketId(task.getMarketId());
                targetMapper.insert(target);
            }
            task.setTargetCount(userIds.size());
            task.setStatus(userIds.isEmpty() ? STATUS_SENT : STATUS_SENDING);
            if (userIds.isEmpty()) {
                task.setSendTime(LocalDateTime.now());
            }
            taskMapper.updateById(task);
            log.info("推送任务 {} 人群已固化：{} 人（audience={}）",
                    task.getId(), userIds.size(), task.getAudience());
        } catch (RuntimeException e) {
            markFailed(task, "解析人群失败：" + e.getMessage());
        }
    }

    /**
     * 投一批（最多 BATCH_SIZE 条），发完删名单，名单空了置 sent。
     *
     * <p><b>必须由外部 Bean 调用</b>：同类内部自调用会绕过 Spring 事务代理，
     * {@code @Transactional} 直接失效 —— 那样"插了站内信但没删名单"的中间态就无法回滚，
     * 重试会重复发送。所以调度由 {@link MessagePushWorker} 负责，它调的是代理对象。</p>
     */
    @Transactional(rollbackFor = Exception.class)
    public void deliverBatch(MessagePushTaskEntity task) {
        List<PushTargetEntity> batch = targetMapper.selectList(
                new LambdaQueryWrapper<PushTargetEntity>()
                        .eq(PushTargetEntity::getTaskId, task.getId())
                        .orderByAsc(PushTargetEntity::getId)
                        .last("LIMIT " + batchSize));
        if (batch.isEmpty()) {
            finish(task);
            return;
        }
        try {
            long maxId = 0L;
            for (PushTargetEntity target : batch) {
                MessageEntity message = new MessageEntity();
                message.setUserId(target.getUserId());
                message.setTitle(task.getTitle());
                message.setContent(task.getContent() == null ? "" : task.getContent());
                message.setReadFlag(0);
                // worker 线程没有会话上下文，市场维度取任务上的值，避免落到默认市场
                message.setMarketId(task.getMarketId());
                messageMapper.insert(message);
                maxId = Math.max(maxId, target.getId());
            }
            // 物理删除：实体带 @TableLogic，deleteBatchIds 只会标记 deleted=1，名单行会永久堆积
            targetMapper.deleteUpTo(task.getId(), maxId);

            task.setReachCount(safeInt(task.getReachCount()) + batch.size());
            taskMapper.updateById(task);

            // 这一批不满说明名单已空，直接收尾，省一次空查询
            if (batch.size() < batchSize) {
                finish(task);
            }
        } catch (RuntimeException e) {
            markFailed(task, "投递失败：" + e.getMessage());
            log.error("推送任务 {} 投递失败：{}", task.getId(), e.getMessage());
        }
    }

    private void finish(MessagePushTaskEntity task) {
        task.setStatus(STATUS_SENT);
        task.setSendTime(LocalDateTime.now());
        taskMapper.updateById(task);
        log.info("推送任务 {} 已完成：触达 {} 人", task.getId(), task.getReachCount());
    }

    private void markFailed(MessagePushTaskEntity task, String reason) {
        task.setStatus(STATUS_FAILED);
        task.setFailReason(reason == null ? null : reason.substring(0, Math.min(reason.length(), 250)));
        taskMapper.updateById(task);
    }

    private static int safeInt(Integer value) {
        return value == null ? 0 : value;
    }
}
