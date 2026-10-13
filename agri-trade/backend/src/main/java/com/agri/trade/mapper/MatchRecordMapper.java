package com.agri.trade.mapper;

import com.agri.trade.entity.MatchRecord;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface MatchRecordMapper extends BaseMapper<MatchRecord> {

    /*
     * 原先这里有一条手写的 insertBatch，引用了 demand_no / product_name / seller_name /
     * match_status 四个**表里不存在、实体也没有**的列（执行时先报
     * "There is no getter for property named 'demandNo'"）。
     * 也就是说撮合记录的落库路径从来没有通过一次 —— 页面上的「触发智能撮合」
     * 一调就是 500，而演示数据里的撮合记录是 SQL 直接造进去的。
     * 已删除，改用 MyBatis-Plus 的 insert（表里 buyer_id 为 NOT NULL 的坑另见实体注释）。
     */
}
