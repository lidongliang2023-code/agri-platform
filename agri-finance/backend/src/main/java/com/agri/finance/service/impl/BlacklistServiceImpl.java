package com.agri.finance.service.impl;

import com.agri.finance.entity.Blacklist;
import com.agri.finance.mapper.BlacklistMapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class BlacklistServiceImpl extends ServiceImpl<BlacklistMapper, Blacklist> {

    public Blacklist addToBlacklist(Blacklist blacklist) {
        blacklist.setListNo("BL" + System.currentTimeMillis());
        blacklist.setReviewStatus("待复核");
        blacklist.setAddedTime(LocalDateTime.now());
        blacklist.setCreatedAt(LocalDateTime.now());
        blacklist.setUpdatedAt(LocalDateTime.now());
        blacklist.setDelFlag(0);
        save(blacklist);
        return blacklist;
    }

    public Blacklist approveBlacklist(String id, String reviewerId, String reviewerName) {
        Blacklist blacklist = getById(id);
        if (blacklist != null) {
            blacklist.setReviewStatus("已通过");
            blacklist.setReviewerId(reviewerId);
            blacklist.setReviewerName(reviewerName);
            blacklist.setUpdatedAt(LocalDateTime.now());
            updateById(blacklist);
        }
        return blacklist;
    }

    public Blacklist removeFromBlacklist(String id) {
        Blacklist blacklist = getById(id);
        if (blacklist != null) {
            blacklist.setRemovedTime(LocalDateTime.now());
            blacklist.setUpdatedAt(LocalDateTime.now());
            updateById(blacklist);
        }
        return blacklist;
    }
}
