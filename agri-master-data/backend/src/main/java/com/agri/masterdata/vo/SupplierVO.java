package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Supplier;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierVO {

    private Long id;

    private String supplierCode;

    private String supplierName;

    private String supplierType;

    private String supplierTypeName;

    private Long orgId;

    private String orgName;

    private String creditCode;

    private String legalPerson;

    private String contactPerson;

    private String contactPhone;

    private String address;

    private String level;

    private Integer status;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;

    public static SupplierVO fromEntity(Supplier supplier) {
        if (supplier == null) {
            return null;
        }
        return SupplierVO.builder()
                .id(supplier.getId())
                .supplierCode(supplier.getSupplierCode())
                .supplierName(supplier.getSupplierName())
                .supplierType(supplier.getSupplierType())
                .orgId(supplier.getOrgId())
                .creditCode(supplier.getCreditCode())
                .legalPerson(supplier.getLegalPerson())
                .contactPerson(supplier.getContactPerson())
                .contactPhone(supplier.getContactPhone())
                .address(supplier.getAddress())
                .level(supplier.getLevel())
                .status(supplier.getStatus())
                .tenantId(supplier.getTenantId())
                .createBy(supplier.getCreateBy())
                .createTime(supplier.getCreateTime())
                .build();
    }
}
