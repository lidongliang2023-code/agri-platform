package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.Dict;
import com.agri.masterdata.entity.DictItem;
import com.agri.masterdata.vo.DictItemVO;
import com.agri.masterdata.vo.DictVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DictMapper extends BaseMapper<Dict> {

    List<DictVO> selectDictList(@Param("tenantId") String tenantId);

    DictVO selectDictById(@Param("id") Long id);

    Dict selectByDictCode(@Param("dictCode") String dictCode);
}
