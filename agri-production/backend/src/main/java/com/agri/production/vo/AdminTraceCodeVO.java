package com.agri.production.vo;

import com.agri.production.entity.TraceCode;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * 运营端溯源码出参（前端 {@code RawTraceCode}，见 api/admin/trace.ts）。
 *
 * <p><b>为什么不复用用户端的 {@link TraceCodeContractVO}</b>：两个界面读的是**两套字段名**，
 * 而且都已经在各自的页面里用着 —— 用户端读 {@code queryCount}，运营端读 {@code scanCount} /
 * {@code createdAt}（批次键两边现在都叫 {@code batchNo} + {@code batchId}：
 * 用户端那份以前叫 {@code batchNumber}，页面按 {@code batchNo} 取，结果「批次号」列与
 * 「全链路→」跳转一起哑掉，2026-11-02 把名字对齐消费方）。列名只有一套，出参名有两套是既成事实；
 * 与其把别名塞进另一份契约（对它的调用方毫无用处），不如让每份契约直接说它调用方要的名字。</p>
 *
 * <p>映射关系（一一对应，不派生）：{@code trace_code→code}、{@code harvest_id→batchId}、
 * {@code batch_number→batchNo}、{@code query_count→scanCount}、{@code quality_grade→grade}、
 * {@code expiry_date→expireDate}、{@code create_time→createdAt}。
 * 链上字段（{@code attested/onChain/chainStatus/txHash/recordNo}）**不来自本表**，
 * 由服务层查存证表后调 {@link #applyEvidence} 贴上来。</p>
 */
@Data
public class AdminTraceCodeVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private String code;
    private Long id;
    /** generated / active / scanned / revoked（库里的 inactive 归一成 generated） */
    private String status;
    /** 关联采收批次主键的字符串形式 —— 页面召回时原样回传给 /admin/trace/recall */
    private String batchId;
    /** 关联批次号（= 采收批次的 batch_no，关联的**权威**键） */
    private String batchNo;
    /** 扫码次数（= query_count） */
    private Integer scanCount;
    private String productName;
    private String cropName;
    private String grade;
    private String farmName;
    private String plotName;
    private LocalDate harvestDate;
    /** 有效期至（表列 expiry_date；为空 = 未设置有效期） */
    private LocalDate expireDate;
    private String activateTime;
    private String firstQueryTime;
    /** 有没有链上存证记录（false = 存证表里没有这条码的记录） */
    private Boolean attested;
    /**
     * 是否已上链 —— 由存证表判定（{@link #applyEvidence}），不再读
     * {@code blockchain_tx_hash} 那个没人写的死列（那样会把有真实存证的码说成未上链）。
     */
    private Boolean onChain;
    /** 存证状态：PENDING / SUCCESS / FAILED */
    private String chainStatus;
    /** 上链交易哈希（SUCCESS 才有） */
    private String txHash;
    /** 人读存证编号 */
    private String recordNo;
    /** 激活操作人。表里**没有**这一列，恒为 null —— 不编一个"运营管理员"出来 */
    private String activatedBy;
    private String createdAt;

    /** 贴链上凭证（服务层批量查存证表后调用）；{@code evidence} 为 null = 该码无存证记录。 */
    public void applyEvidence(com.agri.production.entity.ChainRecord evidence) {
        this.attested = evidence != null;
        this.onChain = com.agri.production.service.ChainEvidenceRule.onChain(evidence);
        this.chainStatus = evidence == null ? null : evidence.getChainStatus();
        this.txHash = evidence == null ? null : evidence.getTxHash();
        this.recordNo = evidence == null ? null : evidence.getRecordNo();
    }
    private String updatedAt;

    public static AdminTraceCodeVO of(TraceCode entity) {
        if (entity == null) {
            return null;
        }
        AdminTraceCodeVO vo = new AdminTraceCodeVO();
        vo.code = entity.getTraceCode();
        vo.id = entity.getId();
        vo.status = normalizeStatus(entity.getStatus());
        vo.batchId = entity.getHarvestId() == null ? null : String.valueOf(entity.getHarvestId());
        vo.batchNo = entity.getBatchNumber();
        vo.scanCount = entity.getQueryCount() == null ? 0 : entity.getQueryCount();
        vo.productName = entity.getProductName();
        vo.cropName = entity.getCropName();
        vo.grade = entity.getQualityGrade();
        vo.farmName = entity.getFarmName();
        vo.plotName = entity.getPlotCode();
        vo.harvestDate = entity.getHarvestDate();
        vo.expireDate = entity.getExpiryDate();
        vo.activateTime = format(entity.getActivateTime());
        vo.firstQueryTime = format(entity.getFirstQueryTime());
        // 链上字段留给 applyEvidence：blockchain_tx_hash 是没人写的死列，
        // 拿它判 onChain 会把有真实 SUCCESS 存证的码显示成"未上链"。
        vo.activatedBy = null;
        vo.createdAt = format(entity.getCreateTime());
        vo.updatedAt = format(entity.getUpdateTime());
        return vo;
    }

    /** 与用户端 TraceLifecycleServiceImpl#normalize 同一份口径：inactive 视同 generated */
    public static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "generated";
        }
        String value = status.trim().toLowerCase();
        return "inactive".equals(value) ? "generated" : value;
    }

    private static String format(LocalDateTime value) {
        return value == null ? null : DATE_TIME.format(value);
    }
}
