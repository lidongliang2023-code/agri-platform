package com.agri.produce.internal.admin;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/**
 * 审批单（认证/召回/配额变更等） 数据访问。
 */
@Mapper
public interface ApprovalMapper extends BaseMapper<ApprovalEntity> {
}
