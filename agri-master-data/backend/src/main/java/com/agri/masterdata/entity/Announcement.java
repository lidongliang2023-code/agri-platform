package com.agri.masterdata.entity;

import com.agri.common.entity.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/** 平台公告。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("agri_md_announcement")
public class Announcement extends BaseEntity {

    private String title;

    /** info / warning / maintenance / emergency */
    private String type;

    private String content;

    /** draft / published / offline */
    private String status;

    private LocalDateTime publishTime;

    /** 为空表示长期有效 */
    private LocalDateTime expireTime;

    private String author;
}
