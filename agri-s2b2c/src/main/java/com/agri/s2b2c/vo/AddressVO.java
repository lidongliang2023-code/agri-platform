package com.agri.s2b2c.vo;

import lombok.Data;

@Data
public class AddressVO {
    private Long id;
    private String name;
    private String phone;
    private String province;
    private String city;
    private String district;
    private String address;
    private Boolean isDefault;
}