package com.agri.production.vo;

import com.agri.production.entity.ChainRecord;
import lombok.Data;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;

/**
 * 存证出参（前端契约 {@code BlockchainRecord}）。
 *
 * <p>两处需要说明的映射（都不猜，按语义对应）：</p>
 * <ul>
 *   <li>{@code bizId} 取本实体的 {@code targetCode}（业务单号/码值），没有时退回 target_id
 *       的字符串形式 —— 契约里 bizId 就是"这笔存证对应哪个业务"；</li>
 *   <li>{@code bizType} **原样透出** {@code targetType}（如 HARVEST/QUALITY/TRACE）。
 *       契约里另有一版把 bizType 写成 1..5 的数字枚举，而本实体存的是字符串词表 ——
 *       强行映射需要一张字典，而字典在库里没有来源，所以不做（页面读的是字符串那一版）。</li>
 * </ul>
 *
 * <p>时间一律格式化成 {@code yyyy-MM-dd HH:mm:ss}：实体是 Date，Jackson 默认出毫秒数，
 * 而前端按字符串取前 10 位。</p>
 */
@Data
public class ChainRecordContractVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private Long recordId;
    private String recordNo;
    private String bizId;
    private String bizType;
    private String bizSummary;
    private String dataHash;
    private String txHash;
    private Long blockHeight;
    /** PENDING 待上链 / SUCCESS 已上链 / FAILED 失败 */
    private String status;
    private String failReason;
    private Integer retryCount;
    private String submittedAt;
    private String chainedAt;

    public static ChainRecordContractVO of(ChainRecord entity) {
        if (entity == null) {
            return null;
        }
        ChainRecordContractVO vo = new ChainRecordContractVO();
        vo.recordId = entity.getId();
        vo.recordNo = entity.getRecordNo();
        vo.bizId = entity.getTargetCode() != null ? entity.getTargetCode()
                : (entity.getTargetId() == null ? null : String.valueOf(entity.getTargetId()));
        vo.bizType = entity.getTargetType();
        vo.bizSummary = entity.getTargetType() == null ? null
                : entity.getTargetType() + " " + (entity.getTargetCode() == null ? "" : entity.getTargetCode());
        vo.dataHash = entity.getDataHash();
        vo.txHash = entity.getTxHash();
        vo.blockHeight = entity.getBlockNumber();
        vo.status = entity.getChainStatus();
        vo.failReason = entity.getFailedReason();
        vo.retryCount = entity.getRetryCount();
        vo.submittedAt = format(entity.getCreateTime());
        vo.chainedAt = format(entity.getChainTime());
        return vo;
    }

    private static String format(Date value) {
        if (value == null) {
            return null;
        }
        return DATE_TIME.format(value.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime());
    }
}
