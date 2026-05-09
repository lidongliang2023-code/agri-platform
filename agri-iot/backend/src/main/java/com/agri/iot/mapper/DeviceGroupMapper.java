
package com.agri.iot.mapper;

import com.agri.iot.entity.DeviceGroup;
import com.agri.iot.entity.DeviceGroupRelation;
import com.agri.iot.vo.DeviceGroupVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface DeviceGroupMapper {

    List<DeviceGroupVO> selectGroupList(@Param("tenantId") String tenantId);

    DeviceGroupVO selectGroupById(@Param("id") Long id);

    void insert(DeviceGroup deviceGroup);

    void update(DeviceGroup deviceGroup);

    void deleteById(@Param("id") Long id);

    void insertRelation(DeviceGroupRelation relation);

    void deleteRelationByGroupId(@Param("groupId") Long groupId);

    void deleteRelationByDeviceId(@Param("deviceId") Long deviceId);

    List<Long> selectDeviceIdsByGroupId(@Param("groupId") Long groupId);

    int selectDeviceCountByGroupId(@Param("groupId") Long groupId);

    int selectOnlineCountByGroupId(@Param("groupId") Long groupId);

    int selectAlertCountByGroupId(@Param("groupId") Long groupId);
}
