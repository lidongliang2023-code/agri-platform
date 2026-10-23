package com.agri.s2b2c.service.impl;

import com.agri.s2b2c.entity.Category;
import com.agri.s2b2c.mapper.CategoryMapper;
import com.agri.s2b2c.service.CategoryService;
import com.agri.s2b2c.vo.CategoryVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class CategoryServiceImpl extends ServiceImpl<CategoryMapper, Category> implements CategoryService {

    @Override
    public List<CategoryVO> getTree() {
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Category::getStatus, "ACTIVE");
        wrapper.orderByAsc(Category::getSortOrder);
        List<Category> categories = baseMapper.selectList(wrapper);

        Map<Long, List<Category>> childrenMap = categories.stream()
                .filter(c -> c.getParentId() != null && c.getParentId() != 0)
                .collect(Collectors.groupingBy(Category::getParentId));

        List<CategoryVO> roots = categories.stream()
                .filter(c -> c.getParentId() == null || c.getParentId() == 0)
                .map(this::convertToVO)
                .toList();

        for (CategoryVO root : roots) {
            List<Category> children = childrenMap.getOrDefault(root.getId(), List.of());
            root.setChildren(children.stream().map(this::convertToVO).toList());
        }

        return roots;
    }

    @Override
    public List<Category> listAll() {
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Category::getStatus, "ACTIVE");
        wrapper.orderByAsc(Category::getSortOrder);
        return baseMapper.selectList(wrapper);
    }

    private CategoryVO convertToVO(Category category) {
        CategoryVO vo = new CategoryVO();
        BeanUtils.copyProperties(category, vo);
        vo.setChildren(new ArrayList<>());
        return vo;
    }
}