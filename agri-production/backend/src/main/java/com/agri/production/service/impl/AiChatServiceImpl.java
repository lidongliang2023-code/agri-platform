package com.agri.production.service.impl;

import com.agri.production.common.constant.AlertDict;
import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.AiDiagnosis;
import com.agri.production.entity.AiMessage;
import com.agri.production.entity.AiSession;
import com.agri.production.entity.AlertRecord;
import com.agri.production.entity.GrowthRecord;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.IoTDevice;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.Plot;
import com.agri.production.entity.Task;
import com.agri.production.mapper.AiDiagnosisMapper;
import com.agri.production.mapper.AiMessageMapper;
import com.agri.production.mapper.AiSessionMapper;
import com.agri.production.mapper.AlertRecordMapper;
import com.agri.production.mapper.GrowthRecordMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.IoTDeviceMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.PlotMapper;
import com.agri.production.mapper.TaskMapper;
import com.agri.production.service.IAiChatService;
import com.agri.production.vo.AiDiagnosisVO;
import com.agri.production.vo.AiMessageVO;
import com.agri.production.vo.AiSessionVO;
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
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * AI 助手实现：诊断记录列表 + 规则式问答。
 *
 * <p><b>为什么是规则式</b>：本部署没有任何模型依赖。与其做一个"看起来像 AI"的回答，
 * 不如把助手做成**检索式**的：只回答本服务库里有据可查的问题（采收量、任务、告警、设备在线、
 * 最近长势、检测合格率、地块面积），每条回复都带上数据来源（refDocIds）与 engine=rule-based。
 * 问它答不了的事（成本收益、产量预测、病虫害识别结论），它就说答不了 —— 这正是方案第五节定的口径。</p>
 */
@Slf4j
@Service
public class AiChatServiceImpl implements IAiChatService {

    private static final List<String> TASK_DONE = List.of("completed", "done");
    private static final List<String> TASK_OPEN = List.of("pending", "assigned", "executing", "doing");
    private static final List<String> DEVICE_ONLINE = List.of("online", "ONLINE", "1");
    private static final DateTimeFormatter ID_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmssSSS");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final int TITLE_MAX = 60;

    private final AiDiagnosisMapper diagnosisMapper;
    private final AiSessionMapper sessionMapper;
    private final AiMessageMapper messageMapper;
    private final HarvestBatchMapper harvestMapper;
    private final TaskMapper taskMapper;
    private final AlertRecordMapper alertMapper;
    private final IoTDeviceMapper deviceMapper;
    private final GrowthRecordMapper growthMapper;
    private final InspectionMapper inspectionMapper;
    private final PlotMapper plotMapper;

    public AiChatServiceImpl(AiDiagnosisMapper diagnosisMapper, AiSessionMapper sessionMapper,
                             AiMessageMapper messageMapper, HarvestBatchMapper harvestMapper,
                             TaskMapper taskMapper, AlertRecordMapper alertMapper, IoTDeviceMapper deviceMapper,
                             GrowthRecordMapper growthMapper, InspectionMapper inspectionMapper,
                             PlotMapper plotMapper) {
        this.diagnosisMapper = diagnosisMapper;
        this.sessionMapper = sessionMapper;
        this.messageMapper = messageMapper;
        this.harvestMapper = harvestMapper;
        this.taskMapper = taskMapper;
        this.alertMapper = alertMapper;
        this.deviceMapper = deviceMapper;
        this.growthMapper = growthMapper;
        this.inspectionMapper = inspectionMapper;
        this.plotMapper = plotMapper;
    }

    /* ==================== 诊断记录 ==================== */

    @Override
    public PageResult<AiDiagnosisVO> pageDiagnoses(String tenantId, int pageNum, int pageSize,
                                                   String keyword, String status) {
        requireTenant(tenantId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        LambdaQueryWrapper<AiDiagnosis> w = new LambdaQueryWrapper<AiDiagnosis>().eq(AiDiagnosis::getTenantId, tenantId);
        String kw = blankToNull(keyword);
        if (kw != null) {
            w.and(q -> q.like(AiDiagnosis::getResultLabel, kw).or().like(AiDiagnosis::getCropName, kw)
                    .or().like(AiDiagnosis::getModelName, kw));
        }
        String st = blankToNull(status);
        if (st != null) {
            w.eq(AiDiagnosis::getStatus, st.toUpperCase(Locale.ROOT));
        }
        w.orderByDesc(AiDiagnosis::getDiagnosedAt).orderByDesc(AiDiagnosis::getDiagnosisId);
        Page<AiDiagnosis> page = diagnosisMapper.selectPage(new Page<>(p, s), w);
        Map<String, String> plotNames = plotNames(tenantId);
        List<AiDiagnosisVO> rows = page.getRecords().stream()
                .map(row -> AiDiagnosisVO.of(row, row.getPlotId() == null ? null : plotNames.get(row.getPlotId())))
                .toList();
        return PageResult.of(rows, page.getTotal(), p, s);
    }

    /** 地块标识 → 名称（当前库里的诊断记录用的是平台侧地块标识，这里按"本地主键或标识"都试一遍）。 */
    private Map<String, String> plotNames(String tenantId) {
        Map<String, String> map = new LinkedHashMap<>();
        for (Plot plot : plotMapper.selectList(new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId, tenantId))) {
            map.put(String.valueOf(plot.getId()), plot.getPlotName());
            if (plot.getPlotCode() != null) {
                map.put(plot.getPlotCode(), plot.getPlotName());
            }
        }
        return map;
    }

