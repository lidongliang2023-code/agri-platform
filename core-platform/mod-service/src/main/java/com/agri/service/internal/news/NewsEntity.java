package com.agri.service.internal.news;

import com.agri.core.infra.data.BaseEntity;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 资讯（信息资讯 v1）。
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("svc_news")
public class NewsEntity extends BaseEntity {

    private String title;
    private String summary;
    private String content;
    private LocalDateTime publishedAt;
}
