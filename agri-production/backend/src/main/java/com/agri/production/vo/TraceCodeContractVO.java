package com.agri.production.vo;

import com.agri.production.entity.TraceCode;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;

/**
 * 溯源码出参（前端契约 {@code @agri/shared/types/trace} 的 {@code RawTraceCode}）。
 *
 * <p>两处必须转换：</p>
 * <ol>
 *   <li><b>状态词表</b>：契约只认 {@code generated / activated / scanned / expired / active / revoked}，
 *       而库里存量取值还带着早期写法 {@code inactive} —— 直接透出去页面会显示成英文原文（或空白）。
 *       这里统一归一化：{@code inactive → generated}。</li>
 *   <li><b>时间格式</b>：实体用 {@code Date}，Jackson 默认出毫秒数，而前端按字符串取前 10 位 ——
 *       这里直接给 {@code yyyy-MM-dd HH:mm:ss}。</li>
 * </ol>
 *
 * <p>{@code plotName} / {@code activatedBy} / {@code expireDate} 在表上没有对应列，
 * 一律给 null（页面显示"—"），**不造**。</p>
 */
@Data
public class TraceCodeContractVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 溯源码本身（契约字段名 code） */
    private String code;
    private Long id;
    private String status;
    private String batchNumber;
    private String productName;
    private String farmName;
    private String plotName;
    private String cropName;
    private String grade;
    private LocalDate harvestDate;
    private String activateTime;
    private String firstQueryTime;
    private Integer queryCount;
    /** 是否已上链（有交易哈希即视为已上链；没有哈希时**不猜**） */
    private Boolean onChain;
    private String txHash;
    private String activatedBy;
    private String updatedAt;

    public static TraceCodeContractVO of(TraceCode entity) {
        if (entity == null) {
            return null;
        }
        TraceCodeContractVO vo = new TraceCodeContractVO();
        vo.code = entity.getTraceCode();
        vo.id = entity.getId();
        vo.status = normalizeStatus(entity.getStatus());
        vo.batchNumber = entity.getBatchNumber();
        vo.productName = entity.getProductName();
        vo.farmName = entity.getFarmName();
        vo.cropName = entity.getCropName();
        vo.grade = entity.getQualityGrade();
        vo.harvestDate = entity.getHarvestDate();
        vo.activateTime = format(entity.getActivateTime());
        vo.firstQueryTime = format(entity.getFirstQueryTime());
        vo.queryCount = entity.getQueryCount() == null ? 0 : entity.getQueryCount();
        vo.txHash = entity.getBlockchainTxHash();
        vo.onChain = entity.getBlockchainTxHash() != null && !entity.getBlockchainTxHash().isBlank();
        vo.updatedAt = format(entity.getUpdateTime());
        return vo;
    }

    /** 存量 {@code inactive} 归一化为契约里的 {@code generated}；其余原样（不认识的值不猜，返回原值）。 */
    private static String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return "generated";
        }
        String value = status.trim().toLowerCase();
        return "inactive".equals(value) ? "generated" : value;
    }

    private static String format(Date value) {
        if (value == null) {
            return null;
        }
        return DATE_TIME.format(value.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime());
    }

    private static String format(LocalDateTime value) {
        return value == null ? null : DATE_TIME.format(value);
    }
}
