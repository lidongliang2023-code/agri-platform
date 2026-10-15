package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.FoodSafetyColdChainMatch;
import com.agri.production.entity.FoodSafetyColdChainResource;
import com.agri.production.mapper.FoodSafetyColdChainMatchMapper;
import com.agri.production.mapper.FoodSafetyColdChainResourceMapper;
import com.agri.production.service.IAdminFoodSafetyColdChainService;
import com.agri.production.vo.AdminFsColdChainMatchVO;
import com.agri.production.vo.AdminFsColdChainResourceVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端：冷链资源撮合实现（P19）。口径与平台侧 AdminFoodSafetyColdChainService 对齐。
 */
@Slf4j
@Service
public class AdminFoodSafetyColdChainServiceImpl implements IAdminFoodSafetyColdChainService {

    private static final String FILTER_ALL = "all";
    private static final String STATUS_IDLE = "idle";
    private static final String STATUS_BUSY = "busy";
    private static final String STATUS_OFFLINE = "offline";
    private static final String MATCH_PROCESSING = "processing";
    private static final String MATCH_DONE = "done";
    private static final String MATCH_QUEUED = "queued";
    private static final int REMARK_MAX_LENGTH = 200;
    private static final int CARGO_MAX_LENGTH = 50;
    private static final int TEMP_REQUIRE_MAX_LENGTH = 30;
    private static final int DEMANDER_MAX_LENGTH = 60;
    /** 运营端数据属于演示租户（一主体一租户；运营端不按租户过滤，见接口注释） */
    private static final String DEFAULT_TENANT = "2001";
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final FoodSafetyColdChainResourceMapper resourceMapper;
    private final FoodSafetyColdChainMatchMapper matchMapper;

    public AdminFoodSafetyColdChainServiceImpl(FoodSafetyColdChainResourceMapper resourceMapper,
                                              FoodSafetyColdChainMatchMapper matchMapper) {
        this.resourceMapper = resourceMapper;
        this.matchMapper = matchMapper;
    }

