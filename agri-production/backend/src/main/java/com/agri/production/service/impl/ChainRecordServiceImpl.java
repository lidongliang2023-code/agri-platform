package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.ChainRecord;
import com.agri.production.entity.HarvestBatch;
import com.agri.production.entity.Inspection;
import com.agri.production.entity.InputUsageRecord;
import com.agri.production.entity.ProcessRecord;
import com.agri.production.entity.TraceCode;
import com.agri.production.mapper.ChainRecordMapper;
import com.agri.production.mapper.HarvestBatchMapper;
import com.agri.production.mapper.InspectionMapper;
import com.agri.production.mapper.InputUsageRecordMapper;
import com.agri.production.mapper.ProcessRecordMapper;
import com.agri.production.mapper.TraceCodeMapper;
import com.agri.production.service.ChainEvidenceRule;
import com.agri.production.service.IChainRecordService;
import com.agri.production.vo.ChainRecordContractVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

/**
 * 区块链存证（本部署为**模拟链**）。
 *
 * <p><b>业务类型词表只有这一处</b>（{@link #normalizeType}）：{@code HARVEST}（采收批次）、
 * {@code QUALITY}（质检单，平台侧旧词表叫 {@code INSPECTION}，在这里归一）、
 * {@code TRACE}（溯源码）、{@code INPUT}（投入品使用）、{@code PROCESS}（加工记录，2026-11-03 随
 * 「种植-采收-加工」链路补上）。
 * 历史上投入品页面按数字枚举传 {@code bizType=2}，控制器原样 {@code String.valueOf} 落库，
 * 于是 {@code target_type} 里出现 {@code '2'} 这种值 —— 它不属于任何词表，
 * 读侧按 HARVEST/QUALITY/TRACE/INPUT 对号时永远匹配不上，**那条存证等于没写过**，
 * 而存证列表页又能把它当一条"已上链"记录显示出来。现在数字一律拒绝，并给了迁移脚本
 * （{@code schema-patch-chain-type-normalize.sql}）把历史值归一。</p>
 *
 * <p><b>写之前先证明业务真的存在</b>（{@link #resolveTarget}）：按令牌主体在对应业务表里查这条记录，
 * 查不到就 404。存证的意义是"这个业务动作发生过、内容没被改"，能给一个不存在（或别人家）的
 * 单号出"已上链"，等于给假事实发凭证 —— 所以这里宁可拒绝。跨主体按"找不到"回，
 * 不说"存在但不是你的"（那是一个免费的探测接口）。</p>
 */
