package com.agri.production.service.impl;

import com.agri.production.common.entity.PageResult;
import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.ChainRecord;
import com.agri.production.mapper.ChainRecordMapper;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

@Service
@Slf4j
public class ChainRecordServiceImpl implements IChainRecordService {

    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_PENDING = "PENDING";
    /** 本部署的链类型：**模拟链**。写进记录，随出参一起给出，不只在文档里说。 */
    private static final String CHAIN_TYPE_SIMULATED = "SIMULATED";
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private final ChainRecordMapper chainRecordMapper;

    public ChainRecordServiceImpl(ChainRecordMapper chainRecordMapper) {
        this.chainRecordMapper = chainRecordMapper;
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
            w.eq(ChainRecord::getTargetType, normalizeBizType(bizType));
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
            w.eq(ChainRecord::getTargetType, normalizeBizType(bizType));
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
     * 业务类型词表归一。
     *
     * <p>同一件事在两套词表里叫法不同：平台侧（前端 api 契约、core-platform）把质检叫
     * {@code INSPECTION}，而本服务的存证表把质检记成 {@code QUALITY}（演示数据与写路径都是这个值）。
     * 不归一的话，前端按 {@code INSPECTION} 查质检存证会得到一个**空数组** ——
     * 不报错、不提示，看起来就是"这批货没有存证"。筛了不生效比报错更难发现，所以在这里映射。</p>
     */
    private static String normalizeBizType(String bizType) {
        String value = bizType.trim().toUpperCase();
        return "INSPECTION".equals(value) ? "QUALITY" : value;
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
    public ChainRecordContractVO submit(String bizId, Integer bizType, String bizSummary, String tenantId) {
        if (bizId == null || bizId.isBlank()) {
            throw new BusinessException(400, "bizId 不能为空");
        }
        if (bizType == null) {
            throw new BusinessException(400, "bizType 不能为空");
        }
        ChainRecord record = newRecord(tenantId, String.valueOf(bizType), bizId, bizSummary);
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
        ChainRecord record = newRecord(tenantId, bizType, key, bizSummary);
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

    /** 组一条待上链的记录（统一入口，避免四条写路径各写一遍字段）。 */
    private ChainRecord newRecord(String tenantId, String bizType, String bizKey, String bizSummary) {
        ChainRecord record = new ChainRecord();
        record.setTenantId(tenantId);
        record.setTargetType(bizType == null || bizType.isBlank() ? "OTHER" : bizType.trim().toUpperCase());
        record.setTargetCode(bizKey);
        record.setChainType(CHAIN_TYPE_SIMULATED);
        record.setDataHash(sha256(record.getTargetType() + "|" + bizKey + "|" + (bizSummary == null ? "" : bizSummary)));
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