    /* ==================== 会话与消息 ==================== */

    @Override
    public List<AiSessionVO> listSessions(String tenantId) {
        requireTenant(tenantId);
        List<AiSession> sessions = sessionMapper.selectList(new LambdaQueryWrapper<AiSession>()
                .eq(AiSession::getTenantId, tenantId)
                .orderByDesc(AiSession::getUpdateTime).orderByDesc(AiSession::getSessionId));
        List<AiSessionVO> result = new ArrayList<>(sessions.size());
        for (AiSession session : sessions) {
            result.add(AiSessionVO.of(session, lastMessage(tenantId, session.getSessionId())));
        }
        return result;
    }

    private String lastMessage(String tenantId, String sessionId) {
        List<AiMessage> rows = messageMapper.selectList(new LambdaQueryWrapper<AiMessage>()
                .eq(AiMessage::getTenantId, tenantId)
                .eq(AiMessage::getSessionId, sessionId)
                .orderByDesc(AiMessage::getId)
                .last("LIMIT 1"));
        if (rows.isEmpty()) {
            return null;
        }
        String content = rows.get(0).getContent();
        return content.length() > 40 ? content.substring(0, 40) + "…" : content;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiSessionVO createSession(String tenantId, String title) {
        requireTenant(tenantId);
        AiSession session = new AiSession();
        session.setSessionId("SESS" + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
        String name = blankToNull(title);
        session.setTitle(name == null ? "新对话" : (name.length() > TITLE_MAX ? name.substring(0, TITLE_MAX) : name));
        session.setMessageCount(0);
        session.setTenantId(tenantId);
        sessionMapper.insert(session);
        log.info("AI 会话新建：{}（{}）", session.getSessionId(), session.getTitle());
        return AiSessionVO.of(session, null);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean renameSession(String tenantId, String sessionId, String title) {
        requireTenant(tenantId);
        AiSession session = requireSession(tenantId, sessionId);
        String name = requireText(title, "会话标题", TITLE_MAX);
        session.setTitle(name);
        session.setUpdateTime(LocalDateTime.now());
        sessionMapper.updateById(session);
        return true;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteSession(String tenantId, String sessionId) {
        requireTenant(tenantId);
        AiSession session = requireSession(tenantId, sessionId);
        sessionMapper.deleteById(session.getId());
        // 消息一并逻辑删除：留着"孤儿消息"会让下次用同一个编号时串出历史对话
        for (AiMessage message : messageMapper.selectList(new LambdaQueryWrapper<AiMessage>()
                .eq(AiMessage::getTenantId, tenantId).eq(AiMessage::getSessionId, session.getSessionId()))) {
            messageMapper.deleteById(message.getId());
        }
        log.info("AI 会话删除：{}", session.getSessionId());
    }

    @Override
    public List<AiMessageVO> messages(String tenantId, String sessionId) {
        requireTenant(tenantId);
        AiSession session = requireSession(tenantId, sessionId);
        return messageMapper.selectList(new LambdaQueryWrapper<AiMessage>()
                        .eq(AiMessage::getTenantId, tenantId)
                        .eq(AiMessage::getSessionId, session.getSessionId())
                        .orderByAsc(AiMessage::getId))
                .stream().map(AiMessageVO::of).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public AiMessageVO send(String tenantId, String sessionId, String content) {
        requireTenant(tenantId);
        String text = requireText(content, "消息内容", 2000);
        AiSession session;
        if (blankToNull(sessionId) == null) {
            // 没给会话就新建一个（标题取提问前 20 字）：页面虽然要求先建会话，
            // 但接口层自己兜住比"必须先点新建"更符合直觉，且不编造任何内容
            AiSession created = new AiSession();
            created.setSessionId("SESS" + LocalDateTime.now().format(ID_FORMAT)
                    + String.format("%04d", ThreadLocalRandom.current().nextInt(10000)));
            created.setTitle(text.length() > 20 ? text.substring(0, 20) : text);
            created.setMessageCount(0);
            created.setTenantId(tenantId);
            sessionMapper.insert(created);
            session = created;
        } else {
            session = requireSession(tenantId, sessionId);
        }

        AiMessage question = new AiMessage();
        question.setMessageId(newId("MSG"));
        question.setSessionId(session.getSessionId());
        question.setRole("user");
        question.setContent(text);
        question.setTenantId(tenantId);
        messageMapper.insert(question);

        Answer answer = reply(tenantId, text);
        AiMessage reply = new AiMessage();
        reply.setMessageId(newId("MSG"));
        reply.setSessionId(session.getSessionId());
        reply.setRole("assistant");
        reply.setContent(answer.text());
        reply.setEngine(AiMessageVO.ENGINE_RULE_BASED);
        reply.setRefDocIds(String.join(",", answer.refs()));
        reply.setTenantId(tenantId);
        messageMapper.insert(reply);

        session.setMessageCount((session.getMessageCount() == null ? 0 : session.getMessageCount()) + 2);
        session.setUpdateTime(LocalDateTime.now());
        sessionMapper.updateById(session);
        log.info("AI 问答：{} → 命中规则 {}（{} 字）", session.getSessionId(), answer.rule(), answer.text().length());
        return AiMessageVO.of(reply);
    }

    /* ==================== 规则式应答 ==================== */

    /**
     * 一条规则式回答。
     *
     * @param rule 命中的规则名（写日志用，便于回答"为什么这么答"）
     * @param text 回答正文
     * @param refs 用到的数据来源（落 refDocIds，便于追溯数字出处）
     */
    private record Answer(String rule, String text, List<String> refs) {
    }

    /**
     * 意图识别 + 取数作答。

     *
     * <p>顺序是有意的：**先拦"答不了的"**（预测/成本/识别/用药），再答"有数据的" ——
     * 否则"预测一下产量"会因为含"产量"二字走到采收量那条规则上，答非所问还显得像在预测。</p>
     */
    private Answer reply(String tenantId, String rawText) {
        String text = rawText.toLowerCase(Locale.ROOT);
        if (hit(text, "你好", "您好", "能问", "怎么用", "帮助", "help")) {
            return new Answer("help", """
                    我是本系统的生产数据助手（规则式应答，不是大模型）。可以帮你查这些：
                    · 采收：如「累计采收量」「最近一次采收」
                    · 任务：如「还有多少任务没做」
                    · 告警：如「有没有未处理的告警」
                    · 设备：如「多少台设备在线」
                    · 长势：如「最近的长势记录」
                    · 检测：如「检测合格率」
                    · 地块：如「有多少地块、在种面积多大」
                    产量预测、病虫害识别、成本收益这类问题本部署没有数据源，我会直接说答不了。""",
                    List.of("capability"));
        }
        if (hit(text, "预测", "成本", "收益", "利润", "识别", "拍照", "用药", "打什么药", "模型", "建议", "怎么办才")) {
            return new Answer("not-available", """
                    这个问题我答不了，也不猜：本部署没有接入任何模型与成本数据源，
                    所以产量预测、病虫害识别结论、成本收益、用药建议都不提供。
                    能给的只有库里实际记录：地块/采收/任务/告警/设备/长势/检测这几类，
                    识别与用药请以农技员现场判断为准。""",
                    List.of("no-data-source"));
        }
        if (hit(text, "采收", "收获", "产量", "harvest")) {
            return harvestAnswer(tenantId);
        }
        if (hit(text, "任务", "农事", "待办", "工单", "task")) {
            return taskAnswer(tenantId);
        }
        if (hit(text, "告警", "预警", "报警", "异常", "alert")) {
            return alertAnswer(tenantId);
        }
        if (hit(text, "设备", "传感器", "在线", "离线", "device")) {
            return deviceAnswer(tenantId);
        }
        if (hit(text, "生长", "长势", "株高", "生育期", "叶")) {
            return growthAnswer(tenantId);
        }
        if (hit(text, "检测", "合格", "质量", "抽检")) {
            return inspectionAnswer(tenantId);
        }
        if (hit(text, "地块", "农场", "面积", "在种")) {
            return plotAnswer(tenantId);
        }
        return new Answer("fallback", """
                这句我没对应上（本部署的助手是规则式应答，只认固定的几类问法）。
                可以试着问：累计采收量 / 还有多少任务 / 有没有未处理告警 / 多少设备在线 /
                最近的长势记录 / 检测合格率 / 有多少地块。
                需要更自由的问答得等接入模型能力。""",
                List.of("fallback"));
    }

    private Answer harvestAnswer(String tenantId) {
        List<HarvestBatch> batches = harvestMapper.selectList(new LambdaQueryWrapper<HarvestBatch>()
                .eq(HarvestBatch::getTenantId, tenantId).orderByAsc(HarvestBatch::getHarvestDate));
        if (batches.isEmpty()) {
            return new Answer("harvest", "本服务里目前没有任何采收批次记录。", List.of("harvest-batches"));
        }
        BigDecimal total = BigDecimal.ZERO;
        for (HarvestBatch batch : batches) {
            if (batch.getQuantity() != null) {
                total = total.add(batch.getQuantity());
            }
        }
        HarvestBatch last = batches.get(batches.size() - 1);
        return new Answer("harvest", String.format(
                "累计采收 %s kg，共 %d 个批次。最近一次：%s %s %s kg（等级 %s）。",
                total.stripTrailingZeros().toPlainString(), batches.size(),
                last.getHarvestDate() == null ? "日期未记录" : DATE.format(last.getHarvestDate()),
                last.getCropName() == null ? "作物未记录" : last.getCropName(),
                last.getQuantity() == null ? "-" : last.getQuantity().stripTrailingZeros().toPlainString(),
                last.getGrade() == null ? "-" : last.getGrade()),
                List.of("harvest-batches"));
    }

    private Answer taskAnswer(String tenantId) {
        long open = countTask(tenantId, TASK_OPEN, false);
        long pending = countTask(tenantId, List.of("pending"), false);
        LocalDate monthStart = LocalDate.now().withDayOfMonth(1);
        long monthTotal = countTask(tenantId, null, true);
        long monthDone = countTask(tenantId, TASK_DONE, true);
        String rate = monthTotal == 0 ? "本月暂无任务"
                : String.format("本月 %d 条任务，已完成 %d 条（%.1f%%）", monthTotal, monthDone,
                        monthDone * 100.0 / monthTotal);
        return new Answer("task", String.format("待处理 %d 条、未完成合计 %d 条；%s（统计口径：本月=当前自然月，按计划开始时间归属）。",
                pending, open, rate), List.of("tasks"));
    }

    private Answer alertAnswer(String tenantId) {
        List<AlertRecord> pending = alertMapper.selectList(new LambdaQueryWrapper<AlertRecord>()
                .eq(AlertRecord::getTenantId, tenantId)
                .in(AlertRecord::getStatus, AlertDict.statusValuesOf(AlertDict.STATUS_PENDING))
                .orderByDesc(AlertRecord::getId));
        if (pending.isEmpty()) {
            return new Answer("alert", "当前没有未处理的告警。", List.of("alert-records"));
        }
        AlertRecord newest = pending.get(0);
        return new Answer("alert", String.format("有 %d 条未处理告警。最近一条：%s（%s，级别 %s）。",
                pending.size(),
                newest.getTitle() == null ? "标题未记录" : newest.getTitle(),
                newest.getSourceName() == null ? "来源未记录" : newest.getSourceName(),
                newest.getLevel() == null ? "-" : newest.getLevel()),
                List.of("alert-records"));
    }

    private Answer deviceAnswer(String tenantId) {
        long total = deviceMapper.selectCount(new LambdaQueryWrapper<IoTDevice>().eq(IoTDevice::getTenantId, tenantId));
        long online = deviceMapper.selectCount(new LambdaQueryWrapper<IoTDevice>()
                .eq(IoTDevice::getTenantId, tenantId).in(IoTDevice::getStatus, DEVICE_ONLINE));
        return new Answer("device", String.format("设备台账共 %d 台，其中在线 %d 台、离线 %d 台。",
                total, online, total - online), List.of("iot-devices"));
    }

    private Answer growthAnswer(String tenantId) {
        List<GrowthRecord> rows = growthMapper.selectList(new LambdaQueryWrapper<GrowthRecord>()
                .eq(GrowthRecord::getTenantId, tenantId)
                .orderByDesc(GrowthRecord::getRecordDate).orderByDesc(GrowthRecord::getRecordId)
                .last("LIMIT 1"));
        if (rows.isEmpty()) {
            return new Answer("growth", "还没有任何生长记录。", List.of("growth-records"));
        }
        GrowthRecord row = rows.get(0);
        return new Answer("growth", String.format("最近一条生长记录：%s｜生育期 %s｜株高 %s cm｜长势评级 %s｜记录日期 %s。",
                row.getPlotName() == null ? row.getPlotId() : row.getPlotName(),
                row.getGrowthStage() == null ? "-" : row.getGrowthStage(),
                row.getPlantHeight() == null ? "-" : row.getPlantHeight().stripTrailingZeros().toPlainString(),
                row.getGrowthLevel() == null ? "-" : row.getGrowthLevel(),
                row.getRecordDate() == null ? "-" : DATE.format(row.getRecordDate())),
                List.of("growth-records"));
    }

    private Answer inspectionAnswer(String tenantId) {
        long finished = inspectionMapper.selectCount(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getTenantId, tenantId).isNotNull(Inspection::getResult));
        if (finished == 0) {
            return new Answer("inspection", "目前还没有出结论的检测记录（未出结果的不计入合格率）。",
                    List.of("inspections"));
        }
        long passed = inspectionMapper.selectCount(new LambdaQueryWrapper<Inspection>()
                .eq(Inspection::getTenantId, tenantId).in(Inspection::getResult, List.of("PASS", "pass", "OK", "ok")));
        BigDecimal rate = BigDecimal.valueOf(passed).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(finished), 1, RoundingMode.HALF_UP);
        return new Answer("inspection", String.format("已出结论的检测 %d 条，合格 %d 条，合格率 %s%%（未出结果的不计入分母）。",
                finished, passed, rate.stripTrailingZeros().toPlainString()), List.of("inspections"));
    }

    private Answer plotAnswer(String tenantId) {
        List<Plot> plots = plotMapper.selectList(new LambdaQueryWrapper<Plot>().eq(Plot::getTenantId, tenantId));
        if (plots.isEmpty()) {
            return new Answer("plot", "台账里还没有地块。", List.of("plots"));
        }
        BigDecimal area = BigDecimal.ZERO;
        boolean anyArea = false;
        Set<String> crops = new LinkedHashSet<>();
        for (Plot plot : plots) {
            if (plot.getArea() != null) {
                area = area.add(plot.getArea());
                anyArea = true;
            }
            if (plot.getCurrentCrop() != null && !plot.getCurrentCrop().isBlank()) {
                crops.add(plot.getCurrentCrop().trim());
            }
        }
        return new Answer("plot", String.format("共 %d 个地块，面积合计 %s 亩，在田作物 %d 种%s。",
                plots.size(), anyArea ? area.stripTrailingZeros().toPlainString() : "未记录", crops.size(),
                crops.isEmpty() ? "" : "（" + String.join("、", crops) + "）"),
                List.of("plots"));
    }

    private long countTask(String tenantId, List<String> statuses, boolean thisMonth) {
        LambdaQueryWrapper<Task> w = new LambdaQueryWrapper<Task>().eq(Task::getTenantId, tenantId);
        if (statuses != null) {
            w.in(Task::getStatus, statuses);
        }
        if (thisMonth) {
            LocalDate start = LocalDate.now().withDayOfMonth(1);
            w.ge(Task::getPlanStartTime, start.atStartOfDay())
                    .lt(Task::getPlanStartTime, start.plusMonths(1).atStartOfDay());
        }
        return taskMapper.selectCount(w);
    }

    private static boolean hit(String text, String... keys) {
        for (String key : keys) {
            if (text.contains(key)) {
                return true;
            }
        }
        return false;
    }

    /* ==================== 内部工具 ==================== */

    private AiSession requireSession(String tenantId, String sessionId) {
        String id = requireText(sessionId, "会话编号", 64);
        AiSession session = sessionMapper.selectOne(new LambdaQueryWrapper<AiSession>()
                .eq(AiSession::getTenantId, tenantId)
                .eq(AiSession::getSessionId, id)
                .last("LIMIT 1"));
        if (session == null) {
            throw new BusinessException(404, "会话不存在：" + id);
        }
        return session;
    }

    private static String newId(String prefix) {
        return prefix + LocalDateTime.now().format(ID_FORMAT)
                + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    private static void requireTenant(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) {
            throw new BusinessException(500, "租户上下文为空，无法处理 AI 助手请求");
        }
    }

    private static String requireText(String value, String field, int maxLength) {
        String text = blankToNull(value);
        if (text == null) {
            throw new BusinessException(400, field + "为必填");
        }
        if (text.length() > maxLength) {
            throw new BusinessException(400, field + "不得超过 " + maxLength + " 字");
        }
        return text;
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
