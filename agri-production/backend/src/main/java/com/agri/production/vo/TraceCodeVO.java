package com.agri.production.vo;

import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
/**
 * 溯源码出参（运营端 /admin/trace/codes 一类接口用）。
 *
 * <p>原先这里还有一个 {@code List<TraceRecordVO> traceRecords} —— 已删除（2026-10-15）。
 * 原因：它只由旧实现 {@code TraceCodeServiceImpl#buildTraceCodeVO} 填充，而那个 service
 * 已被 {@code TraceLifecycleServiceImpl} 取代、且**没有任何控制器引用**；本轮连同它依赖的
 * {@code agri_prod_trace_record}（表根本不存在）一起清理掉了。
 * 留着一个永远为 null 的字段，调用方会以为"链路明细没查到"，而事实是本服务不再有这个概念 ——
 * 全链路明细现在由 {@code /trace/full-chain/**} 按派生聚合给出。</p>
 */
@Data
public class TraceCodeVO {

    private Long id;

    private String traceCode;

    private Long harvestId;

    private String harvestCode;

    private String batchNumber;

    private String productName;

    private String productCode;

    private Long farmId;

    private String farmCode;

    private String farmName;

    private Long plotId;

    private String plotCode;

    private String cropName;

    private String qualityGrade;

    private LocalDate harvestDate;

    private String status;

    private LocalDateTime activateTime;

    private LocalDateTime firstQueryTime;

    private Integer queryCount;

    private String blockchainTxHash;

    private Long blockchainBlockHeight;

    private String remark;

    private String tenantId;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
