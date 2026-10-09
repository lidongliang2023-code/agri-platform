package com.agri.produce.internal.message;

import com.agri.core.infra.web.MarketContext;
import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 站内通知（任务/告警/质检/系统） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class MessageNotifyService {

    private static final String ID_PREFIX = "MSGN";

    private final MessageNotifyMapper messageNotifyMapper;

    /**
     * 分页查询。
     *
     * @param keyword title 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<MessageNotifyEntity> page(long page, long size, String keyword, Integer status) {
        Page<MessageNotifyEntity> result = messageNotifyMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<MessageNotifyEntity>()
                        .like(keyword != null && !keyword.isBlank(), MessageNotifyEntity::getTitle, keyword)
                        .eq(status != null, MessageNotifyEntity::getStatus, status)
                        .orderByDesc(MessageNotifyEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public MessageNotifyEntity detail(String id) {
        MessageNotifyEntity entity = messageNotifyMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public MessageNotifyEntity create(MessageNotifyEntity entity) {
        if (entity.getMessageId() == null || entity.getMessageId().isBlank()) {
            entity.setMessageId(ProduceIds.newId(ID_PREFIX));
        }
        messageNotifyMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public MessageNotifyEntity update(String id, MessageNotifyEntity entity) {
        entity.setMessageId(id);
        messageNotifyMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        messageNotifyMapper.deleteById(id);
    }

    /** 发送消息 */
    @Transactional
    public MessageNotifyEntity send(MessageNotifyEntity message) {
        if (message.getMessageId() == null || message.getMessageId().isBlank()) {
            message.setMessageId(ProduceIds.newId("MSGN"));
        }
        message.setReadFlag(0);
        message.setSentAt(LocalDateTime.now());
        message.setStatus(1);
        messageNotifyMapper.insert(message);
        return message;
    }

    /** 标记已读 */
    @Transactional
    public MessageNotifyEntity markRead(String messageId) {
        MessageNotifyEntity message = detail(messageId);
        message.setReadFlag(1);
        message.setReadAt(LocalDateTime.now());
        messageNotifyMapper.updateById(message);
        return message;
    }

    /**
     * 未读数。
     *
     * <p>{@code receiverId} 可为空：为空时取当前登录用户（「我的未读」语义），
     * 由服务端从认证上下文解析，避免前端自行拼装、也避免传入他人标识越权查询。
     *
     * @param receiverId 接收人标识（prod_message_notify.receiver_id，VARCHAR(32) 存平台用户ID）；
     *                   为空或空白时回落到当前登录用户
     * @return 未读条数
     * @throws BusinessException 既未传入 receiverId、认证上下文也取不到用户标识时抛出（401）
     */
    public long unreadCount(String receiverId) {
        return messageNotifyMapper.selectCount(new LambdaQueryWrapper<MessageNotifyEntity>()
                .eq(MessageNotifyEntity::getReceiverId, resolveReceiverId(receiverId))
                .eq(MessageNotifyEntity::getReadFlag, 0)
                .eq(MessageNotifyEntity::getStatus, 1));
    }

    /**
     * 确定接收人标识：优先用显式入参，缺省回落到当前登录用户。
     *
     * <p>口径说明：生产域对平台用户的引用统一为 {@code VARCHAR(32)} 存平台用户ID
     * （见 prod_member.user_id「平台用户ID」），故此处以
     * {@code String.valueOf(userId)} 与 receiver_id 对齐，而非用 username。
     *
     * @param receiverId 显式入参，可为空
     * @return 非空接收人标识
     * @throws BusinessException 入参为空且认证上下文无用户标识（未登录 / 系统调度）时抛出
     */
    private String resolveReceiverId(String receiverId) {
        if (receiverId != null && !receiverId.isBlank()) {
            return receiverId.trim();
        }
        Long currentUserId = MarketContext.currentUserId();
        if (currentUserId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED,
                    "无法确定接收人：未传入 receiverId，且当前认证上下文中没有用户标识");
        }
        return String.valueOf(currentUserId);
    }
}
