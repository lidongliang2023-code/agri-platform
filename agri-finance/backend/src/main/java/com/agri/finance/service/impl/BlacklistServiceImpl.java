package com.agri.finance.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.finance.entity.Blacklist;
import com.agri.finance.mapper.BlacklistMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
public class BlacklistServiceImpl extends ServiceImpl<BlacklistMapper, Blacklist> {

    private final MessageNotificationServiceImpl messageService;

    public BlacklistServiceImpl(MessageNotificationServiceImpl messageService) {
        this.messageService = messageService;
    }

    /** 该主体当前是否在生效黑名单中（申请融资的前置闸门）。 */
    public Blacklist activeEntry(String userId) {
        if (userId == null || userId.isBlank()) {
            return null;
        }
        return getOne(new LambdaQueryWrapper<Blacklist>()
                .eq(Blacklist::getUserId, userId)
                .eq(Blacklist::getDelFlag, 0)
                .eq(Blacklist::getReviewStatus, "已通过")
                .isNull(Blacklist::getRemovedTime)
                .orderByDesc(Blacklist::getAddedTime)
                .last("LIMIT 1"));
    }

    public Blacklist addToBlacklist(Blacklist blacklist) {
        if (blacklist == null || blacklist.getUserId() == null || blacklist.getUserId().isBlank()) {
            throw new BusinessException(400, "请填写被列入主体的编号");
        }
        if (blacklist.getReason() == null || blacklist.getReason().isBlank()) {
            throw new BusinessException(400, "请填写列入理由");
        }
        Blacklist active = activeEntry(blacklist.getUserId());
        if (active != null) {
            throw new BusinessException(409, "该主体已在生效黑名单中（" + active.getListNo() + "），请勿重复列入");
        }
        blacklist.setListNo("BL" + System.currentTimeMillis());
        blacklist.setReviewStatus("待复核");
        blacklist.setAddedTime(LocalDateTime.now());
        blacklist.setCreatedAt(LocalDateTime.now());
        blacklist.setUpdatedAt(LocalDateTime.now());
        blacklist.setDelFlag(0);
        save(blacklist);
        messageService.notify(blacklist.getUserId(), "RISK", "融资资格被提交复核",
                "因「" + blacklist.getReason() + "」被列入黑名单候选，平台复核通过后将无法发起新的融资申请。",
                "BLACKLIST", blacklist.getId(), "HIGH");
        return blacklist;
    }

    @Transactional
    public Blacklist approveBlacklist(String id, String reviewerId, String reviewerName) {
        Blacklist blacklist = getById(id);
        if (blacklist == null || Integer.valueOf(1).equals(blacklist.getDelFlag())) {
            throw new BusinessException(404, "黑名单记录不存在");
        }
        if ("已通过".equals(blacklist.getReviewStatus())) {
            throw new BusinessException(409, "该记录已复核通过，无需重复操作");
        }
        blacklist.setReviewStatus("已通过");
        blacklist.setReviewerId(reviewerId);
        blacklist.setReviewerName(reviewerName);
        blacklist.setUpdatedAt(LocalDateTime.now());
        updateById(blacklist);
        messageService.notify(blacklist.getUserId(), "RISK", "黑名单已生效",
                "因「" + blacklist.getReason() + "」被列入黑名单，现在起无法发起新的融资申请；"
                        + "结清欠款并整改后可申请解除。", "BLACKLIST", blacklist.getId(), "HIGH");
        return blacklist;
    }

    @Transactional
    public Blacklist removeFromBlacklist(String id) {
        Blacklist blacklist = getById(id);
        if (blacklist == null || Integer.valueOf(1).equals(blacklist.getDelFlag())) {
            throw new BusinessException(404, "黑名单记录不存在");
        }
        if (blacklist.getRemovedTime() != null) {
            return blacklist;
        }
        blacklist.setRemovedTime(LocalDateTime.now());
        blacklist.setUpdatedAt(LocalDateTime.now());
        updateById(blacklist);
        messageService.notify(blacklist.getUserId(), "RISK", "黑名单已解除",
                "黑名单记录 " + blacklist.getListNo() + " 已解除，可以重新发起融资申请。",
                "BLACKLIST", blacklist.getId(), "MEDIUM");
        return blacklist;
    }
}
