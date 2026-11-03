package com.agri.platform.internal.account;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;

/** 证照到期提醒发送记录 */
@Mapper
public interface CertificateReminderMapper extends BaseMapper<CertificateReminderEntity> {
}
