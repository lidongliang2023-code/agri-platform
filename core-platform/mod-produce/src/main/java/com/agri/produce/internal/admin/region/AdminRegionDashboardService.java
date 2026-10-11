package com.agri.produce.internal.admin.region;

import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 运营端：区域生产分布聚合。
 *
 * <p>口径（全部来自 prod_farm_info，无第二数据源）：</p>
 * <ul>
 *   <li>{@code region} = 农场所在省；未填省份的农场统一归入「未标注省份」，不静默丢弃；</li>
 *   <li>{@code farmCount} = 该省启用农场数（status=1）；</li>
 *   <li>{@code fieldArea} = 该省启用农场总面积之和（亩）；</li>
 *   <li>{@code tenantCount} = 该省启用农场去重后的租户数；</li>
 *   <li>{@code activityLevel}（<b>占位口径，待产品确认</b>）：按该省<strong>在产面积</strong>分档
 *       —— 不少于 3000 亩 {@code high}、1000~3000 亩 {@code middle}、不足 1000 亩 {@code low}。
 *       为什么改掉上一版「按农场密度分档」：演示数据是"一省一场"，密度口径会把 15 个省
 *       全部压成 {@code low}，地图图例完全看不出层次。面积是真实数据、可复算、能把三档拉开，
 *       作为占位比密度更可用。若产品给出「活跃度」的正式定义（例如按在产批次数或在线设备活跃率），
 *       只需替换 {@link #levelOf} 一个方法。</li>
 * </ul>
 *
 * <p>排序：农场数降序、省份名升序，保证返回顺序稳定（前端渲染与截图可复现）。</p>
 */
@Service
@RequiredArgsConstructor
public class AdminRegionDashboardService {

    private static final String UNKNOWN_REGION = "未标注省份";
    private static final BigDecimal HIGH_AREA_MU = new BigDecimal("3000");
    private static final BigDecimal MIDDLE_AREA_MU = new BigDecimal("1000");

    private final FarmInfoMapper farmInfoMapper;

    /**
     * 区域生产分布。
     *
     * @return 区域列表，每项含 region / farmCount / fieldArea / tenantCount / activityLevel
     */
    public List<Map<String, Object>> regionDistribution() {
        List<FarmInfoEntity> farms = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1));

        Map<String, List<FarmInfoEntity>> grouped = new LinkedHashMap<>();
        for (FarmInfoEntity farm : farms) {
            String region = farm.getProvince() == null || farm.getProvince().isBlank()
                    ? UNKNOWN_REGION : farm.getProvince().trim();
            grouped.computeIfAbsent(region, key -> new ArrayList<>()).add(farm);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map.Entry<String, List<FarmInfoEntity>> entry : grouped.entrySet()) {
            List<FarmInfoEntity> regionFarms = entry.getValue();
            BigDecimal areaSum = BigDecimal.ZERO;
            Set<Long> tenants = new LinkedHashSet<>();
            for (FarmInfoEntity farm : regionFarms) {
                if (farm.getAreaTotal() != null) {
                    areaSum = areaSum.add(farm.getAreaTotal());
                }
                tenants.add(farm.getTenantId());
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("region", entry.getKey());
            row.put("farmCount", regionFarms.size());
            row.put("fieldArea", areaSum);
            row.put("tenantCount", tenants.size());
            row.put("activityLevel", levelOf(areaSum));
            rows.add(row);
        }

        rows.sort((left, right) -> {
            int byCount = ((Integer) right.get("farmCount")) - ((Integer) left.get("farmCount"));
            if (byCount != 0) {
                return byCount;
            }
            return ((String) left.get("region")).compareTo((String) right.get("region"));
        });
        return rows;
    }

    /** 活跃度分档（占位口径：按在产面积，见类注释）。 */
    private String levelOf(BigDecimal areaSum) {
        if (areaSum.compareTo(HIGH_AREA_MU) >= 0) {
            return "high";
        }
        return areaSum.compareTo(MIDDLE_AREA_MU) >= 0 ? "middle" : "low";
    }
}
