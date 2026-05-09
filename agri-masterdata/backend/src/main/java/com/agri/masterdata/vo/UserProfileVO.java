package com.agri.masterdata.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Data
public class UserProfileVO {

    private String profileId;

    private String userId;

    private String profileType;

    private String profileTypeName;

    private Map<String, Object> profileData;

    private List<String> tags;

    private Map<String, Object> scoreData;

    private LocalDateTime updateTime;

    private LocalDateTime createTime;
}