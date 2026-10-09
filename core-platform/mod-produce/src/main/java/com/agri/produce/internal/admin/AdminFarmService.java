package com.agri.produce.internal.admin;

import com.agri.produce.internal.farm.FarmCertEntity;
import com.agri.produce.internal.farm.FarmCertMapper;
import com.agri.produce.internal.farm.FarmInfoEntity;
import com.agri.produce.internal.farm.FarmInfoMapper;
import com.agri.produce.internal.plot.PlotInfoEntity;
import com.agri.produce.internal.plot.PlotInfoMapper;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 运营端：农场监管（认证临期、合规画像、停用/恢复）。
 */
@Service
@RequiredArgsConstructor
public class AdminFarmService {

    private final FarmInfoMapper farmInfoMapper;
    private final FarmCertMapper farmCertMapper;
    private final PlotInfoMapper plotInfoMapper;

    /**
     * 分页监管农场。
     *
     * @param page    页码
     * @param size    每页条数
     * @param keyword 农场名称关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<FarmInfoEntity> page(long page, long size, String keyword, Integer status) {
        Page<FarmInfoEntity> result = farmInfoMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<FarmInfoEntity>()
                        .like(keyword != null && !keyword.isBlank(), FarmInfoEntity::getFarmName, keyword)
                        .eq(status != null, FarmInfoEntity::getStatus, status)
                        .orderByDesc(FarmInfoEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 农场合规画像：地块数、认证数、临期认证数、过期认证数。
     *
     * @param farmId 农场ID
     * @return 合规画像
     */
    public Map<String, Object> compliance(String farmId) {
        FarmInfoEntity farm = farmInfoMapper.selectById(farmId);
        if (farm == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        List<FarmCertEntity> certs = farmCertMapper.selectList(new LambdaQueryWrapper<FarmCertEntity>()
                .eq(FarmCertEntity::getFarmId, farmId));
        long expiring = certs.stream()
                .filter(c -> c.getExpireDate() != null
                        && !c.getExpireDate().isBefore(LocalDate.now())
                        && !c.getExpireDate().isAfter(LocalDate.now().plusDays(30)))
                .count();
        long expired = certs.stream()
                .filter(c -> c.getExpireDate() != null && c.getExpireDate().isBefore(LocalDate.now()))
                .count();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("farmId", farm.getFarmId());
        result.put("farmName", farm.getFarmName());
        result.put("plotCount", plotInfoMapper.selectCount(new LambdaQueryWrapper<PlotInfoEntity>()
                .eq(PlotInfoEntity::getFarmId, farmId)));
        result.put("certCount", certs.size());
        result.put("certExpiring", expiring);
        result.put("certExpired", expired);
        result.put("complianceLevel", expired > 0 ? "RISK" : (expiring > 0 ? "WARN" : "OK"));
        return result;
    }

    /**
     * 临期认证农场清单。
     *
     * @param withinDays 天数窗口
     * @return 农场列表
     */
    public List<FarmInfoEntity> listCertExpiring(int withinDays) {
        List<FarmCertEntity> certs = farmCertMapper.selectList(new LambdaQueryWrapper<FarmCertEntity>()
                .eq(FarmCertEntity::getStatus, 1)
                .isNotNull(FarmCertEntity::getExpireDate)
                .le(FarmCertEntity::getExpireDate, LocalDate.now().plusDays(withinDays))
                .orderByAsc(FarmCertEntity::getExpireDate));
        List<FarmInfoEntity> farms = new java.util.ArrayList<>();
        for (FarmCertEntity cert : certs) {
            FarmInfoEntity farm = farmInfoMapper.selectById(cert.getFarmId());
            if (farm != null && !farms.contains(farm)) {
                farms.add(farm);
            }
        }
        return farms;
    }

    /**
     * 监管停用/恢复农场。
     *
     * @param farmId 农场ID
     * @param enable true 恢复，false 停用
     * @return 农场档案
     */
    @Transactional
    public FarmInfoEntity toggleStatus(String farmId, boolean enable) {
        FarmInfoEntity farm = farmInfoMapper.selectById(farmId);
        if (farm == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        farm.setStatus(enable ? 1 : 0);
        farmInfoMapper.updateById(farm);
        return farm;
    }

    /** 农场地理分布 */
    public List<Map<String, Object>> map() {
        List<FarmInfoEntity> farms = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (FarmInfoEntity farm : farms) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("farmId", farm.getFarmId());
            row.put("farmName", farm.getFarmName());
            row.put("province", farm.getProvince());
            row.put("city", farm.getCity());
            row.put("district", farm.getDistrict());
            row.put("areaTotal", farm.getAreaTotal());
            result.add(row);
        }
        return result;
    }

    /** 农场合规清单（取前 limit 个农场） */
    public List<Map<String, Object>> complianceList(int limit) {
        List<FarmInfoEntity> farms = farmInfoMapper.selectList(new LambdaQueryWrapper<FarmInfoEntity>()
                .eq(FarmInfoEntity::getStatus, 1)
                .last("LIMIT " + Math.max(1, Math.min(limit, 200))));
        List<Map<String, Object>> result = new java.util.ArrayList<>();
        for (FarmInfoEntity farm : farms) {
            result.add(compliance(farm.getFarmId()));
        }
        return result;
    }
}
