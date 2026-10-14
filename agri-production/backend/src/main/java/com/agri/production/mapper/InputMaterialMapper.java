package com.agri.production.mapper;

import com.agri.production.entity.InputMaterial;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 投入品档案。
 *
 * <p>原先这里额外声明了 {@code pageQuery} / {@code selectByCode} 两个方法，
 * 对应的 XML 里写的是 {@code FROM agri_prod_input_ledger} —— 一张**从来没建过**的表，
 * 而且带上 {@code supplier_name} / {@code status} 这些档案表当时还没有的列。
 * 调用方是同样已经删掉的 {@code InputMaterialServiceImpl}，属于纯死代码：留着只会让人以为
 * "这个 mapper 有自定义查询"。现在只保留 BaseMapper，查询条件统一在服务层用 LambdaQueryWrapper 组。</p>
 */
@Mapper
public interface InputMaterialMapper extends BaseMapper<InputMaterial> {
}
