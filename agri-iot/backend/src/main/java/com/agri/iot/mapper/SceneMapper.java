package com.agri.iot.mapper;

import com.agri.iot.entity.Scene;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface SceneMapper extends BaseMapper<Scene> {

    List<Scene> selectByCategory(String category);

    List<Scene> selectActiveScenes();
}