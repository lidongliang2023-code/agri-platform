package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.ChannelPartner;
import com.agri.s2b2c.mapper.ChannelPartnerMapper;
import com.agri.s2b2c.security.SecurityUtils;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** 平台账号 ↔ 渠道合伙人档案。 */
@Service
@RequiredArgsConstructor
public class ChannelIdentityService {

    private final ChannelPartnerMapper channelPartnerMapper;

    public ChannelPartner currentOrNull() {
        Long userId = SecurityUtils.getUserId();
        if (userId == null) {
            return null;
        }
        return channelPartnerMapper.selectOne(new LambdaQueryWrapper<ChannelPartner>()
                .eq(ChannelPartner::getUserId, userId)
                .last("LIMIT 1"));
    }

    public ChannelPartner requireCurrent() {
        ChannelPartner partner = currentOrNull();
        if (partner == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "当前账号还没有渠道合伙人档案，请先提交入驻申请");
        }
        return partner;
    }

    /**
     * 渠道业务能力：入驻审核通过才可择品、看佣金。
     *
     * <p>审核状态只在 S2B2C 库，故能力判定放在这里，不经过核心平台。</p>
     */
    public ChannelPartner requireApprovedChannel(Long channelId) {
        ChannelPartner mine = requireCurrent();
        if (channelId != null && !channelId.equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作其他渠道的数据");
        }
        String auditStatus = mine.getAuditStatus();
        if (!"APPROVED".equalsIgnoreCase(auditStatus)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "渠道资质尚未通过审核（当前：" + (auditStatus == null ? "PENDING" : auditStatus) + "），通过后才能选品与结算");
        }
        return mine;
    }

    public void requireOwnChannel(Long channelId) {
        ChannelPartner mine = requireCurrent();
        if (channelId != null && !channelId.equals(mine.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作其他渠道的数据");
        }
    }
}
