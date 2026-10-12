package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.DictItem;
import com.agri.masterdata.vo.DictItemVO;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DictItemMapper extends BaseMapper<DictItem> {

    List<DictItemVO> selectDictItemsByDictId(@Param("dictId") Long dictId);

    List<DictItem> selectByDictId(@Param("dictId") Long dictId);

    void deleteByDictId(@Param("dictId") Long dictId);
}
