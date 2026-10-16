package com.agri.production.service.impl;

import com.agri.production.dto.TaskPageDTO;
import com.agri.production.dto.TaskSaveDTO;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Task;
import com.agri.production.entity.TaskRecord;
import com.agri.production.entity.TeamMember;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.mapper.TaskRecordMapper;
import com.agri.production.mapper.TeamMemberMapper;
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
            Long pk = parseLong(rawAssignee);
            TeamMember member = pk != null
                    ? memberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                            .eq(TeamMember::getTenantId, tenantId).eq(TeamMember::getId, pk).last("LIMIT 1"))
                    : memberMapper.selectOne(new LambdaQueryWrapper<TeamMember>()
                            .eq(TeamMember::getTenantId, tenantId)
                            .eq(TeamMember::getMemberId, rawAssignee).last("LIMIT 1"));
            if (member == null) {
                throw new BusinessException(400, "执行人不存在（本租户内查不到该成员）：" + rawAssignee);
            }
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

    @Override
    @Transactional
    public TaskVO save(TaskSaveDTO dto, String tenantId) {
        normalizePageAliases(dto, tenantId);
        Task task = BeanCopyUtils.copy(dto, Task.class);
        task.setTenantId(tenantId);
        task.setTaskCode(generateTaskCode(tenantId));
        task.setStatus("pending");
        task.setAcceptStatus(0); // 待验收（原先写 approval_status，那一列在表里并不存在）
        save(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public TaskVO update(TaskSaveDTO dto, String tenantId) {
        Task task = getById(dto.getId());
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (!"pending".equals(task.getStatus())) {
            throw new BusinessException(400, "任务已开始执行，无法修改");
        }
        normalizePageAliases(dto, tenantId);
        BeanCopyUtils.copy(dto, task);
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public void delete(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if ("executing".equals(task.getStatus())) {
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
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    public PageResult<TaskVO> pageQuery(TaskPageDTO dto, Long farmId, String tenantId) {
        Page<Task> page = new Page<>(dto.getPageNum(), dto.getPageSize());
        IPage<Task> result = baseMapper.pageQuery(page, dto, farmId, tenantId);
        List<TaskVO> voList = BeanCopyUtils.copyList(result.getRecords(), TaskVO.class);
        return PageResult.of(voList, result.getTotal(), dto.getPageNum(), dto.getPageSize());
    }

    @Override
    @Transactional
    public TaskVO startTask(Long id, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        // 可从"待处理"或"已派发"开始执行 —— 派发（assign）会把状态置成 assigned，
        // 只认 pending 的话，派完人反而开始不了（自己的状态机自相矛盾）。
        if (!"pending".equals(task.getStatus()) && !"assigned".equals(task.getStatus())) {
            throw new BusinessException(400, "任务状态不正确：" + task.getStatus() + "（只有待处理/已派发的任务能开始执行）");
        }
        task.setStatus("executing");
        task.setActualStartTime(LocalDateTime.now());
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    @Override
    @Transactional
    public TaskVO completeTask(Long id, String resultDesc, String resultPhotoUrls, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (!"executing".equals(task.getStatus())) {
            throw new BusinessException(400, "任务状态不正确");
        }
        task.setStatus("completed");
        task.setActualEndTime(LocalDateTime.now());
        task.setResultDesc(resultDesc);
        task.setResultPhotoUrls(resultPhotoUrls);
        task.setAcceptStatus(0); // 待验收（原先写 approval_status，那一列在表里并不存在）
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
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
        // 通过：任务完成（完成时间就是实际结束时间，出参 completedAt 由它派生）
        // 驳回：退回执行（status 用词表里的 doing，与前端 isTaskExecuting 兼容），驳回次数 +1
        if (acceptStatus == 1) {
            task.setStatus("completed");
            if (task.getActualEndTime() == null) {
                task.setActualEndTime(java.time.LocalDateTime.now());
            }
        } else {
            task.setStatus("doing");
            task.setRejectCount((task.getRejectCount() == null ? 0 : task.getRejectCount()) + 1);
        }
        task.setAcceptStatus(acceptStatus);
        task.setAcceptRemark(remark);
        task.setAcceptorName(acceptorName);
        task.setAcceptedAt(java.time.LocalDateTime.now());
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
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
    public TaskVO assignTask(Long id, Long assigneeId, String assigneeName, String tenantId) {
        Task task = getById(id);
        if (task == null || !tenantId.equals(task.getTenantId())) {
            throw new BusinessException(404, "任务不存在");
        }
        if (assigneeId == null) {
            throw new BusinessException(400, "必须指定执行人");
        }
        task.setExecutorId(assigneeId);
        // 姓名优先取调用方带的；没带就沿用原来的（否则会出现"执行人只有 id 没有名字"，
        // 列表页那一列就空了）
        if (assigneeName != null && !assigneeName.isEmpty()) {
            task.setExecutorName(assigneeName);
        }
        // 派发后进入"已派发"：原先只有 pending，派了人也还是 pending，看板上分不清
        if ("pending".equals(task.getStatus())) {
            task.setStatus("assigned");
        }
        updateById(task);
        return BeanCopyUtils.copy(task, TaskVO.class);
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
        return BeanCopyUtils.copyList(tasks, TaskVO.class);
    }

    @Override
    public List<TaskVO> listByExecutorId(Long executorId, String tenantId) {
        List<Task> tasks = baseMapper.selectByExecutorId(executorId, tenantId);
        return BeanCopyUtils.copyList(tasks, TaskVO.class);
    }

    @Override
    public TaskVO getByCode(String taskCode, String tenantId) {
        Task task = baseMapper.selectByCode(taskCode, tenantId);
        if (task == null) {
            throw new BusinessException(404, "任务不存在");
        }
        return BeanCopyUtils.copy(task, TaskVO.class);
    }

    private String generateTaskCode(String tenantId) {
        return "TSK" + System.currentTimeMillis() % 1000000;
    }
}
