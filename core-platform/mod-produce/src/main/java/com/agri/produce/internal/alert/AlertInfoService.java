package com.agri.produce.internal.alert;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 告警记录（规则触发后的处置闭环） 应用服务。
 *
 * <p><b>对外口径。</b>查询与统计一律返回 {@link AlertVO}（数字枚举 + 前端字段名）；
 * 落库一律使用 {@link AlertDict} 转换后的英文枚举。此前直接返回实体导致前端
 * {@code status === 1} 判定永久失效，是告警中心「能渲染、筛不动」的根因。
 */
@Service
@RequiredArgsConstructor
public class AlertInfoService {

    private static final String ID_PREFIX = "ALRT";

    /** 告警来源合法取值（与前端 AlertSource 一致）。越界直接报错，不静默忽略。 */
    private static final List<Integer> VALID_SOURCES = List.of(1, 2, 3, 4, 5);

    private final AlertInfoMapper alertInfoMapper;

    /**
     * 分页查询。
     *
     * <p>所有筛选条件都是真实生效的 SQL 条件。此前前端传的 {@code farmId}、
     * {@code alertLevel}、{@code alertSource}、时间范围全部被后端忽略（方法签名里
     * 根本没有这些参数），列表看起来能筛、实际返回的是全量未过滤数据——属于假功能。
     *
     * @param page        页码，从 1 开始
     * @param size        每页条数
     * @param farmId      农场过滤
     * @param keyword     alertTitle 模糊关键字
     * @param alertLevel  级别 1提示 2一般 3严重 4紧急
     * @param alertSource 来源 1环境 2设备 3病虫害 4任务 5投入品
     * @param status      状态 1未处理 2处理中 3已处理 4已忽略
     * @param startDate   触发起始日期 yyyy-MM-dd
     * @param endDate     触发截止日期 yyyy-MM-dd
     * @return 分页结果（视图对象）
     */
    public PageResult<AlertVO> page(long page, long size, String farmId, String keyword,
                                    Integer alertLevel, Integer alertSource, Integer status,
                                    String startDate, String endDate) {
        LocalDateTime from = parseDayStart(startDate);
        LocalDateTime to = parseDayEnd(endDate);
        Page<AlertInfoEntity> result = alertInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<AlertInfoEntity>()
                        .eq(farmId != null && !farmId.isBlank(), AlertInfoEntity::getFarmId, farmId)
                        .like(keyword != null && !keyword.isBlank(), AlertInfoEntity::getAlertTitle, keyword)
                        .in(alertLevel != null, AlertInfoEntity::getAlertLevel, AlertDict.levelValuesOf(alertLevel))
                        .eq(alertSource != null, AlertInfoEntity::getAlertSource, alertSource)
                        .eq(status != null, AlertInfoEntity::getStatus, AlertDict.statusOf(status))
                        .ge(from != null, AlertInfoEntity::getAlertTime, from)
                        .le(to != null, AlertInfoEntity::getAlertTime, to)
                        .orderByDesc(AlertInfoEntity::getAlertTime));
        return PageResult.of(result.getRecords().stream().map(AlertVO::from).toList(),
                result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 视图对象
     */
    public AlertVO detail(String id) {
        AlertInfoEntity entity = alertInfoMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return AlertVO.from(entity);
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体（status/alertLevel 需为英文枚举；来自前端的数字请在 Controller 层转换）
     * @return 落库后的实体
     */
    @Transactional
    public AlertInfoEntity create(AlertInfoEntity entity) {
        if (entity.getAlertId() == null || entity.getAlertId().isBlank()) {
            entity.setAlertId(ProduceIds.newId(ID_PREFIX));
        }
        if (entity.getAlertSource() != null && !VALID_SOURCES.contains(entity.getAlertSource())) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "告警来源取值非法：" + entity.getAlertSource() + "（应为 1环境 2设备 3病虫害 4任务 5投入品）");
        }
        if (entity.getStatus() == null || entity.getStatus().isBlank()) {
            entity.setStatus(AlertDict.STATUS_PENDING);
        }
        alertInfoMapper.insert(entity);
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
    public AlertInfoEntity update(String id, AlertInfoEntity entity) {
        entity.setAlertId(id);
        alertInfoMapper.updateById(entity);
        return alertInfoMapper.selectById(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        alertInfoMapper.deleteById(id);
    }

    /** 未处置告警 */
    public List<AlertVO> listUnhandled() {
        return alertInfoMapper.selectList(new LambdaQueryWrapper<AlertInfoEntity>()
                        .eq(AlertInfoEntity::getStatus, AlertDict.STATUS_PENDING)
                        .orderByDesc(AlertInfoEntity::getAlertTime))
                .stream().map(AlertVO::from).toList();
    }

    /**
     * 处置告警（用户端告警中心「处理/忽略」与运营端监管详情「标记已处理」共用）。
     *
     * <p>前端契约是 {@code PATCH /alerts/{alertId}/handle} + body
     * {@code {status, handleRemark}}，此前后端只有
     * {@code POST /alerts/{alertId}/handle?handleBy=&remark=&ignore=}——方法、传参方式、
     * 字段名、返回类型四处全不对，前端调用必然 405/400，被空 catch 吞掉后走本地补丁，
     * 页面上「已处理」是假的（刷新即消失）。
     *
     * @param alertId      告警主键
     * @param status       目标状态 2处理中 3已处理 4已忽略
     * @param handleRemark 处置说明
     * @param handlerName  处置人（库内仅有 handle_by 一列，存处置人姓名）
     * @return 是否落库成功
     */
    @Transactional
    public boolean handle(String alertId, Integer status, String handleRemark, String handlerName) {
        String target = AlertDict.statusOf(status);
        if (AlertDict.STATUS_PENDING.equals(target)) {
            throw new BusinessException(ErrorCode.BAD_REQUEST,
                    "处置动作的目标状态不能是「未处理」，如需回退请用更新接口");
        }
        AlertInfoEntity alert = alertInfoMapper.selectById(alertId);
        if (alert == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        alert.setStatus(target);
        alert.setHandleRemark(handleRemark);
        alert.setHandleBy(handlerName);
        alert.setHandleTime(LocalDateTime.now());
        return alertInfoMapper.updateById(alert) > 0;
    }

    /**
     * 批量忽略（前端「批量忽略」按钮走 {@code PATCH /alerts/ignore}）。
     *
     * @param alertIds 告警主键列表
     * @return 全部更新成功返回 true；列表为空返回 false
     */
    @Transactional
    public boolean ignoreBatch(List<String> alertIds) {
        if (alertIds == null || alertIds.isEmpty()) {
            return false;
        }
        for (String alertId : alertIds) {
            if (alertId == null || alertId.isBlank()) {
                continue;
            }
            AlertInfoEntity alert = alertInfoMapper.selectById(alertId);
            if (alert == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "告警不存在：" + alertId);
            }
            alert.setStatus(AlertDict.STATUS_IGNORED);
            alert.setHandleTime(LocalDateTime.now());
            alertInfoMapper.updateById(alert);
        }
        return true;
    }

    /**
     * 告警统计（告警中心顶部指标卡）。
     *
     * <p>返回结构与前端 {@code AlertStats} 一一对应：
     * {@code total / unhandled / handling / resolved / ignored / levelCounts[{level,count}]}。
     * 此前后端返回的是 {@code {INFO: n, WARN: n, CRITICAL: n, pending: n}}，字段名与形状
     * 都和前端对不上，前端只能靠零值兜底，指标卡永远是 0。
     *
     * @param farmId 农场过滤，为空统计全部
     * @return 统计视图
     */
    public AlertStatsVO stats(String farmId) {
        AlertStatsVO vo = new AlertStatsVO();
        vo.setTotal(count(farmId, null));
        vo.setUnhandled(count(farmId, AlertDict.STATUS_PENDING));
        vo.setHandling(count(farmId, AlertDict.STATUS_HANDLING));
        vo.setResolved(count(farmId, AlertDict.STATUS_HANDLED));
        vo.setIgnored(count(farmId, AlertDict.STATUS_IGNORED));

        List<AlertStatsVO.LevelCount> levelCounts = new ArrayList<>();
        for (int code = 1; code <= 4; code++) {
            long n = alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                    .eq(farmId != null && !farmId.isBlank(), AlertInfoEntity::getFarmId, farmId)
                    .in(AlertInfoEntity::getAlertLevel, AlertDict.levelValuesOf(code)));
            levelCounts.add(new AlertStatsVO.LevelCount(code, n));
        }
        vo.setLevelCounts(levelCounts);
        return vo;
    }

    /** 按农场（可空）+ 状态（可空）计数。status 为空表示不按状态过滤。 */
    private long count(String farmId, String status) {
        return alertInfoMapper.selectCount(new LambdaQueryWrapper<AlertInfoEntity>()
                .eq(farmId != null && !farmId.isBlank(), AlertInfoEntity::getFarmId, farmId)
                .eq(status != null, AlertInfoEntity::getStatus, status));
    }

    /** 解析日期上界：yyyy-MM-dd → 当日 23:59:59.999 */
    private LocalDateTime parseDayEnd(String day) {
        LocalDate date = parseDay(day);
        return date == null ? null : LocalDateTime.of(date, LocalTime.of(23, 59, 59));
    }

    /** 解析日期下界：yyyy-MM-dd → 当日 00:00:00 */
    private LocalDateTime parseDayStart(String day) {
        LocalDate date = parseDay(day);
        return date == null ? null : date.atStartOfDay();
    }

    private LocalDate parseDay(String day) {
        if (day == null || day.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(day.trim());
        } catch (DateTimeParseException ex) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "日期格式非法：" + day + "（应为 yyyy-MM-dd）");
        }
    }
}
