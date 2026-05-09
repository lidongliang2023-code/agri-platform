package com.agri.iot.service;

import com.agri.iot.entity.Scene;

import java.util.List;

public interface ISceneService {

    List<Scene> listByCategory(String category);

    List<Scene> listAll();

    List<Scene> listActiveScenes();

    Scene getById(Long id);

    void save(Scene scene);

    void update(Long id, Scene scene);

    void delete(Long id);

    void activate(Long id);

    void deactivate(Long id);

    void executeScene(Long id);
}