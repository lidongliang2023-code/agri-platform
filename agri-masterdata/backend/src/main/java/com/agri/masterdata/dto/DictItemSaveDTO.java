package com.agri.masterdata.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class DictItemSaveDTO {

    @NotNull(message = "字典ID不能为空")
    private Long dictId;

    @NotBlank(message = "字典项文本不能为空")
    private String itemText;

    @NotBlank(message = "字典项值不能为空")
    private String itemValue;

    private Integer itemSort;

    private Integer status;
}
