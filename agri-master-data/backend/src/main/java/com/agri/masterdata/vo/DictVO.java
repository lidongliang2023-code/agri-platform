package com.agri.masterdata.vo;

import com.agri.masterdata.entity.Dict;
import com.agri.masterdata.entity.DictItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DictVO {

    private Long id;

    private String dictName;

    private String dictCode;

    private String dictType;

    /** 字典说明。表里有 description 列、页面有"描述"一列，但 VO 缺该字段。 */
    private String description;

    private Integer status;

    private List<DictItemVO> items;

    private String tenantId;

    private String createBy;

    private LocalDateTime createTime;

    private String remark;

    public static DictVO fromEntity(Dict dict) {
        if (dict == null) {
            return null;
        }
        return DictVO.builder()
                .id(dict.getId())
                .dictName(dict.getDictName())
                .dictCode(dict.getDictCode())
                .dictType(dict.getDictType())
                .description(dict.getDescription())
                .status(dict.getStatus())
                .tenantId(dict.getTenantId())
                .createBy(dict.getCreateBy())
                .createTime(dict.getCreateTime())
                .build();
    }

    public static DictVO fromEntity(Dict dict, List<DictItem> dictItems) {
        DictVO vo = fromEntity(dict);
        if (dictItems != null) {
            vo.setItems(dictItems.stream()
                    .map(DictItemVO::fromEntity)
                    .collect(Collectors.toList()));
        }
        return vo;
    }
}
