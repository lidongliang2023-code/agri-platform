package com.agri.s2b2c.service;

import com.agri.s2b2c.entity.Category;
import com.agri.s2b2c.vo.CategoryVO;
import com.baomidou.mybatisplus.extension.service.IService;

import java.util.List;

public interface CategoryService extends IService<Category> {
    List<CategoryVO> getTree();
    List<Category> listAll();
}