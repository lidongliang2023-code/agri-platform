package com.agri.production.vo;

import com.agri.production.common.util.BeanCopyUtils;
import com.agri.production.entity.CropInfo;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** 作物主数据出参（页面 {@code Crop}）。 */
@Data
public class CropVO {

    private Long id;

    /** 页面口径主键（字符串）—— 页面列表直接读 {@code cropId} */
    public String getCropId() {
        return id == null ? null : String.valueOf(id);
    }

    private String cropCode;

    private String cropName;

    private String cropCategory;

    private Integer growthCycleDays;

    private String measurementUnit;

    /** 1 启用 / 0 停用 */
    private Integer status;

    private Integer sortNo;

    private String remark;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    /**
     * 由实体构造出参。
     *
     * @param entity 作物实体（可为 null）
     * @returns 出参对象（入参为 null 时返回 null）
     */
    public static CropVO of(CropInfo entity) {
        return BeanCopyUtils.copy(entity, CropVO.class);
    }

    /**
     * 批量构造出参。
     *
     * @param list 实体列表（可为 null / 空）
     * @returns 出参列表（入参为 null 时返回空列表）
     */
    public static List<CropVO> listOf(List<CropInfo> list) {
        return list == null ? List.of() : list.stream().map(CropVO::of).toList();
    }
}
