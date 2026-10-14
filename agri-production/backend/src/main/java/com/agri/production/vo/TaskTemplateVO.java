package com.agri.production.vo;

import com.agri.production.entity.TaskTemplate;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.Date;

/**
 * 任务模板出参（前端契约：{@code @agri/shared/types/task} 的 TaskTemplate）。
 *
 * <p>与 TaskVO 同一口径：物理列名不动（template_content / recommended_duration_hours /
 * create_time），出参名字对齐前端要读的字段 —— 模板库页面读的是
 * {@code templateCode / templateName / cropName / standardHours / content / isSystem}，
 * 其中 standardHours、content 原先后端根本不产出（页面只能显示 '-'），
 * status 前端按 0/1 判断，而库里存的是 'active' 这种字符串。</p>
 */
@Data
public class TaskTemplateVO {

    @JsonProperty("templateId")
    private Long id;

    private String templateCode;
    private String templateName;
    private String templateType;
    private String cropCategory;
    private String cropName;
    private String taskType;
    /** 适用生长阶段（前端若要细分阶段再用它，语义上是文本） */
    private String growthStage;
    private String description;

    @JsonProperty("content")
    private String templateContent;

    @JsonProperty("standardHours")
    private Integer recommendedDurationHours;

    private String requiredInputs;
    private String optionalInputs;

    @JsonProperty("isSystem")
    private Integer isSystem;

    private Integer useCount;
    private Integer sortOrder;
    private String remark;

    @JsonProperty("createdAt")
    private Date createTime;

    @JsonProperty("updatedAt")
    private Date updateTime;

    /**
     * 启用状态：前端是 {@code 0 | 1}，库里是 {@code 'active'} 这类字符串 ——
     * 这里做一次映射，页面不必自己解释字符串。
     */
    @JsonProperty("status")
    public Integer getStatusFlag() {
        return "active".equalsIgnoreCase(template.getStatus()) ? 1 : 0;
    }

    /**
     * 原始实体（只用于派生字段）。
     *
     * <p>必须 {@link JsonIgnore}：Java 的 {@code transient} 只影响序列化框架之外的场景，
     * Jackson 照样会把它整个吐出来 —— 实测出参里多了一个 template 大对象。</p>
     */
    @JsonIgnore
    private transient TaskTemplate template;

    public static TaskTemplateVO of(TaskTemplate entity) {
        TaskTemplateVO vo = new TaskTemplateVO();
        if (entity == null) {
            return vo;
        }
        vo.template = entity;
        vo.id = entity.getId();
        vo.templateCode = entity.getTemplateCode();
        vo.templateName = entity.getTemplateName();
        vo.templateType = entity.getTemplateType();
        vo.cropCategory = entity.getCropCategory();
        vo.cropName = entity.getCropName();
        vo.taskType = entity.getTaskType();
        vo.growthStage = entity.getGrowthStage();
        vo.description = entity.getDescription();
        vo.templateContent = entity.getTemplateContent();
        vo.recommendedDurationHours = entity.getRecommendedDurationHours();
        vo.requiredInputs = entity.getRequiredInputs();
        vo.optionalInputs = entity.getOptionalInputs();
        vo.isSystem = entity.getIsSystem();
        vo.useCount = entity.getUseCount();
        vo.sortOrder = entity.getSortOrder();
        vo.remark = entity.getRemark();
        vo.createTime = entity.getCreateTime();
        vo.updateTime = entity.getUpdateTime();
        return vo;
    }
}
