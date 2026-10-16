package com.agri.production.mapper;

import com.agri.production.entity.CropInfo;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

/** 作物主数据 Mapper（扫描由 {@code @MapperScan("com.agri.production.mapper")} 统一负责）。 */
public interface CropInfoMapper extends BaseMapper<CropInfo> {

    /**
     * 该租户已用过的最大作物编码序号（**含逻辑删除的行**）。

     *
     * <p>必须走原生 SQL：{@code BaseMapper.selectCount} 会被 {@code @TableLogic} 自动加上
     * {@code deleted = 0}，于是软删一行之后计数回退、下一个编码又会撞上那条软删行的唯一索引
     * （实测：删掉 CROP-0004 后再新增就 500 {@code Duplicate entry '2001-CROP-0004'}）。</p>

     *
     * <p>码形如 {@code CROP-0004}，取第 6 位起的数字部分；非数字后缀（用户手填的编码）CAST 成 0，
     * 不参与取最大值。</p>
     *
     * @param tenantId 租户
     * @returns 已用过的最大序号；一行都没有时返回 0
     */
    @Select("SELECT COALESCE(MAX(CAST(SUBSTRING(crop_code, 6) AS UNSIGNED)), 0) "
            + "FROM agri_prod_crop_info WHERE tenant_id = #{tenantId} AND crop_code LIKE 'CROP-%'")
    Long maxCropCodeSeq(@Param("tenantId") String tenantId);
}
