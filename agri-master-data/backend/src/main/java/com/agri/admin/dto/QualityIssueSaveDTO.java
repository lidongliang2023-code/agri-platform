package com.agri.admin.dto;

import lombok.Data;

/**
 * 登记质量问题（运营端手工登记）。
 *
 * <p>质量问题绝大多数由检测规则自动产生，但"运营人员发现一个规则没覆盖到的问题、
 * 先登记进来"是真实场景，因此保留手工登记入口。</p>
 */
@Data
public class QualityIssueSaveDTO {

    private String description;

    private String domainCode;

    private String domainName;

    private String severity;

    private String issueType;

    private String affectedData;

    private Integer affectedRecords;

    private String tenantId;
}
