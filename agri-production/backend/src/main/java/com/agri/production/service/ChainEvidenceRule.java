package com.agri.production.service;

import com.agri.production.entity.ChainRecord;

import java.util.List;

/**
 * "这条业务到底算不算已上链"的唯一判定规则。
 *
 * <p>为什么要有这一个文件：同一个事实此前有三套算法 ——
 * 全链路节点用"取 id 最小的那条记录"，属主列表用"溯源码表上那个从来没人写的
 * {@code blockchain_tx_hash} 死列"（于是永远 false），运营端列表又是另一份同样的死逻辑。
 * 三份代码不会互相报错，只会对同一个码给出不同结论，而页面各自都显得有据可依。</p>
 *
 * <p>规则（一条业务键可能有多条存证记录，例如反复提交存证）：</p>
 * <ol>
 *   <li>只要有一条 {@code SUCCESS}，就取<b>最早那条 SUCCESS</b> 作为结论 —— 已经出过块就是已上链，
 *       后面再失败也不把既成事实抹掉；</li>
 *   <li>没有 SUCCESS 时取<b>最新一条</b>（id 最大）—— 未出块/失败以最近一次提交为准，
 *       这样 {@code PENDING}、{@code FAILED} 与失败原因说的是"当前状态"，不是历史第一次的残留。</li>
 * </ol>
 *
 * <p>入参列表按 id 升序传入（调用方统一 {@code ORDER BY id ASC}），本类不重新排序。</p>
 */
public final class ChainEvidenceRule {

    /** 上链成功状态值（存证表 {@code chain_status}）。 */
    public static final String SUCCESS = "SUCCESS";

    private ChainEvidenceRule() {
    }

    /**
     * @param recordsForSameKey 同一业务键的存证记录，按 id 升序；可为空
     * @return 决定结论的那条记录；一条都没有时返回 {@code null}（= 无存证记录）
     */
    public static ChainRecord decide(List<ChainRecord> recordsForSameKey) {
        if (recordsForSameKey == null || recordsForSameKey.isEmpty()) {
            return null;
        }
        for (ChainRecord record : recordsForSameKey) {
            if (SUCCESS.equalsIgnoreCase(record.getChainStatus() == null ? "" : record.getChainStatus())) {
                return record;
            }
        }
        return recordsForSameKey.get(recordsForSameKey.size() - 1);
    }

    /** 结论是否"已上链"（只有 SUCCESS 算，PENDING/FAILED 都不算）。 */
    public static boolean onChain(ChainRecord decided) {
        return decided != null && SUCCESS.equalsIgnoreCase(decided.getChainStatus() == null ? "" : decided.getChainStatus());
    }
}
