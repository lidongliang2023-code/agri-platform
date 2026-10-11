package com.agri.produce.internal.admin.foodsafety;

import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
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
 * 运营端：冷链资源撮合（P19）。
 *
 * <p>统计口径：total/available/busy/offline 由资源状态实时计数；
 * matchRate（撮合成功率）= (processing + done) / 全部撮合记录 ——
 * queued 表示尚未撮合成功（资源繁忙排队中），不计入成功。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminFoodSafetyColdChainService {

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
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");

    private final ColdChainResourceMapper coldChainResourceMapper;
    private final ColdChainMatchMapper coldChainMatchMapper;

    /**
     * 冷链资源统计。
     *
     * @return total / available / busy / offline / matchRate
     */
    public Map<String, Object> stats() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", coldChainResourceMapper.selectCount(null));
        result.put("available", countResourceByStatus(STATUS_IDLE));
        result.put("busy", countResourceByStatus(STATUS_BUSY));
        result.put("offline", countResourceByStatus(STATUS_OFFLINE));
        long totalMatches = coldChainMatchMapper.selectCount(null);
        if (totalMatches == 0) {
            result.put("matchRate", null);
        } else {
            long succeeded = coldChainMatchMapper.selectCount(new LambdaQueryWrapper<ColdChainMatchEntity>()
                    .in(ColdChainMatchEntity::getStatus, List.of(MATCH_PROCESSING, MATCH_DONE)));
            result.put("matchRate", BigDecimal.valueOf(succeeded * 100)
                    .divide(BigDecimal.valueOf(totalMatches), 1, RoundingMode.HALF_UP));
        }
        return result;
    }

    /**
     * 冷链资源分页（页面按资源卡渲染）。
     *
     * @param page    页码
     * @param size    每页条数
     * @param type    资源类型筛选（all/空 = 不筛选）
     * @param status  资源状态筛选（all/空 = 不筛选）
     * @param city    所在城市精确匹配
     * @param keyword 关键字：模糊匹配资源名称 / 区县
     * @return 分页结果
     */
    public PageResult<ColdChainResourceEntity> pageResources(long page, long size, String type,
                                                             String status, String city, String keyword) {
        Page<ColdChainResourceEntity> resultPage = coldChainResourceMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ColdChainResourceEntity>()
                        .eq(isEffective(type), ColdChainResourceEntity::getType, type)
                        .eq(isEffective(status), ColdChainResourceEntity::getStatus, status)
                        .eq(isEffective(city), ColdChainResourceEntity::getCity, city)
                        .and(isEffective(keyword), wrapper -> wrapper
                                .like(ColdChainResourceEntity::getName, keyword)
                                .or().like(ColdChainResourceEntity::getDistrict, keyword))
                        .orderByDesc(ColdChainResourceEntity::getRating)
                        .orderByAsc(ColdChainResourceEntity::getName));
        return PageResult.of(resultPage.getRecords(), resultPage.getTotal(), page, size);
    }

    /**
     * 撮合记录分页。
     *
     * @param page    页码
     * @param size    每页条数
     * @param status  撮合状态筛选（all/空 = 不筛选）
     * @param keyword 关键字：模糊匹配需求方 / 资源方
     * @return 分页结果
     */
    public PageResult<ColdChainMatchEntity> pageMatches(long page, long size, String status, String keyword) {
        Page<ColdChainMatchEntity> resultPage = coldChainMatchMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<ColdChainMatchEntity>()
                        .eq(isEffective(status), ColdChainMatchEntity::getStatus, status)
                        .and(isEffective(keyword), wrapper -> wrapper
                                .like(ColdChainMatchEntity::getDemander, keyword)
                                .or().like(ColdChainMatchEntity::getSupplier, keyword))
                        .orderByDesc(ColdChainMatchEntity::getMatchTime));
        return PageResult.of(resultPage.getRecords(), resultPage.getTotal(), page, size);
    }

    /**
     * 立即撮合（写操作）：资源须为 idle，撮合后资源转为 busy。
     *
     * <p>守卫与页面一致（页面 idle 才渲染立即撮合、busy 渲染加入队列、offline 按钮禁用），
     * 避免对离线或占用中的资源发出矛盾指令。</p>
     *
     * @param request 撮合请求体
     * @return 新建的撮合记录（status = processing）
     */
    @Transactional
    public ColdChainMatchEntity createMatch(MatchCreateRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        ColdChainResourceEntity resource = requireResource(request.resourceId());
        if (!STATUS_IDLE.equals(resource.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "仅空闲资源可立即撮合，当前状态：" + resource.getStatus());
        }
        String demander = requireText(request.demander(), "需求方", 60);
        String cargo = requireText(request.cargo(), "货物 / 用途", CARGO_MAX_LENGTH);
        String tempRequire = requireText(request.tempRequire(), "温区要求", TEMP_REQUIRE_MAX_LENGTH);
        LocalDate startTime = parseDate(request.startTime(), "预约开始时间");
        String remark = optionalText(request.remark());

        ColdChainMatchEntity match = new ColdChainMatchEntity();
        match.setId(nextMatchId());
        match.setResourceId(resource.getId());
        match.setSupplier(resource.getName());
        match.setResourceType(resource.getTypeLabel());
        match.setDemander(demander);
        match.setCargo(cargo);
        match.setTempRequire(tempRequire);
        match.setStartTime(startTime);
        match.setMatchTime(LocalDateTime.now());
        match.setStatus(MATCH_PROCESSING);
        match.setRemark(remark);
        coldChainMatchMapper.insert(match);

        resource.setStatus(STATUS_BUSY);
        coldChainResourceMapper.updateById(resource);
        return match;
    }

    /**
     * 繁忙资源加入撮合队列（写操作）。
     *
     * @param request 入队请求体
     * @return 新建的撮合记录（status = queued）
     */
    @Transactional
    public ColdChainMatchEntity queue(QueueRequest request) {
        if (request == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "请求体不能为空");
        }
        ColdChainResourceEntity resource = requireResource(request.resourceId());
        if (!STATUS_BUSY.equals(resource.getStatus())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "仅繁忙资源可加入撮合队列，当前状态：" + resource.getStatus());
        }
        String demander = requireText(request.demander(), "需求方", 60);
        LocalDate expectTime = parseDate(request.expectTime(), "期望使用时间");
        String remark = optionalText(request.remark());

        ColdChainMatchEntity match = new ColdChainMatchEntity();
        match.setId(nextMatchId());
        match.setResourceId(resource.getId());
        match.setSupplier(resource.getName());
        match.setResourceType(resource.getTypeLabel());
        match.setDemander(demander);
        match.setExpectTime(expectTime);
        match.setMatchTime(LocalDateTime.now());
        match.setStatus(MATCH_QUEUED);
        match.setRemark(remark);
        coldChainMatchMapper.insert(match);
        return match;
    }

    /* ==================== 内部工具 ==================== */

    private Long countResourceByStatus(String status) {
        return coldChainResourceMapper.selectCount(new LambdaQueryWrapper<ColdChainResourceEntity>()
                .eq(ColdChainResourceEntity::getStatus, status));
    }

    private ColdChainResourceEntity requireResource(String resourceId) {
        if (resourceId == null || resourceId.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "资源编号为必填");
        }
        ColdChainResourceEntity resource = coldChainResourceMapper.selectById(resourceId.trim());
        if (resource == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "冷链资源不存在：" + resourceId);
        }
        return resource;
    }

    private String requireText(String value, String field, int maxLength) {
        String trimmed = optionalText(value);
        if (trimmed == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + "为必填");
        }
        if (trimmed.length() > maxLength) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + "不得超过 " + maxLength + " 字");
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
            throw new BusinessException(ErrorCode.BAD_REQUEST, "备注不得超过 200 字");
        }
        return trimmed;
    }

    /** 解析 yyyy-MM-dd 且不得早于今天。 */
    private LocalDate parseDate(String text, String field) {
        if (text == null || text.isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + "为必填");
        }
        LocalDate date;
        try {
            date = LocalDate.parse(text.trim());
        } catch (DateTimeParseException ex) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + "格式应为 yyyy-MM-dd：" + text);
        }
        if (date.isBefore(LocalDate.now())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, field + "不得早于今天：" + text);
        }
        return date;
    }

    private String nextMatchId() {
        return "FS-CCM-" + LocalDateTime.now().format(ID_FORMAT);
    }

    private boolean isEffective(String value) {
        return value != null && !value.isBlank() && !FILTER_ALL.equalsIgnoreCase(value.trim());
    }
}
