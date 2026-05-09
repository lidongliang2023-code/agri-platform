package com.agri.iot.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.iot.entity.Scene;
import com.agri.iot.mapper.SceneMapper;
import com.agri.iot.service.ISceneService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SceneServiceImpl implements ISceneService {

    private final SceneMapper sceneMapper;

    @Override
    public List<Scene> listByCategory(String category) {
        if (category != null && !category.isEmpty()) {
            return sceneMapper.selectByCategory(category);
        }
        LambdaQueryWrapper<Scene> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Scene::getDelFlag, 0);
        return sceneMapper.selectList(wrapper);
    }

    @Override
    public List<Scene> listAll() {
        LambdaQueryWrapper<Scene> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Scene::getDelFlag, 0);
        wrapper.orderByAsc(Scene::getSortOrder);
        return sceneMapper.selectList(wrapper);
    }

    @Override
    public List<Scene> listActiveScenes() {
        return sceneMapper.selectActiveScenes();
    }

    @Override
    public Scene getById(Long id) {
        Scene scene = sceneMapper.selectById(id);
        if (scene == null || scene.getDelFlag() == 1) {
            throw new BusinessException("场景不存在");
        }
        return scene;
    }

    @Override
    @Transactional
    public void save(Scene scene) {
        scene.setIsActive(0);
        scene.setDelFlag(0);
        if (scene.getSortOrder() == null) {
            scene.setSortOrder(0);
        }
        sceneMapper.insert(scene);
    }

    @Override
    @Transactional
    public void update(Long id, Scene scene) {
        Scene existing = getById(id);
        scene.setId(id);
        sceneMapper.updateById(scene);
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Scene scene = getById(id);
        scene.setDelFlag(1);
        scene.setIsActive(0);
        sceneMapper.updateById(scene);
    }

    @Override
    @Transactional
    public void activate(Long id) {
        Scene scene = getById(id);
        scene.setIsActive(1);
        sceneMapper.updateById(scene);
    }

    @Override
    @Transactional
    public void deactivate(Long id) {
        Scene scene = getById(id);
        scene.setIsActive(0);
        sceneMapper.updateById(scene);
    }

    @Override
    @Transactional
    public void executeScene(Long id) {
        Scene scene = getById(id);
        scene.setIsActive(1);
        sceneMapper.updateById(scene);
    }
}