package com.agri.production.vo;

import com.agri.production.entity.ChainRecord;
import lombok.Data;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;

/**
 * 存证出参（前端契约 {@code BlockchainBizRecord}，见 packages/agri-shared/src/types/blockchain.ts）。
 *
 * <p><b>为什么有同名双份字段（bizId/bizNo、dataHash/payloadHash、submittedAt/createdAt…）</b>：
 * 这不是设计，是**迁移中的兼容窗口**。同一个值在两边有两套叫法 ——
 * 前端页面按平台侧旧形状（{@code bizNo} / {@code payloadHash} / {@code anchorAt} / {@code createdAt}）
 * 取值，而本服务的实体列名对应 {@code bizId} / {@code dataHash} / {@code chainedAt} / {@code submittedAt}。
 * 2026-10-15 把存证段切到本服务后，页面立刻出现"业务单号整列显示 -、概览显示 0 条"——
 * 接口 200、页面不报错、数字却是错的，正是最难发现的一类。所以这里**两个名字都给**，
 * 让页面先正常工作。退出条件写死在这里：**页面统一到 {@code bizNo} 一套名字后，删掉 bizId 那一列**，
 * 两套词表长期并存比任何一套单独存在都更容易出事。</p>
 *
 * <p>三处映射说明（都不猜，按语义对应）：</p>
 * <ul>
 *   <li>{@code bizId} / {@code bizNo} 取 {@code targetCode}（业务单号/码值），没有时退回 target_id
 *       的字符串形式；</li>
 *   <li>{@code bizType} **原样透出** {@code targetType}（HARVEST/QUALITY/TRACE）。契约里另有一版把
 *       bizType 写成 1..5 的数字枚举，字典在库里没有来源，所以不映射（页面读的是字符串那一版）；</li>
 *   <li>{@code batchId} / {@code traceCode} **刻意留空**：本服务没有单独存这两个键。
 *       业务单号列已经把批次号/溯源码显示出来了，再从 target_code 复制一份到 batchId
 *       会让人以为库里真的分列存了（下一步若确需分列，那是加列的事，不是在这里派生）。</li>
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
    /** 链类型：本部署为 **SIMULATED（模拟链）** —— 这个事实必须随出参一起给出，不能只写在文档里 */
    private String chainType;
    /** 业务键（业务单号/码值）。迁移窗口内的两个名字，值相同；见类注释 */
    private String bizId;
    private String bizNo;
    private String bizType;
    private String bizSummary;
    /** 业务键的哈希。同样两个名字（payloadHash 是页面在用的一侧） */
    private String dataHash;
    private String payloadHash;
    private String txHash;
    private Long blockHeight;
    /** PENDING 待上链 / SUCCESS 已上链 / FAILED 失败 */
    private String status;
    private String failReason;
    private Integer retryCount;
    /** 提交时间（= 记录创建时间）。两个名字，值相同 */
    private String submittedAt;
    private String createdAt;
    /** 上链完成时间（= 出块时间）。两个名字，值相同 */
    private String chainedAt;
    private String anchorAt;
    private String updatedAt;
    /** 本服务未单独存这两列，恒为 null（见类注释第 3 条） */
    private String batchId;
    private String traceCode;

    public static ChainRecordContractVO of(ChainRecord entity) {
        if (entity == null) {
            return null;
        }
        ChainRecordContractVO vo = new ChainRecordContractVO();
        vo.recordId = entity.getId();
        vo.recordNo = entity.getRecordNo();
        vo.chainType = entity.getChainType();
        String bizKey = entity.getTargetCode() != null ? entity.getTargetCode()
                : (entity.getTargetId() == null ? null : String.valueOf(entity.getTargetId()));
        vo.bizId = bizKey;
        vo.bizNo = bizKey;
        vo.bizType = entity.getTargetType();
        vo.bizSummary = entity.getTargetType() == null ? null
                : entity.getTargetType() + " " + (entity.getTargetCode() == null ? "" : entity.getTargetCode());
        vo.dataHash = entity.getDataHash();
        vo.payloadHash = entity.getDataHash();
        vo.txHash = entity.getTxHash();
        vo.blockHeight = entity.getBlockNumber();
        vo.status = entity.getChainStatus();
        vo.failReason = entity.getFailedReason();
        vo.retryCount = entity.getRetryCount();
        vo.submittedAt = format(entity.getCreateTime());
        vo.createdAt = vo.submittedAt;
        vo.chainedAt = format(entity.getChainTime());
        vo.anchorAt = vo.chainedAt;
        vo.updatedAt = format(entity.getUpdateTime());
        return vo;
    }

    private static String format(Date value) {
        if (value == null) {
            return null;
        }
        return DATE_TIME.format(value.toInstant().atZone(ZoneId.systemDefault()).toLocalDateTime());
    }
}
