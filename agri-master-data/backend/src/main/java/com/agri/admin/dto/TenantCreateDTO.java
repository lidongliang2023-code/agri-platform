package com.agri.admin.dto;

import lombok.Data;

@Data
public class TenantCreateDTO {

    private String name;
    
    private String code;
    
    private String contactPerson;
    
    private String contactPhone;
    
    private String status;
}