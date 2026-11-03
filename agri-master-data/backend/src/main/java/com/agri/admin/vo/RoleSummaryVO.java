package com.agri.admin.vo;

import lombok.Builder;
import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleSummaryVO {

    private Long total;

    private Long active;

    private Long disabled;

    private Long systemRoles;

    private Long customRoles;

    private Long platformRoles;

    private Long subjectRoles;

    private Long legacyRoles;
}
