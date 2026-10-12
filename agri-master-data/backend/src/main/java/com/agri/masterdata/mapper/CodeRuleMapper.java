package com.agri.masterdata.mapper;

import com.agri.masterdata.entity.CodeRule;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 编码规则 Mapper。
 *
 * <p>全部操作都由 MyBatis-Plus 的 {@link BaseMapper} 生成，因此**不需要 XML**：
 * 没有手写 SQL 就不会出现"接口声明了、XML 里没有"那一类 Invalid bound statement
 * （主数据模块此前有过 7 条这样的语句）。</p>
 */
@Mapper
public interface CodeRuleMapper extends BaseMapper<CodeRule> {
}
