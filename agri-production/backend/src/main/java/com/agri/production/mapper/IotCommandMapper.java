package com.agri.production.mapper;

import com.agri.production.entity.IotCommand;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** IoT 指令记录 mapper。 */
@Mapper
public interface IotCommandMapper extends BaseMapper<IotCommand> {
}
