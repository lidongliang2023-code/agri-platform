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
 * 而且都已经在各自的页面里用着 —— 用户端读 {@code batchNumber} / {@code queryCount}，
 * 运营端读 {@code batchNo} / {@code scanCount}，运营端还要 {@code batchId}（召回时把它回传）
 * 与 {@code createdAt}。列名只有一套，出参名有两套是既成事实；
 * 与其把四个别名塞进用户端契约（对它的调用方毫无用处），不如让运营端这份新契约直接说它要的名字。</p>
 *
 * <p>映射关系（一一对应，不派生）：{@code trace_code→code}、{@code harvest_id→batchId}、
 * {@code batch_number→batchNo}、{@code query_count→scanCount}、{@code quality_grade→grade}、
 * {@code blockchain_tx_hash→txHash}、{@code create_time→createdAt}。</p>
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
    private String activateTime;
    private String firstQueryTime;
    private Boolean onChain;
    private String txHash;
    /** 激活操作人。表里**没有**这一列，恒为 null —— 不编一个"运营管理员"出来 */
    private String activatedBy;
    private String createdAt;
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
        vo.activateTime = format(entity.getActivateTime());
        vo.firstQueryTime = format(entity.getFirstQueryTime());
        vo.txHash = entity.getBlockchainTxHash();
        vo.onChain = entity.getBlockchainTxHash() != null && !entity.getBlockchainTxHash().isBlank();
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
