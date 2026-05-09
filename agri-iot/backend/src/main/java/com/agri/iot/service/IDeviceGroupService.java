
package com.agri.iot.service;

import com.agri.iot.dto.DeviceGroupSaveDTO;
import com.agri.iot.dto.DeviceGroupUpdateDTO;
import com.agri.iot.vo.DeviceGroupVO;

import java.util.List;

public interface IDeviceGroupService {

    List<DeviceGroupVO> list();

    DeviceGroupVO getById(Long id);

    void save(DeviceGroupSaveDTO dto);

    void update(Long id, DeviceGroupUpdateDTO dto);

    void delete(Long id);

    void addDevices(Long groupId, List<Long> deviceIds);

    void removeDevices(Long groupId, List<Long> deviceIds);

    void batchControl(Long groupId, String command);
}
