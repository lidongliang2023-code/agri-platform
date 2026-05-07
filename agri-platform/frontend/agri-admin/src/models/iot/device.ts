export interface DeviceVO {
  id: number;
  deviceCode: string;
  deviceName: string;
  deviceTypeId: number;
  deviceTypeName: string;
  deviceTypeCategory: string;
  gatewayId: number;
  gatewayName: string;
  plotId: number;
  plotName: string;
  locationLat: number;
  locationLng: number;
  locationName: string;
  onlineStatus: number;
  onlineStatusText: string;
  lastOnlineTime: string;
  lastReportTime: string;
  deviceStatus: string;
  deviceStatusText: string;
  protocol: string;
  firmwareVersion: string;
  status: number;
  statusText: string;
  createTime: string;
  createBy: string;
}

export interface DeviceSaveDTO {
  deviceCode: string;
  deviceName: string;
  deviceTypeId: number;
  gatewayId?: number;
  parentId?: number;
  plotId?: number;
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
  protocol?: string;
  firmwareVersion?: string;
  configJson?: string;
  status?: number;
}

export interface DeviceUpdateDTO {
  id: number;
  deviceCode?: string;
  deviceName?: string;
  deviceTypeId?: number;
  gatewayId?: number;
  parentId?: number;
  plotId?: number;
  locationLat?: number;
  locationLng?: number;
  locationName?: string;
  protocol?: string;
  firmwareVersion?: string;
  configJson?: string;
  status?: number;
}

export interface DevicePageDTO {
  pageNum: number;
  pageSize: number;
  deviceCode?: string;
  deviceName?: string;
  deviceTypeId?: number;
  plotId?: number;
  onlineStatus?: number;
  status?: number;
}

export interface DeviceTypeVO {
  id: number;
  typeCode: string;
  typeName: string;
  typeCategory: string;
  typeCategoryText: string;
  icon: string;
  protocol: string;
  manufacturer: string;
  model: string;
  specJson: string;
  status: number;
  statusText: string;
  createTime: string;
  createBy: string;
}

export interface DeviceTypeSaveDTO {
  typeCode: string;
  typeName: string;
  typeCategory?: string;
  icon?: string;
  protocol?: string;
  manufacturer?: string;
  model?: string;
  specJson?: string;
  status?: number;
}

export interface DeviceTypeUpdateDTO {
  id: number;
  typeCode?: string;
  typeName?: string;
  typeCategory?: string;
  icon?: string;
  protocol?: string;
  manufacturer?: string;
  model?: string;
  specJson?: string;
  status?: number;
}

export interface DeviceTypePageDTO {
  pageNum: number;
  pageSize: number;
  typeCode?: string;
  typeName?: string;
  typeCategory?: string;
  status?: number;
}

export interface DeviceDataVO {
  id: number;
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  plotId: number;
  plotName: string;
  dataJson: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  soilTemp: number;
  ph: number;
  lightIntensity: number;
  co2: number;
  deviceStatus: string;
  reportTime: string;
  createTime: string;
}

export interface RealtimeDataVO {
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  deviceTypeName: string;
  plotId: number;
  plotName: string;
  temperature: number;
  humidity: number;
  soilMoisture: number;
  soilTemp: number;
  ph: number;
  lightIntensity: number;
  co2: number;
  deviceStatus: string;
  onlineStatus: number;
  reportTime: string;
}

export interface AlertRuleVO {
  id: number;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  ruleTypeText: string;
  deviceTypeId: number;
  deviceTypeName: string;
  propertyCode: string;
  propertyName: string;
  operator: string;
  thresholdValue: string;
  durationSeconds: number;
  alertLevel: number;
  alertLevelText: string;
  alertChannel: string;
  alertTemplate: string;
  enableStatus: number;
  enableStatusText: string;
  createTime: string;
  createBy: string;
}

export interface AlertRuleSaveDTO {
  ruleCode: string;
  ruleName: string;
  ruleType?: string;
  deviceTypeId?: number;
  propertyCode?: string;
  propertyName?: string;
  operator: string;
  thresholdValue: string;
  durationSeconds?: number;
  alertLevel: number;
  alertChannel?: string;
  alertTemplate?: string;
  enableStatus?: number;
}

export interface AlertRuleUpdateDTO {
  id: number;
  ruleCode?: string;
  ruleName?: string;
  ruleType?: string;
  deviceTypeId?: number;
  propertyCode?: string;
  propertyName?: string;
  operator?: string;
  thresholdValue?: string;
  durationSeconds?: number;
  alertLevel?: number;
  alertChannel?: string;
  alertTemplate?: string;
  enableStatus?: number;
}

export interface AlertRulePageDTO {
  pageNum: number;
  pageSize: number;
  ruleCode?: string;
  ruleName?: string;
  ruleType?: string;
  deviceTypeId?: number;
  enableStatus?: number;
}

export interface AlertRecordVO {
  id: number;
  alertNo: string;
  ruleId: number;
  ruleName: string;
  deviceId: number;
  deviceCode: string;
  deviceName: string;
  plotId: number;
  plotName: string;
  alertLevel: number;
  alertLevelText: string;
  propertyCode: string;
  propertyName: string;
  triggerValue: string;
  thresholdValue: string;
  alertContent: string;
  alertTime: string;
  handleStatus: number;
  handleStatusText: string;
  handleTime: string;
  handleUser: string;
  handleResult: string;
  createTime: string;
}

export interface AlertRecordPageDTO {
  pageNum: number;
  pageSize: number;
  alertNo?: string;
  ruleName?: string;
  deviceId?: number;
  deviceCode?: string;
  plotId?: number;
  alertLevel?: number;
  handleStatus?: number;
  startTime?: string;
  endTime?: string;
}

export interface AlertHandleDTO {
  handleStatus: number;
  handleResult?: string;
}