    @Override
    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", countResource(null));
        result.put("available", countResource(STATUS_IDLE));
        result.put("busy", countResource(STATUS_BUSY));
        result.put("offline", countResource(STATUS_OFFLINE));
        Long totalMatches = matchMapper.selectCount(new LambdaQueryWrapper<>());
        long total = totalMatches == null ? 0L : totalMatches;
        if (total == 0) {
            // 没有撮合记录时给 null —— 0% 的语义是"撮过、全失败"，与"还没撮过"是两件事
            result.put("matchRate", null);
        } else {
            Long succeededRows = matchMapper.selectCount(new LambdaQueryWrapper<FoodSafetyColdChainMatch>()
                    .in(FoodSafetyColdChainMatch::getMatchStatus, List.of(MATCH_PROCESSING, MATCH_DONE)));
            long succeeded = succeededRows == null ? 0L : succeededRows;
            result.put("matchRate", BigDecimal.valueOf(succeeded * 100)
                    .divide(BigDecimal.valueOf(total), 1, RoundingMode.HALF_UP));
        }
        return result;
    }

    private Long countResource(String status) {
        LambdaQueryWrapper<FoodSafetyColdChainResource> w = new LambdaQueryWrapper<>();
        if (status != null) {
            w.eq(FoodSafetyColdChainResource::getResourceStatus, status);
        }
        Long hits = resourceMapper.selectCount(w);
        return hits == null ? 0L : hits;
    }

    @Override
    public PageResult<AdminFsColdChainResourceVO> pageResources(int pageNum, int pageSize, String type, String status,
                                                               String city, String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FoodSafetyColdChainResource> w = new LambdaQueryWrapper<>();
        if (isEffective(type)) {
            w.eq(FoodSafetyColdChainResource::getResourceType, type.trim().toLowerCase());
        }
        if (isEffective(status)) {
            w.eq(FoodSafetyColdChainResource::getResourceStatus, status.trim().toLowerCase());
        }
        if (isEffective(city)) {
            w.eq(FoodSafetyColdChainResource::getCity, city.trim());
        }
        if (isEffective(keyword)) {
            String kw = keyword.trim();
            w.and(q -> q.like(FoodSafetyColdChainResource::getResourceName, kw)
                    .or().like(FoodSafetyColdChainResource::getDistrict, kw));
        }
        // 评分倒序是页面口径；再按资源名定序，避免同分时分页串行
        w.orderByDesc(FoodSafetyColdChainResource::getRating)
                .orderByAsc(FoodSafetyColdChainResource::getResourceName);
        Page<FoodSafetyColdChainResource> page = resourceMapper.selectPage(new Page<>(p, s), w);
        List<AdminFsColdChainResourceVO> rows = page.getRecords().stream()
                .map(AdminFsColdChainResourceVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    public PageResult<AdminFsColdChainMatchVO> pageMatches(int pageNum, int pageSize, String status, String keyword) {
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<FoodSafetyColdChainMatch> w = new LambdaQueryWrapper<>();
        if (isEffective(status)) {
            w.eq(FoodSafetyColdChainMatch::getMatchStatus, status.trim().toLowerCase());
        }
        if (isEffective(keyword)) {
            String kw = keyword.trim();
            w.and(q -> q.like(FoodSafetyColdChainMatch::getDemander, kw)
                    .or().like(FoodSafetyColdChainMatch::getSupplierName, kw));
        }
        w.orderByDesc(FoodSafetyColdChainMatch::getMatchTime)
                .orderByDesc(FoodSafetyColdChainMatch::getMatchId);
        Page<FoodSafetyColdChainMatch> page = matchMapper.selectPage(new Page<>(p, s), w);
        List<AdminFsColdChainMatchVO> rows = page.getRecords().stream()
                .map(AdminFsColdChainMatchVO::of).toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsColdChainMatchVO createMatch(String resourceId, String demander, String cargo, String startTime,
                                               String tempRequire, String remark) {
        FoodSafetyColdChainResource resource = requireResource(resourceId);
        if (!STATUS_IDLE.equals(resource.getResourceStatus())) {
            throw new BusinessException(400, "仅空闲资源可立即撮合，当前状态：" + resource.getResourceStatus());
        }
        String demanderText = requireText(demander, "需求方", DEMANDER_MAX_LENGTH);
        String cargoText = requireText(cargo, "货物 / 用途", CARGO_MAX_LENGTH);
        String tempText = requireText(tempRequire, "温区要求", TEMP_REQUIRE_MAX_LENGTH);
        LocalDate start = parseDate(startTime, "预约开始时间");
        String remarkText = optionalText(remark);

        FoodSafetyColdChainMatch match = newMatch(resource, MATCH_PROCESSING, remarkText);
        match.setDemander(demanderText);
        match.setCargo(cargoText);
        match.setTempRequire(tempText);
        match.setStartTime(start);
        matchMapper.insert(match);

        // 撮合成功即占用：不把资源置忙的话，同一辆车会被连续撮合出多张单子
        resource.setResourceStatus(STATUS_BUSY);
        resource.setUpdateTime(LocalDateTime.now());
        resourceMapper.updateById(resource);
        log.info("冷链立即撮合：{} 占用资源 {}（{}）", match.getMatchId(), resource.getResourceId(), resource.getResourceName());
        return AdminFsColdChainMatchVO.of(matchMapper.selectById(match.getMatchId()));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AdminFsColdChainMatchVO enqueue(String resourceId, String demander, String expectTime, String remark) {
        FoodSafetyColdChainResource resource = requireResource(resourceId);
        if (!STATUS_BUSY.equals(resource.getResourceStatus())) {
            throw new BusinessException(400, "仅繁忙资源可加入撮合队列，当前状态：" + resource.getResourceStatus());
        }
        String demanderText = requireText(demander, "需求方", DEMANDER_MAX_LENGTH);
        LocalDate expect = parseDate(expectTime, "期望使用时间");
        String remarkText = optionalText(remark);

        FoodSafetyColdChainMatch match = newMatch(resource, MATCH_QUEUED, remarkText);
        match.setDemander(demanderText);
        match.setExpectTime(expect);
        matchMapper.insert(match);
        log.info("冷链加入队列：{} 排队资源 {}（期望 {}）", match.getMatchId(), resource.getResourceId(), expect);
        return AdminFsColdChainMatchVO.of(matchMapper.selectById(match.getMatchId()));
    }

    /* ==================== 内部工具 ==================== */

    /** 建一条撮合单并抄下资源方的展示信息（资源改名不影响历史单）。 */
    private FoodSafetyColdChainMatch newMatch(FoodSafetyColdChainResource resource, String status, String remark) {
        FoodSafetyColdChainMatch match = new FoodSafetyColdChainMatch();
        match.setMatchId("FS-CCM-" + LocalDateTime.now().format(ID_FORMAT));
        match.setTenantId(DEFAULT_TENANT);
        match.setResourceId(resource.getResourceId());
        match.setSupplierName(resource.getResourceName());
        match.setResourceTypeLabel(resource.getTypeLabel());
        match.setMatchTime(LocalDateTime.now());
        match.setMatchStatus(status);
        match.setRemark(remark);
        return match;
    }

    private FoodSafetyColdChainResource requireResource(String resourceId) {
        if (!isEffective(resourceId)) {
            throw new BusinessException(400, "资源编号为必填");
        }
        FoodSafetyColdChainResource resource = resourceMapper.selectById(resourceId.trim());
        if (resource == null) {
            throw new BusinessException(404, "冷链资源不存在：" + resourceId.trim());
        }
        return resource;
    }

    private String requireText(String value, String field, int maxLength) {
        String trimmed = optionalText(value);
        if (trimmed == null) {
            throw new BusinessException(400, field + "为必填");
        }
        if (trimmed.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return trimmed;
    }

    private String optionalText(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > REMARK_MAX_LENGTH) {
            throw new BusinessException(400, "备注不得超过 " + REMARK_MAX_LENGTH + " 字");
        }
        return trimmed;
    }

    /** 解析 yyyy-MM-dd 且不得早于今天（不能预约一个已经过去的日期去用车）。 */
    private LocalDate parseDate(String text, String field) {
        if (text == null || text.isBlank()) {
            throw new BusinessException(400, field + "为必填");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(text.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + "格式应为 yyyy-MM-dd：" + text);
        }
        if (date.isBefore(LocalDate.now())) {
            throw new BusinessException(400, field + "不得早于今天：" + text);
        }
        return date;
    }

    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }
}
