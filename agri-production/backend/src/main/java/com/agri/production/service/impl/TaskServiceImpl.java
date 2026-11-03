package com.agri.production.service.impl;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Farm;
import com.agri.production.entity.PlantingPlan;
import com.agri.production.entity.PlanStage;
import com.agri.production.entity.Plot;
import com.agri.production.entity.Task;
import com.agri.production.entity.TaskRecord;
import com.agri.production.entity.TeamMember;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.FarmMapper;
import com.agri.production.mapper.PlantingPlanMapper;
import com.agri.production.mapper.PlanStageMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.mapper.TaskRecordMapper;
import com.agri.production.mapper.TeamMemberMapper;
import com.agri.production.service.FarmIdResolver;
import com.agri.production.service.ITaskService;
import com.agri.production.vo.TaskVO;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskServiceImpl extends ServiceImpl<TaskMapper, Task> implements ITaskService {

    private final TaskRecordMapper taskRecordMapper;
    /** 成员台账：把页面的执行人（成员业务标识或主键）换成 executor_id + executor_name。 */
    private final TeamMemberMapper memberMapper;
    /** 种养计划与阶段：任务必须能回挂到计划，验收通过后再驱动阶段状态。 */
    private final PlantingPlanMapper planMapper;
    private final PlanStageMapper stageMapper;
    /** 农场 / 地块：把页面传的农场标识换算成本地主键，并回填名称供列表展示。 */
    private final FarmIdResolver farmIdResolver;
    private final FarmMapper farmMapper;
    private final PlotMapper plotMapper;

    /** 计划时间接受的写法（页面发的是 datetime-local 的 {@code yyyy-MM-dd HH:mm:ss}，也容忍纯日期）。 */
    private static final DateTimeFormatter DATE_TIME_MINUTE = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
    private static final DateTimeFormatter DATE_TIME_SECOND = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /**
     * 把**页面口径的字段名**归一成实体列名（不归一就会被静默丢掉：提示创建成功、值却不在库里）。

     *
     * <p>2026-10-16 实测：新建任务页发的是 {@code description / assigneeId / planStartDate / planEndDate}，
     * 而入参 {@code TaskSaveDTO} 只有实体名 {@code taskDesc / executorId / planStartTime / planEndTime} ——
     * 于是任务建出来了，却没有执行人、没有计划时段、没有描述（页面上还提示"任务创建成功"）。
     * 出参侧早就有 {@code @JsonProperty} 做这层映射，入参侧一直是空的。</p>
     *
     * @param dto 请求体（就地改写）
     * @param tenantId 当前租户
     */
    private void normalizePageAliases(TaskSaveDTO dto, String tenantId) {
        if (dto == null) {
            return;
        }
        // ① 描述：页面名 → 实体列
        if (dto.getDescription() != null) {
            dto.setTaskDesc(dto.getDescription());
        }
        // ② 执行人：成员业务标识 / 主键 → 成员主键 + 真实姓名
        String rawAssignee = dto.getAssigneeId() == null ? null : dto.getAssigneeId().trim();
        if (rawAssignee != null && !rawAssignee.isEmpty()) {
            TeamMember member = resolveMember(rawAssignee, tenantId);
            dto.setExecutorId(member.getId());
            if (dto.getExecutorName() == null || dto.getExecutorName().isBlank()) {
                dto.setExecutorName(member.getMemberName());
            }
        }
        // ③ 计划起止：页面名 → 实体列（列是 DATETIME，页面可能只给到日期）
        if (dto.getPlanStartDate() != null) {
            dto.setPlanStartTime(parseDateTime(dto.getPlanStartDate(), "planStartDate"));
        }
        if (dto.getPlanEndDate() != null) {
            dto.setPlanEndTime(parseDateTime(dto.getPlanEndDate(), "planEndDate"));
        }
    }

    /**
     * 解析计划时间：接受 {@code yyyy-MM-dd}、{@code yyyy-MM-dd HH:mm[:ss]} 与 ISO 的 {@code T} 分隔写法。

     *
     * <p>纯日期按当天 00:00 落库（不猜时刻）。列本身是 DATETIME，所以日期不会丢。</p>
     *
     * @param text 原始文本
     * @param field 字段名（用于报错）
     * @returns 解析结果；空文本返回 null
     */
    private static LocalDateTime parseDateTime(String text, String field) {
        String value = text == null ? null : text.trim();
        if (value == null || value.isEmpty()) {
            return null;
        }
        String normalized = value.replace('T', ' ');
        try {
            if (normalized.length() == 10) {
                return LocalDate.parse(normalized).atStartOfDay();
            }
            if (normalized.length() == 16) {
                return LocalDateTime.parse(normalized, DATE_TIME_MINUTE);
            }
            // 带秒（也容忍毫秒：截到秒）
            String trimmed = normalized.length() > 19 ? normalized.substring(0, 19) : normalized;
            return LocalDateTime.parse(trimmed, DATE_TIME_SECOND);
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, field + " 格式应为 yyyy-MM-dd 或 yyyy-MM-dd HH:mm[:ss]：" + value);
        }
    }

    private static Long parseLong(String text) {
        if (text.isEmpty() || !text.chars().allMatch(Character::isDigit)) {
            return null;
        }
        try {
            return Long.valueOf(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * 解析执行人：纯数字按成员主键、其它按成员业务标识（member_id）。
     *
     * @param raw 页面传来的执行人值
     * @param tenantId 当前租户
     * @return 成员实体（存在且属于本租户）
     */
    private TeamMember resolveMember(String raw, String tenantId) {
        Long pk = parseLong(raw);
        TeamMember member = pk != null
                ? memberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                        .eq(TeamMember::getTenantId, tenantId).eq(TeamMember::getId, pk).last("LIMIT 1"))
                : memberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                        .eq(TeamMember::getTenantId, tenantId)
                        .eq(TeamMember::getMemberId, raw).last("LIMIT 1"));
        if (member == null) {
            throw new BusinessException(400, "执行人不存在（本租户内查不到该成员）：" + raw);
        }
        return member;
    }

    /**
     * 归一农场地块上下文。
     *
     * <p>页面传的农场值是平台侧标识（DEMO-FARM-016）或编码，不是本地主键；不换算就会在
     * JSON 绑定阶段 400，或者换算失败后把 farm_id 写成 null。这里统一换成主键，并在
     * 地块 / 计划存在时做归属校验，避免任务挂到别的农场。</p>
     *
     * @param task 任务（就地写 farmId / farmCode / plotCode）
     * @param rawFarmId 页面原值，可为空（空则从地块/计划推导）
     * @param tenantId 当前租户
     */
    private void applyFarmAndPlotReferences(Task task, String rawFarmId, String tenantId) {
        Long resolvedFarmId = null;
        if (rawFarmId != null && !rawFarmId.isBlank()) {
            resolvedFarmId = farmIdResolver.resolveFilter(rawFarmId, tenantId);
        } else if (task.getFarmId() != null) {
            resolvedFarmId = task.getFarmId();
        }
        if (task.getPlotId() != null) {
            Plot plot = plotMapper.selectById(task.getPlotId());
            if (plot == null || !tenantId.equals(plot.getTenantId())) {
                throw new BusinessException(400, "执行地块不存在（本租户内查不到该地块）：" + task.getPlotId());
            }
            if (resolvedFarmId == null) {
                resolvedFarmId = plot.getFarmId();
            } else if (!resolvedFarmId.equals(plot.getFarmId())) {
                throw new BusinessException(400, "执行地块不属于所选农场");
            }
            task.setPlotCode(plot.getPlotCode());
        }
        if (resolvedFarmId != null) {
            Farm farm = farmMapper.selectById(resolvedFarmId);
            if (farm == null || !tenantId.equals(farm.getTenantId())) {
                throw new BusinessException(400, "所属农场不存在（本租户内查不到该农场）：" + resolvedFarmId);
            }
            task.setFarmId(resolvedFarmId);
            task.setFarmCode(farm.getFarmCode());
        }
    }

    /**
     * 写一条任务执行记录（开始 / 完成时自动落，保证详情与验收页有时间轴）。
     *
     * @param task 任务
     * @param executeType 1 开始 / 3 完成
     * @param photos 照片（完成时可带提交成果照片）
     * @param tenantId 租户
     */
    private void appendRecord(Task task, Integer executeType, String photos, String tenantId) {
        TaskRecord record = new TaskRecord();
        record.setTaskId(task.getId());
        record.setExecutorId(task.getExecutorId());
        record.setExecutorName(task.getExecutorName());
        record.setTenantId(tenantId);
        record.setExecuteTime(LocalDateTime.now());
        record.setExecuteType(executeType);
        record.setPhotos(photos);
        record.setCreateTime(LocalDateTime.now());
        taskRecordMapper.insert(record);
    }

    @Override
    @Transactional
    public TaskVO save(TaskSaveDTO dto, String tenantId) {
        normalizePageAliases(dto, tenantId);
        Task task = BeanCopyUtils.copy(dto, Task.class);
        task.setTenantId(tenantId);
        task.setTaskCode(generateTaskCode(tenantId));
        task.setStatus("pending");
        task.setAcceptStatus(0);
        task.setRejectCount(0);
        // 先挂计划（缺地块/农场时由计划补齐），再归一场地与地块并做归属校验
        applyPlanReference(task, tenantId);
        applyFarmAndPlotReferences(task, dto.getFarmId(), tenantId);
        if (task.getFarmId() == null) {
            throw new BusinessException(400, "所属农场不能为空（请选择执行地块或关联计划）");
        }
        save(task);
        return toVO(task);
    }

    @Override
    @Transactional
    public TaskVO update(TaskSaveDTO dto, String tenantId) {
        Task task = getById(dto.getId());
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (!isEditable(task.getStatus())) {
            throw new BusinessException(400, "任务已开始执行，无法修改");
        }
        normalizePageAliases(dto, tenantId);
        // 部分更新：只覆盖请求里真的带了的字段。BeanUtils.copyProperties 会把 null 一并写进实体，
        // 详情页只改名称时会把类型 / 地块 / 执行人 / 时间全部清空。
        if (dto.getTaskName() != null) task.setTaskName(dto.getTaskName());
        if (dto.getTaskType() != null) task.setTaskType(dto.getTaskType());
        if (dto.getTaskTypeDetail() != null) task.setTaskTypeDetail(dto.getTaskTypeDetail());
        if (dto.getFarmId() != null && !dto.getFarmId().isBlank()) {
            task.setFarmId(farmIdResolver.resolveFilter(dto.getFarmId(), tenantId));
        }
        if (dto.getFarmCode() != null) task.setFarmCode(dto.getFarmCode());
        if (dto.getPlotId() != null) task.setPlotId(dto.getPlotId());
        if (dto.getPlotCode() != null) task.setPlotCode(dto.getPlotCode());
        if (dto.getPlanId() != null) task.setPlanId(dto.getPlanId());
        if (dto.getStageId() != null) task.setStageId(dto.getStageId());
        if (dto.getCropName() != null) task.setCropName(dto.getCropName());
        if (dto.getTaskDesc() != null) task.setTaskDesc(dto.getTaskDesc());
        if (dto.getExecutorId() != null) task.setExecutorId(dto.getExecutorId());
        if (dto.getExecutorName() != null) task.setExecutorName(dto.getExecutorName());
        if (dto.getPlanStartTime() != null) task.setPlanStartTime(dto.getPlanStartTime());
        if (dto.getPlanEndTime() != null) task.setPlanEndTime(dto.getPlanEndTime());
        if (dto.getPriority() != null) task.setPriority(dto.getPriority());
        if (dto.getInputMaterials() != null) task.setInputMaterials(dto.getInputMaterials());
        if (dto.getInputMaterialsJson() != null) task.setInputMaterialsJson(dto.getInputMaterialsJson());
        if (dto.getExpectedOutput() != null) task.setExpectedOutput(dto.getExpectedOutput());
        if (dto.getQualityRequirement() != null) task.setQualityRequirement(dto.getQualityRequirement());
        if (dto.getTemplateId() != null) task.setTemplateId(dto.getTemplateId());
        if (dto.getRemark() != null) task.setRemark(dto.getRemark());
        if (task.getTaskName() == null || task.getTaskName().isBlank()) {
            throw new BusinessException(400, "任务名称不能为空");
        }
        if (task.getTaskType() == null || task.getTaskType().isBlank()) {
            throw new BusinessException(400, "任务类型不能为空");
        }
        applyPlanReference(task, tenantId);
        applyFarmAndPlotReferences(task, dto.getFarmId(), tenantId);
        if (task.getFarmId() == null) {
            throw new BusinessException(400, "所属农场不能为空");
        }
        updateById(task);
        return toVO(task);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (isExecuting(task.getStatus())) {
            throw new BusinessException(400, "任务正在执行中，无法删除");
        }
        removeById(id);
    }

    @Override
    public TaskVO getById(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        return toVO(task);
    }

    @Override
    public PageResult<TaskVO> pageQuery(TaskPageDTO dto, Long farmId, String tenantId) {
        // 状态归一：旧词 doing/done 在库/接口里仍可能出现，查询统一按新词执行
        if ("doing".equals(dto.getStatus())) {
            dto.setStatus("executing");
        } else if ("done".equals(dto.getStatus())) {
            dto.setStatus("completed");
        }
        // 执行人筛选：页面传成员业务标识，换算成本地主键后再进 SQL
        if (dto.getAssigneeId() != null && !dto.getAssigneeId().isBlank()) {
            dto.setExecutorId(resolveMember(dto.getAssigneeId().trim(), tenantId).getId());
        }
        if (dto.getKeyword() != null) {
            dto.setKeyword(dto.getKeyword().trim());
        }
        Page<Task> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Task> result = baseMapper.pageQuery(page, dto, farmId, tenantId);
        List<TaskVO> voList = result.getRecords().stream().map(this::toVO).toList();
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    @Transactional
    public TaskVO startTask(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        // 待处理、已派发、验收驳回后都能重新进入执行；驳回不再落到 doing 死状态。
        if (!"pending".equals(task.getStatus()) && !"assigned".equals(task.getStatus())
                && !"rejected".equals(task.getStatus())) {
            throw new BusinessException(400, "任务状态不正确：" + task.getStatus() + "（只有待处理/已派发/已驳回的任务能开始执行）");
        }
        if (task.getExecutorId() == null) {
            throw new BusinessException(400, "任务尚未派发执行人，请先派发");
        }
        task.setStatus("executing");
        task.setActualStartTime(LocalDateTime.now());
        updateById(task);
        // 开始执行自动落一条执行记录（类型 1），详情页时间轴与验收页不再需要人工补录
        appendRecord(task, 1, null, tenantId);
        syncStageOnStart(task);
        return toVO(task);
    }

    @Override
    @Transactional
    public TaskVO completeTask(Long id, String resultDesc, String resultPhotoUrls, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (!isExecuting(task.getStatus())) {
            throw new BusinessException(400, "任务状态不正确");
        }
        task.setStatus("completed");
        task.setActualEndTime(LocalDateTime.now());
        task.setResultDesc(resultDesc);
        task.setResultPhotoUrls(resultPhotoUrls);
        task.setAcceptStatus(0); // 待验收
        updateById(task);
        // 提交成果自动落一条完成打卡（类型 3），照片作为验收证据
        appendRecord(task, 3, resultPhotoUrls, tenantId);
        return toVO(task);
    }

    @Override
    @Transactional
    public TaskVO acceptTask(Long id, Integer acceptStatus, String remark, String acceptorName, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (acceptStatus == null || (acceptStatus != 1 && acceptStatus != 2)) {
            throw new BusinessException(400, "验收结论只能是 1（通过）或 2（驳回）");
        }
        // 验收必须发生在「执行人已提交成果」之后：只认 completed/done + acceptStatus=0
        if (!isDone(task.getStatus())) {
            throw new BusinessException(400, "任务尚未提交成果，不能验收（当前状态：" + task.getStatus() + "）");
        }
        if (task.getAcceptStatus() != null && task.getAcceptStatus() != 0) {
            throw new BusinessException(400, "任务已经验收过，如需重新验收请让执行人重新提交成果");
        }
        if (acceptStatus == 1) {
            task.setStatus("completed");
            if (task.getActualEndTime() == null) {
                task.setActualEndTime(LocalDateTime.now());
            }
        } else {
            task.setStatus("rejected");
            task.setRejectCount((task.getRejectCount() == null ? 0 : task.getRejectCount()) + 1);
        }
        task.setAcceptStatus(acceptStatus);
        task.setAcceptRemark(remark);
        task.setAcceptorName(acceptorName);
        task.setAcceptedAt(LocalDateTime.now());
        updateById(task);
        if (acceptStatus == 1) {
            syncStageOnAcceptance(task);
        }
        return toVO(task);
    }

    @Override
    public java.util.Map<String, Object> getAcceptance(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        java.util.Map<String, Object> view = new java.util.LinkedHashMap<>();
        // 这个模块没有独立的"验收表"：验收结论就存在任务行上，这里按前端 TaskAcceptance 的字段拼
        view.put("acceptanceId", null);
        view.put("taskId", task.getId());
        view.put("acceptStatus", task.getAcceptStatus() == null ? 0 : task.getAcceptStatus());
        view.put("acceptorId", task.getAcceptorId());
        view.put("acceptorName", task.getAcceptorName());
        view.put("remark", task.getAcceptRemark());
        view.put("attachmentUrls", java.util.List.of());
        view.put("acceptedAt", task.getAcceptedAt());
        return view;
    }

    @Override
    @Transactional
    public TaskVO assignTask(Long id, String assigneeId, String assigneeName, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (assigneeId == null || assigneeId.isBlank()) {
            throw new BusinessException(400, "必须指定执行人");
        }
        TeamMember member = resolveMember(assigneeId.trim(), tenantId);
        task.setExecutorId(member.getId());
        // 姓名优先取调用方带的，否则用成员台账的真实姓名（避免"执行人只有 id 没有名字"）
        task.setExecutorName(assigneeName != null && !assigneeName.isBlank()
                ? assigneeName
                : member.getMemberName());
        // 派发后进入"已派发"：原先只有 pending，派了人也还是 pending，看板上分不清
        if ("pending".equals(task.getStatus())) {
            task.setStatus("assigned");
        }
        updateById(task);
        return toVO(task);
    }

    @Override
    public java.util.Map<String, Object> pageRecords(Long taskId, Integer pageNum, Integer pageSize,
                                                    String tenantId) {
        Task task = getById(taskId);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        Page<TaskRecord> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 50 : pageSize);
        IPage<TaskRecord> result = taskRecordMapper.selectPage(page,
                new LambdaQueryWrapper<TaskRecord>()
                        .eq(TaskRecord::getTaskId, taskId)
                        .orderByDesc(TaskRecord::getExecuteTime));
        // 前端分页适配读的是 records/total/page/size（见 api/tasks.ts 的 normalizePageResult）
        java.util.Map<String, Object> view = new java.util.LinkedHashMap<>();
        view.put("records", result.getRecords());
        view.put("total", result.getTotal());
        view.put("page", result.getCurrent());
        view.put("size", result.getSize());
        return view;
    }

    @Override
    @Transactional
    public Long createRecord(Long taskId, java.util.Map<String, Object> body, String tenantId) {
        Task task = getById(taskId);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        // 打卡记录至少要有"这是个什么动作"：executeType 1 开始 / 2 过程 / 3 完成。
        // 少了这条校验，一个空请求体就能写进一行"动作、时间、照片、GPS 全空"的记录
        // （实测：空体体检连打几次，任务详情页的打卡列表里就多出几行空白）。
        Integer executeType = toInt(body.get("executeType"));
        if (executeType == null || executeType < 1 || executeType > 3) {
            throw new BusinessException(400, "打卡类型不能为空，且只能是 1（开始）/ 2（过程）/ 3（完成）");
        }
        TaskRecord record = new TaskRecord();
        record.setTaskId(taskId);
        record.setExecutorId(task.getExecutorId());
        record.setExecutorName(task.getExecutorName());
        record.setTenantId(tenantId);
        record.setCreateTime(LocalDateTime.now());
        // 打卡时间以调用方给的为准（离线补传时要保留真实时间），没给就取当前
        record.setExecuteTime(parseTime(body.get("executeTime")));
        record.setExecuteType(executeType);
        record.setPhotos(body.get("photos") == null ? null : String.valueOf(body.get("photos")));
        record.setGpsLat(toDecimal(body.get("gpsLat")));
        record.setGpsLng(toDecimal(body.get("gpsLng")));
        record.setGpsDistance(toDecimal(body.get("gpsDistance")));
        record.setAbnormalDesc(body.get("abnormalDesc") == null ? null : String.valueOf(body.get("abnormalDesc")));
        record.setOfflineFlag(toInt(body.get("offlineFlag")));
        taskRecordMapper.insert(record);
        return record.getRecordId();
    }

    private LocalDateTime parseTime(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return LocalDateTime.now();
        }
        String text = String.valueOf(value).trim().replace('T', ' ');
        if (text.length() > 19) {
            text = text.substring(0, 19);
        }
        return LocalDateTime.parse(text, java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
    }

    private Integer toInt(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return Integer.valueOf(String.valueOf(value));
    }

    private java.math.BigDecimal toDecimal(Object value) {
        if (value == null || String.valueOf(value).isBlank()) {
            return null;
        }
        return new java.math.BigDecimal(String.valueOf(value));
    }

    @Override
    public List<TaskVO> listByFarmId(Long farmId, String tenantId) {
        List<Task> tasks = baseMapper.selectByFarmId(farmId, tenantId);
        return tasks.stream().map(this::toVO).toList();
    }

    @Override
    public List<TaskVO> listByExecutorId(Long executorId, String tenantId) {
        List<Task> tasks = baseMapper.selectByExecutorId(executorId, tenantId);
        return tasks.stream().map(this::toVO).toList();
    }

    @Override
    public TaskVO getByCode(String taskCode, String tenantId) {
        Task task = baseMapper.selectByCode(taskCode, tenantId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在");
        }
        return toVO(task);
    }

    private TaskVO toVO(Task task) {
        TaskVO vo = BeanCopyUtils.copy(task, TaskVO.class);
        if (vo == null) {
            return null;
        }
        // 农场 / 地块名称：页面列表直接展示名称，没有这层回填就只能看到一串数字 id
        if (task.getFarmId() != null) {
            Farm farm = farmMapper.selectById(task.getFarmId());
            if (farm != null) {
                vo.setFarmName(farm.getFarmName());
                if (vo.getFarmCode() == null || vo.getFarmCode().isBlank()) {
                    vo.setFarmCode(farm.getFarmCode());
                }
            }
        }
        if (task.getPlotId() != null) {
            Plot plot = plotMapper.selectById(task.getPlotId());
            if (plot != null) {
                vo.setPlotName(plot.getPlotName());
                if (vo.getPlotCode() == null || vo.getPlotCode().isBlank()) {
                    vo.setPlotCode(plot.getPlotCode());
                }
            }
        }
        if (task.getPlanId() != null) {
            PlantingPlan plan = planMapper.selectById(task.getPlanId());
            if (plan != null) {
                vo.setPlanName(plan.getPlanName());
            }
        }
        if (task.getStageId() != null) {
            PlanStage stage = stageMapper.selectById(task.getStageId());
            if (stage != null) {
                vo.setStageName(stage.getStageName());
            }
        }
        return vo;
    }

    private void applyPlanReference(Task task, String tenantId) {
        if (task.getStageId() != null) {
            PlanStage stage = stageMapper.selectById(task.getStageId());
            if (stage == null || !tenantId.equals(stage.getTenantId())) {
                throw new BusinessException(400, "计划阶段不存在（本租户内查不到该阶段）：" + task.getStageId());
            }
            if (task.getPlanId() != null && !task.getPlanId().equals(stage.getPlanId())) {
                throw new BusinessException(400, "任务关联的阶段不属于所选计划");
            }
            task.setPlanId(stage.getPlanId());
        }
        if (task.getPlanId() == null) {
            return;
        }
        PlantingPlan plan = planMapper.selectById(task.getPlanId());
        if (plan == null || !tenantId.equals(plan.getTenantId())) {
            throw new BusinessException(400, "种养计划不存在（本租户内查不到该计划）：" + task.getPlanId());
        }
        if (task.getFarmId() == null) {
            task.setFarmId(plan.getFarmId());
        }
        if (task.getPlotId() == null) {
            task.setPlotId(plan.getPlotId());
        }
        if (task.getCropName() == null || task.getCropName().isBlank()) {
            task.setCropName(plan.getCropName());
        }
    }

    private void syncStageOnStart(Task task) {
        if (task.getStageId() == null) {
            return;
        }
        PlanStage stage = stageMapper.selectById(task.getStageId());
        if (stage == null || Integer.valueOf(3).equals(stage.getStatus())) {
            return;
        }
        stage.setStatus(2);
        if (stage.getActualStartDate() == null) {
            stage.setActualStartDate(LocalDate.now());
        }
        stage.setUpdateTime(LocalDateTime.now());
        stageMapper.updateById(stage);
    }

    private void syncStageOnAcceptance(Task task) {
        if (task.getStageId() == null) {
            return;
        }
        PlanStage stage = stageMapper.selectById(task.getStageId());
        if (stage == null) {
            return;
        }
        // 同一阶段可能挂多个任务：只有一个任务验收通过时，阶段仍应保持"进行中"，
        // 全部任务完成/取消/过期后才置为已完成。早先是第一个任务验收通过就把阶段关掉。
        Long unfinished = baseMapper.selectCount(new LambdaQueryWrapper<Task>()
                .eq(Task::getStageId, task.getStageId())
                .eq(Task::getTenantId, task.getTenantId())
                .notIn(Task::getStatus, "completed", "done", "cancelled", "expired"));
        if (unfinished != null && unfinished > 0) {
            stage.setStatus(2);
            if (stage.getActualStartDate() == null) {
                stage.setActualStartDate(LocalDate.now());
            }
        } else {
            stage.setStatus(3);
            stage.setActualEndDate(LocalDate.now());
            if (stage.getActualStartDate() == null) {
                stage.setActualStartDate(LocalDate.now());
            }
        }
        stage.setUpdateTime(LocalDateTime.now());
        stageMapper.updateById(stage);
    }

    private static boolean isEditable(String status) {
        return "pending".equals(status) || "assigned".equals(status) || "rejected".equals(status);
    }

    private static boolean isExecuting(String status) {
        return "executing".equals(status) || "doing".equals(status);
    }

    private static boolean isDone(String status) {
        return "completed".equals(status) || "done".equals(status);
    }

    private String generateTaskCode(String tenantId) {
        return "TSK" + System.currentTimeMillis() % 1000000;
    }
}
