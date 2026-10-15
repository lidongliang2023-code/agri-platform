package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.MessageNotify;
import com.agri.production.mapper.MessageNotifyMapper;
import com.agri.production.service.IUserMessageService;
import com.agri.production.vo.UserMessageVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 用户端消息中心实现。
 *
 * <p>租户由控制器传入（{@code TenantContextService}），本类只负责查询与状态流转。</p>
 */
@Slf4j
@Service
public class UserMessageServiceImpl implements IUserMessageService {

    private static final int READ_FLAG_YES = 1;
    private static final int READ_FLAG_NO = 0;

    private final MessageNotifyMapper messageMapper;

    public UserMessageServiceImpl(MessageNotifyMapper messageMapper) {
        this.messageMapper = messageMapper;
    }

    @Override
    public PageResult<UserMessageVO> page(int pageNum, int pageSize, String tenantId, String keyword,
                                         Integer messageType, Boolean isRead) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<MessageNotify> w = baseWrapper(tenantId);
        // 撤回的消息不出现在收件箱：状态是数据方给的，页面没有"撤回"入口，这里按未撤回查询
        w.eq(MessageNotify::getStatus, 1);
        if (keyword != null && !keyword.isBlank()) {
            String kw = keyword.trim();
            w.and(q -> q.like(MessageNotify::getTitle, kw).or().like(MessageNotify::getContent, kw));
        }
        List<String> types = MsgTypeCode.toDbTypes(messageType);
        if (types != null) {
            w.in(MessageNotify::getMsgType, types);
        }
        if (isRead != null) {
            w.eq(MessageNotify::getReadFlag, isRead ? READ_FLAG_YES : READ_FLAG_NO);
        }
        // 发送时间倒序；再按自增 id 倒序，同一秒的多条也有稳定顺序（否则分页会串）
        w.orderByDesc(MessageNotify::getSentAt).orderByDesc(MessageNotify::getId);
        Page<MessageNotify> page = messageMapper.selectPage(new Page<>(p, s), w);
        List<UserMessageVO> rows = page.getRecords().stream().map(UserMessageVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    public int unreadCount(String tenantId, String receiverId) {
        LambdaQueryWrapper<MessageNotify> w = baseWrapper(tenantId)
                .eq(MessageNotify::getStatus, 1)
                .eq(MessageNotify::getReadFlag, READ_FLAG_NO);
        if (receiverId != null && !receiverId.isBlank()) {
            w.eq(MessageNotify::getReceiverId, receiverId.trim());
        }
        Long hits = messageMapper.selectCount(w);
        return hits == null ? 0 : hits.intValue();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public UserMessageVO markRead(String tenantId, String messageId) {
        MessageNotify message = requireMessage(tenantId, messageId);
        if (!Integer.valueOf(READ_FLAG_YES).equals(message.getReadFlag())) {
            message.setReadFlag(READ_FLAG_YES);
            message.setReadAt(LocalDateTime.now());
            message.setUpdateTime(LocalDateTime.now());
            messageMapper.updateById(message);
            log.info("消息标记已读：{}", message.getMessageId());
        }
        return UserMessageVO.of(messageMapper.selectById(message.getId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int markAllRead(String tenantId) {
        List<MessageNotify> unread = messageMapper.selectList(baseWrapper(tenantId)
                .eq(MessageNotify::getStatus, 1)
                .eq(MessageNotify::getReadFlag, READ_FLAG_NO));
        LocalDateTime now = LocalDateTime.now();
        for (MessageNotify message : unread) {
            message.setReadFlag(READ_FLAG_YES);
            message.setReadAt(now);
            message.setUpdateTime(now);
            messageMapper.updateById(message);
        }
        log.info("消息一键已读：{} 条", unread.size());
        return unread.size();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(String tenantId, String messageId) {
        MessageNotify message = requireMessage(tenantId, messageId);
        messageMapper.deleteById(message.getId());
        log.info("消息删除：{}", message.getMessageId());
    }

    /* ==================== 内部工具 ==================== */

    /** 租户条件：本服务所有用户端查询都不接受"看全部"。 */
    private LambdaQueryWrapper<MessageNotify> baseWrapper(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法查询消息");
        }
        return new LambdaQueryWrapper<MessageNotify>().eq(MessageNotify::getTenantId, tenantId);
    }

    /**
     * 取一条属于本租户的消息。
     *
     * <p>按 message_id + 租户查，而不是按自增 id：页面给的是 messageId，
     * 而"用 id 查、不校验租户"会让别的租户的消息被标记已读/被删掉。</p>
     */
    private MessageNotify requireMessage(String tenantId, String messageId) {
        if (messageId == null || messageId.isBlank()) {
            throw new BusinessException(400, "缺少消息编号");
        }
        MessageNotify message = messageMapper.selectOne(baseWrapper(tenantId)
                .eq(MessageNotify::getMessageId, messageId.trim())
                .last("LIMIT 1"));
        if (message == null) {
            throw new BusinessException(404, "消息不存在：" + messageId.trim());
        }
        return message;
    }

    /** 页面数值编码 → 库里的字符串口径（与前端 normalizeMessageType 同一张映射）。 */
    private static final class MsgTypeCode {

        private MsgTypeCode() {
        }

        static List<String> toDbTypes(Integer code) {
            if (code == null) {
                return null;
            }
            return switch (code) {
                case 2 -> List.of("TASK");
                case 3 -> List.of("ALERT");
                case 4 -> List.of("QUALITY", "AUDIT", "APPROVAL");
                case 1 -> List.of("SYSTEM");
                default -> null;
            };
        }
    }
}
