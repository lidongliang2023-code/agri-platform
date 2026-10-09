package com.agri.produce.internal.admin;

import com.agri.produce.internal.common.ProduceBaseEntity;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * SOP 标准作业规程库（按作物/阶段下发）
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("prod_sop_library")
public class SopLibraryEntity extends ProduceBaseEntity {

    @TableId(value = "sop_id", type = IdType.INPUT)
    private String sopId;

    /** 作物ID */
    private String cropId;

    /** 规程编码 */
    private String sopCode;

    /** 规程名称 */
    private String sopName;

    /** 规程类型 PLANT/PEST/HARVEST */
    private String sopType;

    /** 版本号 */
    private String versionNo;

    /** 规程文件 */
    private String contentUrl;

    /** 适用阶段序号 */
    private Integer stageSeq;

    /** 适用区域 */
    private String applicableRegion;

    /** 发布人 */
    private String publisher;

    /** 状态 1发布 0草稿 */
    private Integer status;
}
