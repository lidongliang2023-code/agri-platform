<template>
  <div class="rule-config">
    <div class="config-header">
      <h2>{{ isEdit ? '编辑规则' : '新建规则' }}</h2>
      <el-button type="primary" @click="saveRule">保存规则</el-button>
    </div>

    <el-form :model="ruleForm" label-width="120px" class="rule-form">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="ruleForm.ruleName" placeholder="请输入规则名称" />
      </el-form-item>

      <el-form-item label="规则描述" prop="ruleDesc">
        <el-input type="textarea" v-model="ruleForm.ruleDesc" placeholder="请输入规则描述" />
      </el-form-item>

      <el-form-item label="规则类型">
        <el-select v-model="ruleForm.ruleType" placeholder="请选择规则类型">
          <el-option label="定时触发" value="timed" />
          <el-option label="条件触发" value="condition" />
          <el-option label="告警触发" value="alert" />
        </el-select>
      </el-form-item>

      <el-form-item label="状态">
        <el-switch v-model="ruleForm.status" active-text="启用" inactive-text="停用" />
      </el-form-item>

      <div v-if="ruleForm.ruleType === 'timed'" class="timed-config">
        <h3>定时配置</h3>
        <el-form-item label="执行时间">
          <el-time-picker v-model="ruleForm.timedTime" format="HH:mm" placeholder="选择时间" />
        </el-form-item>
        <el-form-item label="重复周期">
          <el-checkbox-group v-model="ruleForm.timedCycle">
            <el-checkbox label="1" label-name="周一" />
            <el-checkbox label="2" label-name="周二" />
            <el-checkbox label="3" label-name="周三" />
            <el-checkbox label="4" label-name="周四" />
            <el-checkbox label="5" label-name="周五" />
            <el-checkbox label="6" label-name="周六" />
            <el-checkbox label="7" label-name="周日" />
          </el-checkbox-group>
        </el-form-item>
      </div>

      <div v-if="ruleForm.ruleType === 'condition'" class="condition-config">
        <h3>条件配置</h3>
        <el-form-item label="选择设备">
          <el-select v-model="ruleForm.conditionDeviceId" placeholder="请选择设备">
            <el-option v-for="device in deviceList" :key="device.id" :label="device.deviceName" :value="device.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="监测属性">
          <el-select v-model="ruleForm.conditionProperty" placeholder="请选择属性">
            <el-option label="温度" value="temperature" />
            <el-option label="湿度" value="humidity" />
            <el-option label="土壤湿度" value="soilMoisture" />
            <el-option label="光照强度" value="lightIntensity" />
            <el-option label="PH值" value="ph" />
          </el-select>
        </el-form-item>
        <el-form-item label="比较条件">
          <el-select v-model="ruleForm.conditionOperator" placeholder="请选择条件">
            <el-option label="大于" value=">" />
            <el-option label="小于" value="<" />
            <el-option label="等于" value="=" />
            <el-option label="大于等于" value=">=" />
            <el-option label="小于等于" value="<=" />
          </el-select>
        </el-form-item>
        <el-form-item label="阈值">
          <el-input v-model="ruleForm.conditionThreshold" placeholder="请输入阈值" />
        </el-form-item>
        <el-form-item label="持续时间(秒)">
          <el-input v-model="ruleForm.conditionDuration" placeholder="持续满足条件的时间" />
        </el-form-item>
      </div>

      <div v-if="ruleForm.ruleType === 'alert'" class="alert-config">
        <h3>告警配置</h3>
        <el-form-item label="关联告警规则">
          <el-select v-model="ruleForm.alertRuleId" placeholder="请选择告警规则">
            <el-option v-for="rule in alertRuleList" :key="rule.id" :label="rule.ruleName" :value="rule.id" />
          </el-select>
        </el-form-item>
      </div>

      <div class="action-config">
        <h3>执行动作</h3>
        <el-form-item label="选择设备">
          <el-select v-model="ruleForm.actionDeviceId" placeholder="请选择执行设备">
            <el-option v-for="device in actionDeviceList" :key="device.id" :label="device.deviceName" :value="device.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行命令">
          <el-select v-model="ruleForm.actionCommand" placeholder="请选择命令">
            <el-option label="开启" value="open" />
            <el-option label="关闭" value="close" />
            <el-option label="启动" value="start" />
            <el-option label="停止" value="stop" />
            <el-option label="调节" value="adjust" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="ruleForm.actionCommand === 'adjust'" label="调节参数">
          <el-input v-model="ruleForm.actionParam" placeholder="请输入调节参数值" />
        </el-form-item>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const isEdit = ref(false)

const ruleForm = reactive({
  ruleName: '',
  ruleDesc: '',
  ruleType: 'timed',
  status: true,
  timedTime: '',
  timedCycle: ['1', '2', '3', '4', '5'],
  conditionDeviceId: '',
  conditionProperty: '',
  conditionOperator: '>',
  conditionThreshold: '',
  conditionDuration: '30',
  alertRuleId: '',
  actionDeviceId: '',
  actionCommand: 'open',
  actionParam: ''
})

const deviceList = ref([
  { id: 1, deviceName: '温湿度传感器-001' },
  { id: 2, deviceName: '土壤湿度传感器-002' },
  { id: 3, deviceName: '光照传感器-003' }
])

const actionDeviceList = ref([
  { id: 4, deviceName: '灌溉控制器-001' },
  { id: 5, deviceName: '通风设备-001' },
  { id: 6, deviceName: '遮阳设备-001' }
])

const alertRuleList = ref([
  { id: 1, ruleName: '温度过高告警' },
  { id: 2, ruleName: '湿度过低告警' },
  { id: 3, ruleName: '设备离线告警' }
])

const saveRule = () => {
  uni.showToast({ title: '规则保存成功', icon: 'success' })
}
</script>

<style scoped>
.rule-config {
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.config-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.config-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.rule-form {
  max-width: 800px;
}

.timed-config,
.condition-config,
.alert-config,
.action-config {
  margin-top: 24px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.timed-config h3,
.condition-config h3,
.alert-config h3,
.action-config h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.el-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
</style>