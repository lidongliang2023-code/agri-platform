package com.agri.finance.mapper;

import com.agri.finance.entity.LoanApplication;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface LoanApplicationMapper extends BaseMapper<LoanApplication> {

    @Select("""
            SELECT id FROM loan_application
            WHERE id = #{id} AND del_flag = 0
            FOR UPDATE
            """)
    String lockById(@Param("id") String id);
}
