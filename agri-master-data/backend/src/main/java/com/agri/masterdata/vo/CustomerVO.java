package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Customer;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CustomerVO {

    private Long id;

    private String customerCode;

    private String customerName;

    private String shortName;

    private String customerType;

    private String customerTypeName;

    private Long orgId;

    private String orgName;

    private String creditCode;

    private String legalPerson;

    private String contactName;

    private String contactPhone;

    private String address;

    private String level;

    private Integer status;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;

    public static CustomerVO fromEntity(Customer customer) {
        if (customer == null) {
            return null;
        }
        return CustomerVO.builder()
                .id(customer.getId())
                .customerCode(customer.getCustomerCode())
                .customerName(customer.getCustomerName())
                .shortName(customer.getShortName())
                .customerType(customer.getCustomerType())
                .orgId(customer.getOrgId())
                .creditCode(customer.getCreditCode())
                .legalPerson(customer.getLegalPerson())
                .contactName(customer.getContactName())
                .contactPhone(customer.getContactPhone())
                .address(customer.getAddress())
                .level(customer.getLevel())
                .status(customer.getStatus())
                .tenantId(customer.getTenantId())
                .createBy(customer.getCreateBy())
                .createTime(customer.getCreateTime())
                .build();
    }
}
