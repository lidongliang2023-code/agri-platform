package com.agri.production.service;

import com.agri.production.common.entity.PageResult;
import com.agri.production.vo.AdminFsColdChainMatchVO;
import com.agri.production.vo.AdminFsColdChainResourceVO;

import java.util.Map;

/**
 * 运营端：冷链资源撮合（P19）。
 *
 * <p>端点前缀 {@code /api/v1/production/admin/food-safety/cold-chain}。表与演示数据来自
 * schema-patch-food-safety.sql / schema-patch-food-safety-data-cold-chain.sql。</p>
 */
public interface IAdminFoodSafetyColdChainService {

    /**
     * 冷链资源统计。
     *
     * <p>口径：{@code total}/{@code available}/{@code busy}/{@code offline} 由资源状态实时计数；
     * {@code matchRate}（撮合成功率）= (processing + done) / 全部撮合记录 ——
     * {@code queued} 表示还没撮上（在排队），不计入成功。没有任何撮合记录时给 null，
     * 而不是 0%：0% 的语义是"撮过、全失败"。</p>
     */
    Map<String, Object> stats();

    /** 冷链资源分页（type / status / city / keyword 均可选；keyword 匹配资源名与区县）。 */
    PageResult<AdminFsColdChainResourceVO> pageResources(int pageNum, int pageSize, String type, String status,
                                                        String city, String keyword);

    /** 撮合记录分页（status / keyword 可选；keyword 匹配需求方与资源方）。 */
    PageResult<AdminFsColdChainMatchVO> pageMatches(int pageNum, int pageSize, String status, String keyword);

    /**
     * 立即撮合：资源须为 idle，撮合成功后资源转 busy。
     *
     * <p>守卫与页面一致（页面只在 idle 时渲染「立即撮合」、busy 时渲染「加入队列」、offline 时禁用按钮），
     * 但页面守卫不能当服务端守卫用 —— 对离线或占用中的资源发出矛盾指令，会让两边状态对不上。</p>
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 资源不存在（404）
     */
    AdminFsColdChainMatchVO createMatch(String resourceId, String demander, String cargo, String startTime,
                                       String tempRequire, String remark);

    /**
     * 繁忙资源加入撮合队列（资源状态不变，只落一条 queued 记录）。
     *
     * @throws com.agri.production.common.exception.BusinessException 参数非法（400）/ 资源不存在（404）
     */
    AdminFsColdChainMatchVO enqueue(String resourceId, String demander, String expectTime, String remark);
}
