export interface DeviceVO {
  id: number;
  deviceCode: string;
  deviceName: string;
  deviceType: string;
  deviceModel: string;
  manufacturer: string;
  installationLocation: string;
  latitude: number;
  longitude: number;
  orgId: number;
  orgName: string;
  status: number;
  createTime: string;
}

export interface DeviceSaveDTO {
  deviceCode: string;
  deviceName: string;
  deviceType?: string;
  deviceModel?: string;
  manufacturer?: string;
  installationLocation?: string;
  latitude?: number;
  longitude?: number;
  orgId?: number;
  status?: number;
}

export interface DeviceUpdateDTO {
  id: number;
  deviceCode?: string;
  deviceName?: string;
  deviceType?: string;
  deviceModel?: string;
  manufacturer?: string;
  installationLocation?: string;
  latitude?: number;
  longitude?: number;
  orgId?: number;
  status?: number;
}

export interface DevicePageDTO {
  pageNum: number;
  pageSize: number;
  deviceCode?: string;
  deviceName?: string;
  deviceType?: string;
  orgId?: number;
  status?: number;
}
