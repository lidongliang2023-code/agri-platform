package com.agri.production.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 食品安全校验服务（移动端 PRD §10.2 / §10.3 的口径，服务端化）。

 *
 * <p>为什么放到服务端：这两条规则原来分别写在移动端与 PC 端的页面里各算一遍，
 * 口径迟早会漂。放到服务端后小程序、H5、PC 共用一份实现。</p>
 *
 * <p><b>能力边界（重要）</b>：本部署的数据只能支撑其中一部分，实现里**如实区分**
 * "算过且通过 / 算过且拦住 / 没有数据没法算"，绝不用默认值把"没数据"说成"通过"。
 * 具体见各实现方法的注释。</p>
 */
public interface IFoodSafetyService {

    /**
     * 采收前休药期校验（单个或多个地块）。
     *
     * @param plotIds           地块主键列表（至少一个）
     * @param plannedHarvestDate 计划采收日期；为空按今天
     * @param tenantId          租户
     * @return 校验结果：单地块时字段会被摊平到根上，多地块时给 {@code plots} 数组与整组结论
     */
    Map<String, Object> preHarvestCheck(List<Long> plotIds, LocalDate plannedHarvestDate, String tenantId);

    /**
     * 投入品使用前的四重校验（合规 / 交互 / 时机 / 成本）。
     *
     * @param body     入参：inputId（必填）、plotId、dosage、unit、usageDate
     * @param tenantId 租户
     * @return 每项的结果与说明、整体结论；没有主数据的项返回 UNKNOWN 并写明原因
     */
    Map<String, Object> complianceCheck(Map<String, Object> body, String tenantId);
}
