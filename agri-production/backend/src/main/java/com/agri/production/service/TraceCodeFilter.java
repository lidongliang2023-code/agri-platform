package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.TraceCode;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * 溯源码列表的筛选条件（用户端与运营端**共用同一处**）。
 *
 * <p>为什么要在服务端做：两个列表页此前把关键字、批次号、生成日期、农场放在前端过滤，
 * 而请求只取一页（运营端 10 条、用户端 500 条上限）。结果是**筛选只作用于已经拿到的那几行** ——
 * 搜一个在第 3 页的码会筛出空列表，可分页器上的总数还是服务端没筛的数，看起来像"没这个码"。
 * 运营端代码里甚至留了句注释"前端侧补充关键字过滤（后端 /codes 仅支持 status 过滤）"，
 * 说明这是知道的取舍，不是疏忽。用户端的农场筛选更直接：比的是出参里根本没有的 {@code farmId}，
 * 条件永远不成立，等于这个下拉从来没生效过。</p>
 *
 * <p>链上状态与有效期两档用相关子查询与列判断，**不拼用户输入**：
 * 取值先过白名单，非法值直接 400 报可选项 —— 静默忽略会让用户以为筛过了。</p>
 *
 * <ul>
 *   <li>{@code chain=onChain}：存证表里有该码的 SUCCESS 记录（列表显示"已上链"）；</li>
 *   <li>{@code chain=unconfirmed}：有记录但没有一条 SUCCESS（列表显示"存证未出块/存证失败"）；</li>
 *   <li>{@code chain=none}：存证表里查不到这条码（列表显示"无存证记录"）；</li>
 *   <li>{@code expiry=expired|valid|unset}：按 {@code expiry_date} 与今天比；unset = 没设有效期，
 *       这类码不参与到期扫描，也不能被算成"已过期"。</li>
 * </ul>
 */
public final class TraceCodeFilter {

    /** 与列表列的三种显示一一对应，避免"筛出来的和看见的不一样" */
    private static final String CHAIN_ON = "onChain";
    private static final String CHAIN_UNCONFIRMED = "unconfirmed";
    private static final String CHAIN_NONE = "none";
    private static final String EXPIRY_EXPIRED = "expired";
    private static final String EXPIRY_VALID = "valid";
    private static final String EXPIRY_UNSET = "unset";

    /**
     * 这条码在存证表里有没有记录。相关到同一主体、同一码值 ——
     * 不带 tenant 条件的话，A 主体的存证会让 B 主体的同名码被算成"已上链"。
     */
    private static final String ANY_EVIDENCE = "SELECT 1 FROM agri_prod_chain_record r"
            + " WHERE r.del_flag = 0 AND UPPER(r.target_type) = 'TRACE'"
            + " AND r.tenant_id = agri_prod_trace_code.tenant_id"
            + " AND UPPER(r.target_code) = UPPER(agri_prod_trace_code.trace_code)";
    private static final String SUCCESS_EVIDENCE = ANY_EVIDENCE + " AND UPPER(r.chain_status) = 'SUCCESS'";

    private String status;
    private String keyword;
    private String farmId;
    private String chain;
    private String expiry;
    private LocalDate createdAtFrom;
    private LocalDate createdAtTo;

    private TraceCodeFilter() {
    }

