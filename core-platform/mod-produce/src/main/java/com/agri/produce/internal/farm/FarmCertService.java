package com.agri.produce.internal.farm;

import com.agri.produce.internal.common.ProduceIds;
import com.agri.shared.exception.BusinessException;
import com.agri.shared.exception.ErrorCode;
import com.agri.shared.result.PageResult;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 农场认证（绿色/有机/无公害等） 应用服务。
 */
@Service
@RequiredArgsConstructor
public class FarmCertService {

    private static final String ID_PREFIX = "FCERT";

    private final FarmCertMapper farmCertMapper;

    /**
     * 分页查询。
     *
     * @param keyword certName 模糊关键字
     * @param status  状态过滤
     * @return 分页结果
     */
    public PageResult<FarmCertEntity> page(long page, long size, String keyword, Integer status) {
        Page<FarmCertEntity> result = farmCertMapper.selectPage(new Page<>(page, size),
                new LambdaQueryWrapper<FarmCertEntity>()
                        .like(keyword != null && !keyword.isBlank(), FarmCertEntity::getCertName, keyword)
                        .eq(status != null, FarmCertEntity::getStatus, status)
                        .orderByDesc(FarmCertEntity::getCreatedAt));
        return PageResult.of(result.getRecords(), result.getTotal(), page, size);
    }

    /**
     * 详情，不存在抛 NOT_FOUND。
     *
     * @param id 业务主键
     * @return 实体
     */
    public FarmCertEntity detail(String id) {
        FarmCertEntity entity = farmCertMapper.selectById(id);
        if (entity == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND);
        }
        return entity;
    }

    /**
     * 新增，缺省业务主键时自动生成。
     *
     * @param entity 实体
     * @return 落库后的实体
     */
    @Transactional
    public FarmCertEntity create(FarmCertEntity entity) {
        if (entity.getCertId() == null || entity.getCertId().isBlank()) {
            entity.setCertId(ProduceIds.newId(ID_PREFIX));
        }
        farmCertMapper.insert(entity);
        return entity;
    }

    /**
     * 更新（以路径上的业务主键为准）。
     *
     * @param id     业务主键
     * @param entity 待更新内容
     * @return 更新后的实体
     */
    @Transactional
    public FarmCertEntity update(String id, FarmCertEntity entity) {
        entity.setCertId(id);
        farmCertMapper.updateById(entity);
        return detail(id);
    }

    /**
     * 逻辑删除。
     *
     * @param id 业务主键
     */
    @Transactional
    public void delete(String id) {
        farmCertMapper.deleteById(id);
    }

    /** 认证审核通过：置为有效 */
    @Transactional
    public FarmCertEntity verify(String certId) {
        FarmCertEntity cert = detail(certId);
        cert.setStatus(1);
        farmCertMapper.updateById(cert);
        return cert;
    }

    /** 某农场的全部认证 */
    public List<FarmCertEntity> listByFarm(String farmId) {
        return farmCertMapper.selectList(new LambdaQueryWrapper<FarmCertEntity>()
                .eq(FarmCertEntity::getFarmId, farmId)
                .orderByDesc(FarmCertEntity::getCreatedAt));
    }

    /** 临期/过期认证扫描：expireDate <= today + days */
    public List<FarmCertEntity> listExpiring(int withinDays) {
        LocalDate deadline = LocalDate.now().plusDays(withinDays);
        return farmCertMapper.selectList(new LambdaQueryWrapper<FarmCertEntity>()
                .eq(FarmCertEntity::getStatus, 1)
                .isNotNull(FarmCertEntity::getExpireDate)
                .le(FarmCertEntity::getExpireDate, deadline)
                .orderByAsc(FarmCertEntity::getExpireDate));
    }
}
