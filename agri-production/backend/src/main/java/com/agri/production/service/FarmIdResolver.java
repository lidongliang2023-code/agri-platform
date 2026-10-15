package com.agri.production.service;

import com.agri.production.common.exception.BusinessException;
import com.agri.production.entity.Farm;
import com.agri.production.mapper.FarmMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 农场筛选值的解析（前端传的 farmId → 本服务的农场主键）。
 *
 * <p><b>为什么需要它（2026-10-15 实测的问题）</b>：页面上的"当前农场"来自
 * {@code GET /farms}（这一段仍在平台侧服务），返回的 farmId 是平台侧主键
 * {@code DEMO-FARM-001} 这种**字符串**；而本服务的农场主键是数字 id。
 * 前端把这个值原样作为过滤参数发过来时，本服务的处理是
 * {@code Long.parseLong} 失败 → 返回 null → **过滤条件被悄悄丢掉**：</p>
 * <pre>
 *   GET /harvests?farmId=DEMO-FARM-010   → 返回全部 3 条（看起来"筛过了"，其实没筛）
 *   GET /plans?farmId=DEMO-FARM-010      → 返回 1 条（同上）
 *   GET /quality/inspections?farmId=...  → 返回 5 条（同上）
 *   GET /tasks?farmId=DEMO-FARM-010      → 400「参数类型不匹配」（这条是绑定时就失败了）
 * </pre>
 * <p>同一件事在不同端点上表现不同、且最危险的三种是**静默**的 —— 用户以为看到的是"这个农场的
 * 数据"，实际是全量。这比报错难发现得多，也正是本项目一直在治的那类问题。</p>
 *
 * <p><b>口径</b>：</p>
 * <ul>
 *   <li>没传（null/空白）→ 返回 null，表示"不过滤"；</li>
 *   <li>纯数字 → 按本服务农场主键用（不校验存在性：不存在的农场筛出空列表是合理结果）；</li>
 *   <li>其它 → 查 {@code agri_prod_farm_info.platform_farm_id}（平台侧农场标识，如 DEMO-FARM-001）
 *       或 {@code farm_code}，命中则换算成本地主键；</li>
 *   <li>换算不出来 → **400 并说明收到的是什么**，绝不返回 null 把过滤悄悄丢掉。</li>
 * </ul>
 *
 * <p>仍然存在的边界（写在这里免得下次误以为已经解决）：本服务与平台侧的农场主数据是**两份**，
 * 靠 {@code platform_farm_id} 这层映射对齐（演示数据见 schema-patch-farm-identity.sql）。
 * 真正的长期解法是把 /farms 段也切过来、让农场主数据只有一个来源，
 * 那是一次独立的重构（涉及 plots/tasks/plans 等所有 farm_id 引用），不在本方法职责内。</p>
 */
@Slf4j
@Service
public class FarmIdResolver {

    private final FarmMapper farmMapper;

    public FarmIdResolver(FarmMapper farmMapper) {
        this.farmMapper = farmMapper;
    }

    /**
     * 解析筛选参数。
     *
     * @param rawFarmId 前端传来的原值（可能是数字、平台标识、农场编码，或空）
     * @param tenantId  当前租户（解析平台标识时限定在本租户内）
     * @return 本服务农场主键；未传时为 null
     * @throws BusinessException 传了值但换算不出来（400）
     */
    public Long resolveFilter(String rawFarmId, String tenantId) {
        if (rawFarmId == null || rawFarmId.isBlank()) {
            return null;
        }
        String text = rawFarmId.trim();
        if (text.chars().allMatch(Character::isDigit)) {
            try {
                return Long.valueOf(text);
            } catch (NumberFormatException e) {
                // 纯数字但超出 Long 范围：继续往下走，交给"查不到就报错"
            }
        }
        Farm farm = farmMapper.selectOne(new LambdaQueryWrapper<Farm>()
                .eq(Farm::getTenantId, tenantId)
                .and(w -> w.eq(Farm::getPlatformFarmId, text).or().eq(Farm::getFarmCode, text))
                .last("LIMIT 1"));
        if (farm != null) {
            return farm.getId();
        }
        throw new BusinessException(400, "农场筛选值无法识别：" + text
                + "（本服务接受农场数字 id、农场编码，或平台侧 farm_id 如 DEMO-FARM-001）");
    }
}
