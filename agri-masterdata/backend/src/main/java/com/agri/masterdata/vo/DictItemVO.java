package com.agri.masterdata.vo;

import com.agri.masterdata.entity.DictItem;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DictItemVO {

    private Long id;

    private Long dictId;

    private String itemCode;

    private String itemName;

    private String itemText;

    private String itemValue;

    private Integer itemSort;

    private Integer status;

    public static DictItemVO fromEntity(DictItem item) {
        if (item == null) {
            return null;
        }
        return DictItemVO.builder()
                .id(item.getId())
                .dictId(item.getDictId())
                .itemCode(item.getItemCode())
                .itemName(item.getItemName())
                .itemText(item.getItemText())
                .itemValue(item.getItemValue())
                .itemSort(item.getItemSort())
                .status(item.getStatus())
                .build();
    }
}
