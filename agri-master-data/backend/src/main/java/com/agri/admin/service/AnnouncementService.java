package com.agri.admin.service;

import com.agri.admin.controller.AnnouncementController;
import com.agri.common.constant.ErrorCode;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.security.SecurityUtils;
import com.agri.masterdata.entity.Announcement;
import com.agri.masterdata.mapper.AnnouncementMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** 平台公告：草稿 / 发布 / 下线。 */
@Service
@RequiredArgsConstructor
public class AnnouncementService {

    private static final Set<String> TYPES = Set.of("info", "warning", "maintenance", "emergency");
    private static final Set<String> STATUSES = Set.of("draft", "published", "offline");

    private final AnnouncementMapper announcementMapper;

    public PageResult<Announcement> page(Integer pageNum, Integer pageSize, String status,
                                         String type, String keyword) {
        LambdaQueryWrapper<Announcement> wrapper = new LambdaQueryWrapper<Announcement>()
                .eq(hasText(status), Announcement::getStatus, status)
                .eq(hasText(type), Announcement::getType, type)
                .and(hasText(keyword), w -> w.like(Announcement::getTitle, keyword)
                        .or().like(Announcement::getContent, keyword))
                .orderByDesc(Announcement::getId);
        Page<Announcement> page = announcementMapper.selectPage(new Page<>(pageNum, pageSize), wrapper);
        return PageResult.success(page.getRecords(), page.getTotal(), pageNum, pageSize);
    }

    /**
     * 用户端可见的公告：已发布且未到期（到期时间空表示长期）。
     *
     * <p>平台公告不做主体过滤；limit 由调用方给，服务端再夹到 1~50 防误传大值。</p>
     */
    public List<Announcement> listPublished(Integer limit) {
        int size = limit == null ? 20 : Math.max(1, Math.min(50, limit));
        LocalDateTime now = LocalDateTime.now();
        return announcementMapper.selectList(new LambdaQueryWrapper<Announcement>()
                .eq(Announcement::getStatus, "published")
                .and(w -> w.isNull(Announcement::getExpireTime).or().gt(Announcement::getExpireTime, now))
                .orderByDesc(Announcement::getPublishTime)
                .last("LIMIT " + size));
    }

    /**
     * 公告的对外只读视图：用户端公告中心与官网门户首页公告块共用同一份形状。
     *
     * <p>id 转字符串下发（雪花/长整型直接进 JS 会丢精度，前端拿它做 key 或对不上号）。</p>
     */
    public List<Map<String, Object>> publishedViews(Integer limit) {
        List<Map<String, Object>> views = new ArrayList<>();
        for (Announcement row : listPublished(limit)) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", String.valueOf(row.getId()));
            item.put("title", row.getTitle());
            item.put("type", row.getType());
            item.put("content", row.getContent());
            item.put("publishTime", row.getPublishTime());
            item.put("expireTime", row.getExpireTime());
            views.add(item);
        }
        return views;
    }

    @Transactional
    public Long create(AnnouncementController.AnnouncementRequest request) {
        Announcement entity = new Announcement();
        apply(entity, request);
        boolean publishNow = Boolean.TRUE.equals(request.publishNow());
        entity.setStatus(publishNow ? "published" : "draft");
        if (publishNow) {
            entity.setPublishTime(request.publishTime() == null ? LocalDateTime.now() : request.publishTime());
            entity.setAuthor(SecurityUtils.getUsername());
        }
        announcementMapper.insert(entity);
        return entity.getId();
    }

    @Transactional
    public void update(Long id, AnnouncementController.AnnouncementRequest request) {
        Announcement entity = require(id);
        // 已发布的公告允许改正文（运营口径），但发布状态与发布时间不在这里改
        apply(entity, request);
        entity.setUpdateBy(SecurityUtils.getUsername());
        announcementMapper.updateById(entity);
    }

    @Transactional
    public void publish(Long id) {
        Announcement entity = require(id);
        if ("published".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.OPERATION_FAILED, "公告已发布，无需重复操作");
        }
        entity.setStatus("published");
        entity.setPublishTime(LocalDateTime.now());
        entity.setAuthor(SecurityUtils.getUsername());
        entity.setUpdateBy(SecurityUtils.getUsername());
        announcementMapper.updateById(entity);
    }

    @Transactional
    public void offline(Long id) {
        Announcement entity = require(id);
        if ("offline".equals(entity.getStatus())) {
            throw new BusinessException(ErrorCode.OPERATION_FAILED, "公告已下线");
        }
        entity.setStatus("offline");
        entity.setUpdateBy(SecurityUtils.getUsername());
        announcementMapper.updateById(entity);
    }

    private Announcement require(Long id) {
        Announcement entity = announcementMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.DATA_NOT_FOUND, "公告不存在");
        }
        return entity;
    }

    private void apply(Announcement entity, AnnouncementController.AnnouncementRequest request) {
        String title = trim(request.title());
        if (title == null) {
            throw new BusinessException(ErrorCode.PARAM_NOT_NULL, "公告标题不能为空");
        }
        String content = trim(request.content());
        if (content == null) {
            throw new BusinessException(ErrorCode.PARAM_NOT_NULL, "公告内容不能为空");
        }
        String type = trim(request.type());
        if (type != null && !TYPES.contains(type)) {
            throw new BusinessException(ErrorCode.PARAM_FORMAT_ERROR, "公告类型不合法");
        }
        entity.setTitle(title);
        entity.setContent(content);
        entity.setType(type == null ? "info" : type);
        entity.setExpireTime(request.expireTime());
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String trim(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
