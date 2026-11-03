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
 * <p>{@code plotName} 取表列 {@code plot_code}（生成时写入的是批次上的地块名，见
 * {@code TraceLifecycleServiceImpl#generate}）；{@code activatedBy} 在表上没有对应列，给 null（页面显示"—"），**不造**。
 * {@code expireDate} 有列（{@code expiry_date}）：2026-11-02 起生成接口真的写它、这里真的回显它。</p>
 *
 * <p>链上字段（{@code attested/onChain/chainStatus/txHash/recordNo}）不来自本表，
 * 由服务层查存证表后调 {@link #applyEvidence} 贴上来 —— 见该方法注释里说到的历史错误口径。</p>
 */
@Data
public class TraceCodeContractVO {

    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    /** 溯源码本身（契约字段名 code） */
    private String code;
    private Long id;
    private String status;
    /**
     * 批次号（列 {@code batch_number}）。
     *
     * <p>契约与运营端都叫 {@code batchNo}，这一版此前叫 {@code batchNumber} —— 页面读的是
     * {@code batchNo}，于是「批次号」列永远是 "-"。名字跟着消费方走，不再另起一个。</p>
     */
    private String batchNo;
    /** 关联采收批次主键（列 {@code harvest_id}）；行内「全链路→」跳的就是它，没给就永远显示"未关联批次" */
    private String batchId;
    private String productName;
    private String farmName;
    /** 农场主键（列 {@code farm_id}）；运营/用户端列表的农场筛选以前比的是这个键，但出参没给，条件永远不成立 */
    private Long farmId;
    private String plotName;
    private String cropName;
    private String grade;
    private LocalDate harvestDate;
    /** 有效期至（表列 {@code expiry_date}；为空 = 未设置有效期，不参与到期扫描） */
    private LocalDate expireDate;
    private String activateTime;
    private String firstQueryTime;
    private Integer queryCount;
    /** 有没有链上存证记录（false = 查过存证表、这条码没有记录；不是"能力未接入"） */
    private Boolean attested;
    /**
     * 是否已上链 —— 由存证表 {@code agri_prod_chain_record} 判定（见 {@link #applyEvidence}）。
     *
     * <p>此前这里是 {@code blockchain_tx_hash != null}：那个列没有任何写路径维护，永远为空，
     * 所以**有真实 SUCCESS 存证的码也被说成未上链**。现在与全链路节点、公开核验同一处规则
     * （{@code ChainEvidenceRule}）。</p>
     */
    private Boolean onChain;
    /** 存证状态原值：PENDING / SUCCESS / FAILED（无记录时 null） */
    private String chainStatus;
    /** 上链交易哈希（只有 SUCCESS 的记录才有） */
    private String txHash;
    /** 人读存证编号 */
    private String recordNo;
    private String activatedBy;
    /**
     * 生成时间（列 {@code create_time}）。
     *
     * <p>页面「生成时间」列与导出这一列读的都是 {@code createdAt}，而出参以前只给
     * {@code updatedAt} —— 于是整列永远是 "-"，看起来像"没记录生成时间"。
     * 名字跟着消费方走，与运营端契约同一个键。</p>
     */
    private String createdAt;
    private String updatedAt;

    /**
     * 贴链上凭证。{@code evidence} 为 null 表示这条码在存证表里没有记录。
     *
     * <p>由服务层批量查出来后调用（一次 IN 查询覆盖整页，不做 N+1）。</p>
     */
    public void applyEvidence(com.agri.production.entity.ChainRecord evidence) {
        this.attested = evidence != null;
        this.onChain = com.agri.production.service.ChainEvidenceRule.onChain(evidence);
        this.chainStatus = evidence == null ? null : evidence.getChainStatus();
        this.txHash = evidence == null ? null : evidence.getTxHash();
        this.recordNo = evidence == null ? null : evidence.getRecordNo();
    }

    public static TraceCodeContractVO of(TraceCode entity) {
        if (entity == null) {
            return null;
        }
        TraceCodeContractVO vo = new TraceCodeContractVO();
        vo.code = entity.getTraceCode();
        vo.id = entity.getId();
        vo.status = normalizeStatus(entity.getStatus());
        vo.batchNo = entity.getBatchNumber();
        vo.batchId = entity.getHarvestId() == null ? null : String.valueOf(entity.getHarvestId());
        vo.productName = entity.getProductName();
        vo.farmName = entity.getFarmName();
        vo.farmId = entity.getFarmId();
        // 地块：表里只有 plot_code（没有 plot_name 列），而 generate() 写进去的就是批次上的地块名，
        // 运营端 VO 同一处映射。这里以前不给值，页面的「农场/地块」列与导出一律是 "-"，看起来像"没关联地块"。
        vo.plotName = entity.getPlotCode();
        vo.cropName = entity.getCropName();
        vo.grade = entity.getQualityGrade();
        vo.harvestDate = entity.getHarvestDate();
        vo.expireDate = entity.getExpiryDate();
        vo.activateTime = format(entity.getActivateTime());
        vo.firstQueryTime = format(entity.getFirstQueryTime());
        vo.queryCount = entity.getQueryCount() == null ? 0 : entity.getQueryCount();
        // 链上字段一律留给 applyEvidence（不读 blockchain_tx_hash 那个没人写的死列）
        vo.createdAt = format(entity.getCreateTime());
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