@Service
@Slf4j
public class ChainRecordServiceImpl implements IChainRecordService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_PENDING = "PENDING";
    /** 本部署的链类型：**模拟链**。写进记录，随出参一起给出，不只在文档里说。 */
    private static final String CHAIN_TYPE_SIMULATED = "SIMULATED";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    /** 可存证、且本部署能校验业务键的类型。 */
    private static final Set<String> ANCHORABLE_TYPES = Set.of("HARVEST", "QUALITY", "TRACE", "INPUT", "PROCESS");
    /** 前端旧表单里出现过、但本部署没有对应业务主数据的类型：明确拒绝，不接受自由填写的单号。 */
    private static final Set<String> UNVERIFIABLE_TYPES = Set.of("FARMING", "CIRCULATION", "IOT", "OTHER");
    private static final String TYPE_HINT = "HARVEST（采收批次）/ QUALITY（质检单，旧词表 INSPECTION 自动归一）/ "
            + "TRACE（溯源码）/ INPUT（投入品使用）/ PROCESS（加工记录）";

    private final ChainRecordMapper chainRecordMapper;
    private final HarvestBatchMapper batchMapper;
    private final InspectionMapper inspectionMapper;
    private final TraceCodeMapper traceCodeMapper;
    private final InputUsageRecordMapper inputUsageMapper;
    private final ProcessRecordMapper processMapper;

    public ChainRecordServiceImpl(ChainRecordMapper chainRecordMapper, HarvestBatchMapper batchMapper,
                                  InspectionMapper inspectionMapper, TraceCodeMapper traceCodeMapper,
                                  InputUsageRecordMapper inputUsageMapper, ProcessRecordMapper processMapper) {
        this.chainRecordMapper = chainRecordMapper;
        this.batchMapper = batchMapper;
        this.inspectionMapper = inspectionMapper;
        this.traceCodeMapper = traceCodeMapper;
        this.inputUsageMapper = inputUsageMapper;
        this.processMapper = processMapper;
    }

    /** 存证对象：归一后的类型 + 业务主键 + 业务编号（编号才是页面与链路对号用的键）。 */
    private record AnchorTarget(String type, Long id, String code) {
    }

    @Override
    public PageResult<ChainRecordContractVO> page(int pageNum, int pageSize, String status, String bizType,
                                                  String keyword, String tenantId) {
        LambdaQueryWrapper<ChainRecord> w = new LambdaQueryWrapper<>();
        w.eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0);
        if (status != null && !status.isBlank()) {
            w.eq(ChainRecord::getChainStatus, status.trim().toUpperCase());
        }
        if (bizType != null && !bizType.isBlank()) {
            w.eq(ChainRecord::getTargetType, normalizeType(bizType));
        }
        if (keyword != null && !keyword.isBlank()) {
            // 页面上那个「业务单号模糊匹配」输入框此前是**静默无效**的：接口根本没这个参数，
            // 传过去被忽略，用户以为筛了其实没筛。这里真的按业务键（target_code）与存证记录号
            // （record_no）做模糊匹配 —— 筛了不生效比不能筛更误导。
            String kw = keyword.trim();
            w.and(q -> q.like(ChainRecord::getTargetCode, kw).or().like(ChainRecord::getRecordNo, kw));
        }
        w.orderByDesc(ChainRecord::getCreateTime).orderByDesc(ChainRecord::getId);
        int p = pageNum > 0 ? pageNum : 1;
        int s = pageSize > 0 ? pageSize : 10;
        IPage<ChainRecord> r = chainRecordMapper.selectPage(new Page<>(p, s), w);
        List<ChainRecordContractVO> list = new ArrayList<>();
        for (ChainRecord c : r.getRecords()) {
            list.add(ChainRecordContractVO.of(c));
        }
        return PageResult.of(list, r.getTotal(), p, s);
    }

    @Override
    public ChainRecordContractVO detail(Long recordId, String tenantId) {
        ChainRecord record = chainRecordMapper.selectById(recordId);
        if (record == null || !tenantId.equals(record.getTenantId())) {
            throw new BusinessException(404, "存证记录不存在：" + recordId);
        }
        return ChainRecordContractVO.of(record);
    }

    @Override
    public List<ChainRecordContractVO> listByBiz(String bizType, String bizId, String tenantId) {
        if (bizId == null || bizId.isBlank()) {
            throw new BusinessException(400, "缺少 bizId / bizNo（业务键）");
        }
        LambdaQueryWrapper<ChainRecord> w = new LambdaQueryWrapper<>();
        w.eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0);
        if (bizType != null && !bizType.isBlank()) {
            w.eq(ChainRecord::getTargetType, normalizeType(bizType));
        }
        // bizId 在库里可能是 target_code（单号/码值）也可能是 target_id（数字主键），两边都认
        Long numeric = toLongOrNull(bizId);
        if (numeric != null) {
            w.and(q -> q.eq(ChainRecord::getTargetCode, bizId.trim()).or().eq(ChainRecord::getTargetId, numeric));
        } else {
            w.eq(ChainRecord::getTargetCode, bizId.trim());
        }
        w.orderByDesc(ChainRecord::getCreateTime);
        List<ChainRecordContractVO> list = new ArrayList<>();
        for (ChainRecord c : chainRecordMapper.selectList(w)) {
            list.add(ChainRecordContractVO.of(c));
        }
        return list;
    }

    /**
     * 业务类型词表归一（读写两侧唯一入口）。
     *
     * <p>三件事集中在这里做：</p>
     * <ol>
     *   <li>{@code INSPECTION → QUALITY}：平台侧（前端 api 契约、core-platform）把质检叫
     *       {@code INSPECTION}，而存证表记的是 {@code QUALITY}。不归一，前端按 INSPECTION 查
     *       质检存证会得到一个**空数组** —— 不报错、不提示，看起来就是"这批货没有存证"；
     *       筛了不生效比报错更难发现，所以映射只放这一处；</li>
     *   <li>数字枚举直接拒绝 —— 它是 {@code target_type='2'} 这类脏值的来源：写进去以后
     *       按业务类型对号永远匹配不上（那条存证等于没写过），可存证列表还会把它显示成一条"已上链"；</li>
     *   <li>{@code FARMING / CIRCULATION / IOT / OTHER} 本部署没有可校验的业务主数据入口，
     *       拒绝（否则等于允许对着一串自由填写的单号伪造链上凭证）。</li>
     * </ol>
     */
    private static String normalizeType(String rawType) {
        if (rawType == null || rawType.isBlank()) {
            throw new BusinessException(400, "缺少业务类型 bizType，可用值：" + TYPE_HINT);
        }
        String value = rawType.trim().toUpperCase();
        if ("INSPECTION".equals(value)) {
            return "QUALITY";
        }
        if (value.chars().allMatch(Character::isDigit)) {
            throw new BusinessException(400, "业务类型不再接受数字枚举（历史上 bizType=2 被原样写进 target_type，"
                    + "那条存证从此对不到任何业务）。请改用字符串：" + TYPE_HINT);
        }
        if (UNVERIFIABLE_TYPES.contains(value)) {
            throw new BusinessException(400, "业务类型 " + value + " 在本部署没有可校验的业务主数据，"
                    + "不能出存证（避免给不存在的业务伪造链上凭证）。可用值：" + TYPE_HINT);
        }
        if (!ANCHORABLE_TYPES.contains(value)) {
            throw new BusinessException(400, "不认识的业务类型 " + value + "。可用值：" + TYPE_HINT);
        }
        return value;
    }

    /**
     * 按业务键定位要存证的业务，顺带完成归属校验。
     *
     * <p>数字键认主键、非数字键认单号（批次号/质检单号/溯源码都不是纯数字，不会撞）。
     * 命中后返回的 {@code code} 是**规范业务编号**，落进 {@code target_code} ——
     * 全链路节点与核验视图都按编号对号，写侧把主键当编号存就会对不上。</p>
     *
     * <p>查不到一律 404「找不到要存证的业务」，跨主体也走这一句：说"存在但不是你的"
     * 就成了免费的探测接口。</p>
     */
    private AnchorTarget resolveTarget(String type, String rawKey, String tenantId) {
        String key = rawKey == null ? "" : rawKey.trim();
        if (key.isEmpty()) {
            throw new BusinessException(400, "缺少业务键（批次号 / 质检单号 / 溯源码 / 使用记录 ID）");
        }
        Long numeric = toLongOrNull(key);
        if ("HARVEST".equals(type)) {
            HarvestBatch batch = batchMapper.selectOne(new LambdaQueryWrapper<HarvestBatch>()
                    .eq(HarvestBatch::getTenantId, tenantId)
                    .eq(numeric == null, HarvestBatch::getBatchNo, key)
                    .eq(numeric != null, HarvestBatch::getBatchId, numeric)
                    .last("LIMIT 1"));
            if (batch == null) {
                throw notFound(type, key);
            }
            return new AnchorTarget(type, batch.getBatchId(), batch.getBatchNo());
        }
        if ("QUALITY".equals(type)) {
            Inspection inspection = inspectionMapper.selectOne(new LambdaQueryWrapper<Inspection>()
                    .eq(Inspection::getTenantId, tenantId)
                    .eq(numeric == null, Inspection::getInspectionNo, key)
                    .eq(numeric != null, Inspection::getInspectionId, numeric)
                    .last("LIMIT 1"));
            if (inspection == null) {
                throw notFound(type, key);
            }
            return new AnchorTarget(type, inspection.getInspectionId(), inspection.getInspectionNo());
        }
        if ("TRACE".equals(type)) {
            TraceCode code = traceCodeMapper.selectOne(new LambdaQueryWrapper<TraceCode>()
                    .eq(TraceCode::getTenantId, tenantId)
                    .eq(TraceCode::getTraceCode, key)
                    .last("LIMIT 1"));
            if (code == null) {
                throw notFound(type, key);
            }
            return new AnchorTarget(type, code.getId(), code.getTraceCode());
        }
        if ("PROCESS".equals(type)) {
            ProcessRecord record = processMapper.selectOne(new LambdaQueryWrapper<ProcessRecord>()
                    .eq(ProcessRecord::getTenantId, tenantId)
                    .eq(numeric == null, ProcessRecord::getProcessCode, key)
                    .eq(numeric != null, ProcessRecord::getId, numeric)
                    .last("LIMIT 1"));
            if (record == null) {
                throw notFound(type, key);
            }
            return new AnchorTarget(type, record.getId(), record.getProcessCode());
        }
        // INPUT：投入品使用记录只有数字主键，页面传的就是 usageId
        InputUsageRecord usage = numeric == null ? null
                : inputUsageMapper.selectOne(new LambdaQueryWrapper<InputUsageRecord>()
                .eq(InputUsageRecord::getTenantId, tenantId)
                .eq(InputUsageRecord::getUsageId, numeric)
                .last("LIMIT 1"));
        if (usage == null) {
            throw notFound(type, key);
        }
        return new AnchorTarget(type, usage.getUsageId(), String.valueOf(usage.getUsageId()));
    }

    private static BusinessException notFound(String type, String key) {
        return new BusinessException(404, "找不到要存证的业务：" + type + " " + key
                + "（只能给本经营主体名下、确实存在且未删除的记录出存证）");
    }

    @Override
    public Map<String, Object> overview(String tenantId) {
        List<ChainRecord> all = chainRecordMapper.selectList(new LambdaQueryWrapper<ChainRecord>()
                .eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0));
        long success = 0;
        long failed = 0;
        for (ChainRecord c : all) {
            if (STATUS_SUCCESS.equals(c.getChainStatus())) {
                success += 1;
            } else if ("FAILED".equals(c.getChainStatus())) {
                failed += 1;
            }
        }
        // 形状按**页面真正消费的**契约给：GET /blockchain/overview → {total, success, failed}
        // （见 BlockchainOverview.tsx：三张指标卡 + 「未成功 = total − success − failed」推导）。
        //
        // 早先这里返回的是 totalRecords / monthRecords / blockHeight / nodeCount / successRate / trend ——
        // 那几个字段名与页面读的**完全对不上**，切流当天页面三张卡全显示 0 条（库里明明有 3 条），
        // 而接口是 200、控制台无报错。没人消费的字段留着只会掩盖这类错位，故一并不再返回。
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", all.size());
        result.put("success", success);
        result.put("failed", failed);
        return result;
    }

    @Override
    public Map<String, ChainRecord> traceEvidence(Collection<String> codes, String tenantId) {
        List<String> keys = codes == null ? List.of() : codes.stream()
                .filter(code -> code != null && !code.isBlank())
                .map(code -> code.trim().toUpperCase())
                .distinct()
                .toList();
        if (keys.isEmpty()) {
            return Map.of();
        }
        List<ChainRecord> records = chainRecordMapper.selectList(new LambdaQueryWrapper<ChainRecord>()
                .eq(ChainRecord::getTenantId, tenantId)
                .eq(ChainRecord::getDelFlag, 0)
                .apply("UPPER(target_type) = 'TRACE'")
                .in(ChainRecord::getTargetCode, keys)
                .orderByAsc(ChainRecord::getId));
        Map<String, List<ChainRecord>> grouped = new LinkedHashMap<>();
        for (ChainRecord record : records) {
            String key = record.getTargetCode() == null ? "" : record.getTargetCode().trim().toUpperCase();
            grouped.computeIfAbsent(key, item -> new ArrayList<>()).add(record);
        }
        Map<String, ChainRecord> decided = new LinkedHashMap<>();
        grouped.forEach((key, list) -> {
            ChainRecord winner = ChainEvidenceRule.decide(list);
            if (winner != null) {
                decided.put(key, winner);
            }
        });
        return decided;
    }

    private static Long toLongOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /* ==================== 写路径（模拟链） ==================== */

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainRecordContractVO submit(String bizId, String bizType, String bizSummary, String tenantId) {
        AnchorTarget target = resolveTarget(normalizeType(bizType), bizId, tenantId);
        ChainRecord record = newRecord(tenantId, target, bizSummary);
        simulateChain(record);
        insertWithUniqueRecordNo(record);
        return ChainRecordContractVO.of(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainRecordContractVO anchor(String bizType, String bizNo, String traceCode, String bizSummary,
                                       String payloadHash, String tenantId) {
        String key = traceCode != null && !traceCode.isBlank() ? traceCode : bizNo;
        if (key == null || key.isBlank()) {
            throw new BusinessException(400, "traceCode 与 bizNo 至少给一个（存证要有业务键）");
        }
        AnchorTarget target = resolveTarget(normalizeType(bizType), key, tenantId);
        ChainRecord record = newRecord(tenantId, target, bizSummary);
        if (payloadHash != null && !payloadHash.isBlank()) {
            record.setDataHash(payloadHash.trim());
        }
        simulateChain(record);
        insertWithUniqueRecordNo(record);
        return ChainRecordContractVO.of(record);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ChainRecordContractVO retry(Long recordId, String tenantId) {
        ChainRecord record = chainRecordMapper.selectById(recordId);
        if (record == null || !tenantId.equals(record.getTenantId())) {
            throw new BusinessException(404, "存证记录不存在：" + recordId);
        }
        if (STATUS_SUCCESS.equals(record.getChainStatus())) {
            // 已成功的重试没有意义；明确拒绝，而不是"再成功一次"糊过去
            throw new BusinessException(400, "该存证已上链成功，无需重试");
        }
        record.setRetryCount((record.getRetryCount() == null ? 0 : record.getRetryCount()) + 1);
        simulateChain(record);
        record.setUpdateTime(new java.util.Date());
        chainRecordMapper.updateById(record);
        return ChainRecordContractVO.of(record);
    }

    @Override
    public boolean verify(String txHash, String certNo, String tenantId) {
        LambdaQueryWrapper<ChainRecord> w = new LambdaQueryWrapper<>();
        w.eq(ChainRecord::getTenantId, tenantId).eq(ChainRecord::getDelFlag, 0)
                .eq(ChainRecord::getChainStatus, STATUS_SUCCESS);
        if (txHash != null && !txHash.isBlank()) {
            w.eq(ChainRecord::getTxHash, txHash.trim());
        } else if (certNo != null && !certNo.isBlank()) {
            w.eq(ChainRecord::getTargetCode, certNo.trim());
        } else {
            throw new BusinessException(400, "txHash 与 certNo 至少给一个");
        }
        // 模拟链语义：这只是"本库里有一条 SUCCESS 的同键记录"，**不是**链上完整性校验
        Long hit = chainRecordMapper.selectCount(w);
        return hit != null && hit > 0;
    }

    /**
     * 组一条待上链的记录（统一入口，避免四条写路径各写一遍字段）。
     *
     * <p>{@code target_type} 只可能是归一后的四个值之一；{@code target_id} 与 {@code target_code}
     * 一起写 —— 全链路节点用主键对号、页面用编号对号，两条路都要能对上。</p>
     */
    private ChainRecord newRecord(String tenantId, AnchorTarget target, String bizSummary) {
        ChainRecord record = new ChainRecord();
        record.setTenantId(tenantId);
        record.setTargetType(target.type());
        record.setTargetId(target.id());
        record.setTargetCode(target.code());
        record.setChainType(CHAIN_TYPE_SIMULATED);
        record.setDataHash(sha256(target.type() + "|" + target.code() + "|" + (bizSummary == null ? "" : bizSummary)));
        record.setChainStatus(STATUS_PENDING);
        record.setRetryCount(0);
        record.setDelFlag(0);
        record.setCreateBy(null);
        record.setCreateTime(new java.util.Date());
        record.setUpdateTime(new java.util.Date());
        record.setRecordNo(newRecordNo());
        return record;
    }

    /** 人读存证编号：CHAIN-{日期}-{4 位随机}。唯一性由 {@link #insertWithUniqueRecordNo} 兜底。 */
    private static String newRecordNo() {
        return "CHAIN-" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd"))
                + "-" + String.format("%04d", ThreadLocalRandom.current().nextInt(10000));
    }

    /**
     * 入库并保证 {@code record_no} 不撞唯一键。
     *
     * <p>为什么要这一步：{@code record_no} 是唯一键，而它的人读后缀是 4 位随机数 —— 同一天
     * 累积到一定条数后**真的会撞**（生日问题），撞了就是 DuplicateKeyException → 用户看到 500，
     * 而且是在"提交存证"这种最不该失败的动作上。撞了就换一个后缀重插，最多试 5 次；
     * 5 次全撞说明不是随机问题（例如唯一键上还有别的约束），这时才如实报错。</p>
     */
    private void insertWithUniqueRecordNo(ChainRecord record) {
        for (int attempt = 0; attempt < 5; attempt++) {
            try {
                chainRecordMapper.insert(record);
                return;
            } catch (DuplicateKeyException e) {
                record.setId(null);
                record.setRecordNo(newRecordNo());
                log.warn("存证编号冲突，换号重试（第 {} 次）：{}", attempt + 1, record.getRecordNo());
            }
        }
        throw new BusinessException(409, "存证编号生成冲突，请重试");
    }

    /**
     * "上链"（**模拟**）。
     *
     * <p>本部署没有真链：这里生成一个带 SIMU 前缀的假交易哈希与自增块高，
     * 并把 chain_type 标为 SIMULATED。之所以不假装成真交易哈希，是为了让任何拿到这条记录的人
     * （页面、下游、审计）都能一眼认出这是模拟产生的 —— 真链接入时换掉这一个方法即可。</p>
     */
    private void simulateChain(ChainRecord record) {
        record.setTxHash("SIMU" + Long.toHexString(System.nanoTime()).toUpperCase()
                + Integer.toHexString(ThreadLocalRandom.current().nextInt(0xFFFF)).toUpperCase());
        record.setBlockNumber(nextBlockNumber());
        record.setChainStatus(STATUS_SUCCESS);
        record.setChainTime(new java.util.Date());
        record.setFailedReason(null);
    }

    /** 模拟块高：取当前最大值 +1（单调递增，符合"区块高度"的直觉，也不编一个固定值）。 */
    private long nextBlockNumber() {
        ChainRecord latest = chainRecordMapper.selectOne(new LambdaQueryWrapper<ChainRecord>()
                .isNotNull(ChainRecord::getBlockNumber)
                .orderByDesc(ChainRecord::getBlockNumber).last("LIMIT 1"));
        return latest == null || latest.getBlockNumber() == null ? 1000L : latest.getBlockNumber() + 1;
    }

    private static String sha256(String text) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(text.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : bytes) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 不可用", e);
        }
    }
}