    /**
     * 组装筛选条件；空串按"不筛这一项"处理，非法取值抛 400。
     *
     * @param status   码状态（generated/active/scanned/revoked/expired）
     * @param keyword  模糊匹配溯源码 / 批次号 / 产品名
     * @param farmId   农场主键
     * @param chain    onChain / unconfirmed / none
     * @param expiry   expired / valid / unset
     * @param from     生成日期起（yyyy-MM-dd）
     * @param to       生成日期止（yyyy-MM-dd）
     */
    public static TraceCodeFilter of(String status, String keyword, String farmId,
                                     String chain, String expiry, String from, String to) {
        TraceCodeFilter filter = new TraceCodeFilter();
        if (notBlank(status)) {
            filter.status = status.trim().toLowerCase();
        }
        if (notBlank(keyword)) {
            filter.keyword = keyword.trim();
        }
        if (notBlank(farmId)) {
            String value = farmId.trim();
            if (toLong(value) == null) {
                // 不静默忽略：非数字的农场 id 当"没筛"处理，用户看到的是"筛了但一条没少"
                throw new BusinessException(400, "农场筛选要传农场主键（数字），收到：" + value);
            }
            filter.farmId = value;
        }
        if (notBlank(chain)) {
            String value = chain.trim();
            if (!CHAIN_ON.equals(value) && !CHAIN_UNCONFIRMED.equals(value) && !CHAIN_NONE.equals(value)) {
                throw new BusinessException(400, "链上状态筛选只认 onChain（已上链）/ unconfirmed（有存证但未出块）/ "
                        + "none（无存证记录），收到：" + value);
            }
            filter.chain = value;
        }
        if (notBlank(expiry)) {
            String value = expiry.trim();
            if (!EXPIRY_EXPIRED.equals(value) && !EXPIRY_VALID.equals(value) && !EXPIRY_UNSET.equals(value)) {
                throw new BusinessException(400, "有效期筛选只认 expired（已过期）/ valid（有效期内）/ "
                        + "unset（未设置有效期），收到：" + value);
            }
            filter.expiry = value;
        }
        filter.createdAtFrom = parseDate(from, "生成日期起");
        filter.createdAtTo = parseDate(to, "生成日期止");
        return filter;
    }

    private static LocalDate parseDate(String value, String label) {
        if (!notBlank(value)) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessException(400, label + "格式不对，要用 yyyy-MM-dd（收到：" + value.trim() + "）");
        }
    }

    private static boolean notBlank(String value) {
        return value != null && !value.isBlank();
    }

    /** 把条件挂到查询上（租户条件由调用方自己加，这里不越权）。 */
    public void apply(LambdaQueryWrapper<TraceCode> wrapper) {
        if (status != null) {
            // 存量写法 inactive 视同 generated，与 TraceCodeContractVO 的归一口径一致；
            // 只按字面等值筛会把这批行漏掉，页面就显示"筛出来 0 条"而数据其实在。
            if ("generated".equals(status)) {
                wrapper.in(TraceCode::getStatus, "generated", "inactive");
            } else {
                wrapper.eq(TraceCode::getStatus, status);
            }
        }
        if (keyword != null) {
            String like = keyword;
            wrapper.and(q -> q.like(TraceCode::getTraceCode, like)
                    .or().like(TraceCode::getBatchNumber, like)
                    .or().like(TraceCode::getProductName, like));
        }
        if (farmId != null) {
            wrapper.eq(TraceCode::getFarmId, Long.valueOf(farmId));
        }
        if (chain != null) {
            switch (chain) {
                case CHAIN_ON -> wrapper.exists(SUCCESS_EVIDENCE);
                case CHAIN_UNCONFIRMED -> wrapper.exists(ANY_EVIDENCE).notExists(SUCCESS_EVIDENCE);
                default -> wrapper.notExists(ANY_EVIDENCE);
            }
        }
        if (expiry != null) {
            LocalDate today = LocalDate.now();
            switch (expiry) {
                case EXPIRY_EXPIRED -> wrapper.isNotNull(TraceCode::getExpiryDate).lt(TraceCode::getExpiryDate, today);
                case EXPIRY_VALID -> wrapper.isNotNull(TraceCode::getExpiryDate).ge(TraceCode::getExpiryDate, today);
                default -> wrapper.isNull(TraceCode::getExpiryDate);
            }
        }
        if (createdAtFrom != null) {
            wrapper.ge(TraceCode::getCreateTime, createdAtFrom.atStartOfDay());
        }
        if (createdAtTo != null) {
            wrapper.le(TraceCode::getCreateTime, createdAtTo.atTime(23, 59, 59));
        }
    }

    private static Long toLong(String value) {
        try {
            return Long.valueOf(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
