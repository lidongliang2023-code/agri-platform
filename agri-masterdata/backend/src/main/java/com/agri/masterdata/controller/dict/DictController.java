package com.agri.masterdata.controller.dict;

import com.agri.common.entity.ApiResponse;
import com.agri.masterdata.dto.DictItemSaveDTO;
import com.agri.masterdata.dto.DictSaveDTO;
import com.agri.masterdata.service.IDictService;
import com.agri.masterdata.vo.DictItemVO;
import com.agri.masterdata.vo.DictVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/dict")
@RequiredArgsConstructor
public class DictController {

    private final IDictService dictService;

    @GetMapping("/list")
    public ApiResponse<List<DictVO>> list() {
        return ApiResponse.success(dictService.list());
    }

    @GetMapping("/{id}")
    public ApiResponse<DictVO> getDetail(@PathVariable Long id) {
        return ApiResponse.success(dictService.getById(id));
    }

    @PostMapping
    public ApiResponse<Void> save(@RequestBody @Valid DictSaveDTO dto) {
        dictService.save(dto);
        return ApiResponse.success();
    }

    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @RequestBody @Valid DictSaveDTO dto) {
        dictService.update(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        dictService.delete(id);
        return ApiResponse.success();
    }

    @GetMapping("/{id}/items")
    public ApiResponse<List<DictItemVO>> getItems(@PathVariable Long id) {
        return ApiResponse.success(dictService.getItemsByDictId(id));
    }

    @GetMapping("/code/{code}/items")
    public ApiResponse<List<DictItemVO>> getItemsByCode(@PathVariable String code) {
        return ApiResponse.success(dictService.getItemsByDictCode(code));
    }

    @PostMapping("/item")
    public ApiResponse<Void> saveItem(@RequestBody @Valid DictItemSaveDTO dto) {
        dictService.saveItem(dto);
        return ApiResponse.success();
    }

    @PutMapping("/item/{id}")
    public ApiResponse<Void> updateItem(@PathVariable Long id, @RequestBody @Valid DictItemSaveDTO dto) {
        dictService.updateItem(id, dto);
        return ApiResponse.success();
    }

    @DeleteMapping("/item/{id}")
    public ApiResponse<Void> deleteItem(@PathVariable Long id) {
        dictService.deleteItem(id);
        return ApiResponse.success();
    }
}
