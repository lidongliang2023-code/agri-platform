package com.agri.admin.service.impl;

import com.agri.admin.service.IAdminPermissionService;
import com.agri.admin.vo.OperationLogVO;
import com.agri.admin.vo.PermissionChangeLogVO;
import com.agri.admin.vo.PermissionStatisticsVO;
import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.masterdata.dto.RoleSaveDTO;
import com.agri.masterdata.entity.OperationLog;
import com.agri.masterdata.entity.Role;
import com.agri.masterdata.mapper.OperationLogMapper;
import com.agri.masterdata.mapper.PermissionMapper;
import com.agri.masterdata.mapper.RoleMapper;
import com.agri.masterdata.mapper.UserRoleMapper;
import com.agri.masterdata.vo.RoleVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;

/**
 * 权限审计。
 *
 * <p>本类原先有三处空壳：{@code getChangeLogs} 返回空列表、{@code getAnomalies} 返回空列表、
 * {@code getOperationLogs} 返回空列表 —— 于是「操作日志」页永远空白，
 * 而且它的返回类型是 {@code PermissionChangeLogVO}，字段名（{@code operator / changeType}）
 * 与页面读的（{@code username / operationType}）完全对不上，就算填了数据也一列都显示不出来。</p>
 *
 * <p>现在操作日志族统一以 {@code agri_md_operation_log} 为唯一数据源
 * （由 {@code AdminOperationLogAspect} 写入），用 {@link OperationLogVO} 对外。</p>
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AdminPermissionServiceImpl implements IAdminPermissionService {

    /** 角色增删改所在控制器的 Swagger Tag，也是 agri_md_operation_log.module 的取值。 */
    private static final String PERMISSION_MODULE = "权限审计";

    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RoleMapper roleMapper;
    private final OperationLogMapper operationLogMapper;
    private final PermissionMapper permissionMapper;
    private final UserRoleMapper userRoleMapper;

    @Override
    public PageResult<RoleVO> getRoleList(Integer pageNum, Integer pageSize, String roleName, String tenantId) {
        int offset = (pageNum - 1) * pageSize;
        List<RoleVO> list = roleMapper.selectAdminRoleList(offset, pageSize, roleName, tenantId);
        long total = roleMapper.countAdminRoleList(roleName, tenantId);
        return PageResult.success(list, total, pageNum, pageSize);
    }

    @Override
    public RoleVO getRoleDetail(Long id) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        return RoleVO.fromEntity(role);
    }

    @Override
    @Transactional
    public void createRole(RoleSaveDTO dto) {
        Role role = Role.builder()
                .roleName(dto.getRoleName())
                .roleCode(dto.getRoleCode())
                .description(dto.getDescription())
                .tenantId(dto.getTenantId())
                .build();
        roleMapper.insert(role);
    }

    @Override
    @Transactional
    public void updateRole(Long id, RoleSaveDTO dto) {
        Role role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        role.setRoleName(dto.getRoleName());
        role.setRoleCode(dto.getRoleCode());
        role.setDescription(dto.getDescription());
        roleMapper.updateById(role);
    }

    @Override
    @Transactional
    public void deleteRole(Long id) {
        roleMapper.deleteById(id);
    }

    @Override
    public PageResult<PermissionChangeLogVO> getChangeLogs(Integer pageNum, Integer pageSize, String changeType, String operator, String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OperationLog::getModule, PERMISSION_MODULE);
        if (hasText(changeType)) {
            wrapper.eq(OperationLog::getOperationType, changeType.trim());
        }
        if (hasText(operator)) {
            wrapper.like(OperationLog::getOperator, operator.trim());
        }
        applyTimeRange(wrapper, startTime, endTime);
        wrapper.orderByDesc(OperationLog::getCreateTime).orderByDesc(OperationLog::getId);

        IPage<OperationLog> page = operationLogMapper.selectPage(buildPage(pageNum, pageSize), wrapper);
        List<PermissionChangeLogVO> list = page.getRecords().stream()
                .map(AdminPermissionServiceImpl::toChangeLogVO)
                .toList();
        return PageResult.success(list, page.getTotal(), (int) page.getCurrent(), (int) page.getSize());
    }

    @Override
    public List<PermissionStatisticsVO.AnomalyItem> getAnomalies() {
        // 这里**故意**返回空列表，而且不打算用"猜"来填满它。
        //
        // "异常权限检测"要的是能下结论的规则引擎：互斥角色同时授予、同一人既是审核人又是被审核人、
        // 超过 N 天未使用的高权限角色……仓库里没有这类规则表，也没有跑批任务产出结论。
        // 之前这里返回空列表是"没实现"，现在依然是空列表 —— 区别在于现在它是明确的结论：
        // 缺的是一张权限异常规则表 + 一个按规则扫描的定时任务，不是缺数据。
        // 编几条"检测到互斥角色"出来，只会让审计页变成谎言。
        return Collections.emptyList();
    }

    @Override
    public PermissionStatisticsVO getStatistics(String tenantId) {
        long totalRoles = tenantId == null || tenantId.isBlank()
                ? roleMapper.countAdminRoleList(null, null)
                : roleMapper.countAdminRoleList(null, tenantId);
        return PermissionStatisticsVO.builder()
                .totalRoles(totalRoles)
                .totalPermissions(permissionMapper.selectCount(null))
                .totalUserRoles(userRoleMapper.selectCount(null))
                .anomalyCount(0L)
                .anomalies(Collections.emptyList())
                // roleDistribution / trends 同样没有数据来源（没有按角色聚合用量的统计表、
                // 也没有按天快照），返回空而不是写死几个数字。
                .roleDistribution(Collections.emptyList())
                .trends(Collections.emptyList())
                .build();
    }

    @Override
    public PageResult<OperationLogVO> getOperationLogs(Integer pageNum, Integer pageSize, String keyword, String operationType, String module, String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        if (hasText(keyword)) {
            String trimmed = keyword.trim();
            // 页面上的搜索框写的是"搜索用户名/操作描述"，那就老老实实按这两列匹配
            wrapper.and(w -> w.like(OperationLog::getOperator, trimmed)
                    .or().like(OperationLog::getOperationDesc, trimmed));
        }
        if (hasText(operationType)) {
            wrapper.eq(OperationLog::getOperationType, operationType.trim());
        }
        if (hasText(module)) {
            wrapper.like(OperationLog::getModule, module.trim());
        }
        applyTimeRange(wrapper, startTime, endTime);
        wrapper.orderByDesc(OperationLog::getCreateTime).orderByDesc(OperationLog::getId);

        IPage<OperationLog> page = operationLogMapper.selectPage(buildPage(pageNum, pageSize), wrapper);
        List<OperationLogVO> list = page.getRecords().stream()
                .map(AdminPermissionServiceImpl::toOperationLogVO)
                .toList();
        return PageResult.success(list, page.getTotal(), (int) page.getCurrent(), (int) page.getSize());
    }

    @Override
    public byte[] exportChangeLogs(String changeType, String startTime, String endTime) {
        LambdaQueryWrapper<OperationLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(OperationLog::getModule, PERMISSION_MODULE);
        if (hasText(changeType)) {
            wrapper.eq(OperationLog::getOperationType, changeType.trim());
        }
        applyTimeRange(wrapper, startTime, endTime);
        wrapper.orderByDesc(OperationLog::getCreateTime).orderByDesc(OperationLog::getId);

        StringBuilder csv = new StringBuilder();
        csv.append("操作类型,关联模块,目标ID,操作描述,操作人,IP地址,结果,失败原因,耗时(ms),操作时间\n");
        for (OperationLog log : operationLogMapper.selectList(wrapper)) {
            csv.append(csvCell(log.getOperationType())).append(',')
                    .append(csvCell(log.getModule())).append(',')
                    .append(csvCell(log.getTargetId())).append(',')
                    .append(csvCell(log.getOperationDesc())).append(',')
                    .append(csvCell(log.getOperator())).append(',')
                    .append(csvCell(log.getIpAddress())).append(',')
                    .append(csvCell(log.getResult())).append(',')
                    .append(csvCell(log.getErrorMessage())).append(',')
                    .append(log.getDurationMs() == null ? "" : log.getDurationMs()).append(',')
                    .append(log.getCreateTime() == null ? "" : log.getCreateTime().format(DATETIME_FMT))
                    .append('\n');
        }
        // 带 BOM：不带的话 Excel 打开中文列名会乱码（与质量问题的导出保持同一套做法）
        byte[] body = csv.toString().getBytes(StandardCharsets.UTF_8);
        byte[] withBom = new byte[body.length + 3];
        withBom[0] = (byte) 0xEF;
        withBom[1] = (byte) 0xBB;
        withBom[2] = (byte) 0xBF;
        System.arraycopy(body, 0, withBom, 3, body.length);
        return withBom;
    }

    private static Page<OperationLog> buildPage(Integer pageNum, Integer pageSize) {
        long current = pageNum == null || pageNum < 1 ? 1L : pageNum;
        long size = pageSize == null || pageSize < 1 ? 10L : pageSize;
        return new Page<>(current, size);
    }

    private static void applyTimeRange(LambdaQueryWrapper<OperationLog> wrapper, String startTime, String endTime) {
        LocalDateTime from = parseTime(startTime, false);
        if (from != null) {
            wrapper.ge(OperationLog::getCreateTime, from);
        }
        LocalDateTime to = parseTime(endTime, true);
        if (to != null) {
            wrapper.le(OperationLog::getCreateTime, to);
        }
    }

    /**
     * 解析时间条件。页面上是 {@code <input type="date">}，只会给出 {@code 2026-10-13} 这种日期；
     * 也顺带兼容 ISO 的"日期+时间"写法，方便直接用 curl / Swagger 调试。
     *
     * <p>结束日期补到当天 23:59:59 —— 否则 {@code <= 2026-10-13} 会等价于
     * {@code <= 2026-10-13 00:00:00}，把选中那一天的操作全漏掉，而且页面上看起来
     * 像是"那天没干活"。</p>
     */
    private static LocalDateTime parseTime(String text, boolean endOfDay) {
        if (!hasText(text)) {
            return null;
        }
        String value = text.trim();
        try {
            if (value.length() <= 10) {
                LocalDate date = LocalDate.parse(value);
                return endOfDay ? date.atTime(23, 59, 59) : date.atStartOfDay();
            }
            return LocalDateTime.parse(value.replace(' ', 'T'));
        } catch (Exception e) {
            // 静默忽略格式错误会让"筛了日期却毫无变化"变成一个查不出来的问题，所以直接报错
            throw new BusinessException("时间格式不正确，应为 yyyy-MM-dd 或 yyyy-MM-dd HH:mm:ss：" + value);
        }
    }

    private static OperationLogVO toOperationLogVO(OperationLog entity) {
        OperationLogVO vo = new OperationLogVO();
        vo.setId(entity.getId());
        vo.setUsername(entity.getOperator());
        vo.setOperationType(entity.getOperationType());
        vo.setOperationDesc(entity.getOperationDesc());
        vo.setModule(entity.getModule());
        vo.setTargetId(entity.getTargetId());
        vo.setIpAddress(entity.getIpAddress());
        vo.setResult(entity.getResult());
        vo.setDurationMs(entity.getDurationMs());
        vo.setErrorMessage(entity.getErrorMessage());
        vo.setCreateTime(entity.getCreateTime() == null ? null : entity.getCreateTime().format(DATETIME_FMT));
        return vo;
    }

    /**
     * 变更记录 VO 与操作日志同源，字段按可用的信息映射。
     *
     * <p>{@code beforeValue / afterValue / tenantName} 留空：没有权限变更快照表，
     * 也没有租户名称的关联查询，编不出来。{@code targetName} 放操作描述，
     * 因为"创建角色"本身就是这次变更最贴切的名字。</p>
     */
    private static PermissionChangeLogVO toChangeLogVO(OperationLog entity) {
        PermissionChangeLogVO vo = new PermissionChangeLogVO();
        vo.setId(entity.getId());
        vo.setChangeType(entity.getOperationType());
        vo.setTargetType(entity.getModule());
        vo.setTargetId(entity.getTargetId());
        vo.setTargetName(entity.getOperationDesc());
        vo.setOperator(entity.getOperator());
        vo.setOperatorId(entity.getOperatorId() == null ? null : String.valueOf(entity.getOperatorId()));
        vo.setCreateTime(entity.getCreateTime() == null ? null : entity.getCreateTime().format(DATETIME_FMT));
        vo.setTenantId(entity.getTenantId());
        vo.setIpAddress(entity.getIpAddress());
        return vo;
    }

    /** CSV 单元格转义：逗号、引号、换行都会破坏列结构。 */
    private static String csvCell(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n") || value.contains("\r")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
