package com.agri.iot.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_iot_scene")
public class Scene extends BaseEntity {

    private String sceneCode;

    private String sceneName;

    private String sceneType;

    private String category;

    private String icon;

    private String description;

    private String applicablePlots;

    private String sceneConfig;

    private Integer isActive;

    private Integer sortOrder;

    private Integer delFlag;
}