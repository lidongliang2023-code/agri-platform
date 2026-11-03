package com.agri.production.service.impl;

import com.agri.production.entity.MessageNotify;
import com.agri.production.entity.TeamMember;
import com.agri.production.mapper.MessageNotifyMapper;
import com.agri.production.mapper.TeamMemberMapper;
import com.agri.production.service.IProductionNotificationService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/** 生产域站内消息实现（仅 INBOX，不调用外部短信/微信通道）。 */
@Slf4j
@Service
public class ProductionNotificationServiceImpl implements IProductionNotificationService {

    private static final DateTimeFormatter CODE_TIME = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    private final MessageNotifyMapper messageMapper;
    private final TeamMemberMapper memberMapper;

    public ProductionNotificationServiceImpl(MessageNotifyMapper messageMapper, TeamMemberMapper memberMapper) {
        this.messageMapper = messageMapper;
        this.memberMapper = memberMapper;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void notify(String tenantId, String farmId, String receiverId, String type, String title,
                       String content, String bizId, String linkPath) {
        if (tenantId == null || tenantId.isBlank()) {
            log.warn("跳过生产域站内消息：租户上下文为空，type={} bizId={}", type, bizId);
            return;
        }
        List<String> receivers = resolveReceivers(tenantId, farmId, receiverId);
        if (receivers.isEmpty()) {
            receivers = List.of("");
        }
        for (String receiver : receivers) {
            MessageNotify message = new MessageNotify();
            message.setMessageId(nextMessageId());
            message.setTenantId(tenantId);
            message.setFarmId(blankToNull(farmId));
            message.setReceiverId(receiver);
            message.setMsgType(normalizeType(type));
            message.setTitle(title);
            message.setContent(content);
            message.setBizId(blankToNull(bizId));
            message.setLinkPath(blankToNull(linkPath));
            message.setReadFlag(0);
            message.setSentAt(LocalDateTime.now());
            message.setChannel("INBOX");
            message.setStatus(1);
            message.setCreateTime(LocalDateTime.now());
            message.setUpdateTime(LocalDateTime.now());
            message.setDeleted(0);
            messageMapper.insert(message);
        }
    }

    private List<String> resolveReceivers(String tenantId, String farmId, String receiverId) {
        if (receiverId == null || receiverId.isBlank()) {
            return List.of();
        }
        Set<String> resolved = new LinkedHashSet<>();
        for (String raw : Arrays.stream(receiverId.split("[,，;；]"))
                .map(String::trim).filter(value -> !value.isEmpty()).toList()) {
            TeamMember member = findMember(tenantId, raw);
            resolved.add(member == null ? raw : member.getMemberId());
        }
        return new ArrayList<>(resolved);
    }

    private TeamMember findMember(String tenantId, String value) {
        LambdaQueryWrapper<TeamMember> wrapper = new LambdaQueryWrapper<TeamMember>()
                .eq(TeamMember::getTenantId, tenantId);
        if (value.chars().allMatch(Character::isDigit)) {
            wrapper.and(q -> q.eq(TeamMember::getMemberId, value).or().eq(TeamMember::getId, Long.valueOf(value)));
        } else {
            wrapper.eq(TeamMember::getMemberId, value);
        }
        return memberMapper.selectOne(wrapper.last("LIMIT 1"));
    }

    private static String normalizeType(String type) {
        if (type == null || type.isBlank()) {
            return "SYSTEM";
        }
        return switch (type.trim().toUpperCase()) {
            case "TASK", "ALERT", "QUALITY", "APPROVAL" -> type.trim().toUpperCase();
            default -> "SYSTEM";
        };
    }

    private static String nextMessageId() {
        return "MSG" + LocalDateTime.now().format(CODE_TIME)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
