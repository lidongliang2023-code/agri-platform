<template>
  <div class="alert-rule">
    <div class="rule-header">
      <h2>{{ isEdit ? '编辑告警规则' : '新建告警规则' }}</h2>
      <el-button type="primary" @click="saveRule">保存规则</el-button>
    </div>

    <el-form :model="ruleForm" label-width="140px" class="rule-form">
      <el-form-item label="规则名称" prop="ruleName">
        <el-input v-model="ruleForm.ruleName" placeholder="请输入规则名称" />
      </el-form-item>

      <el-form-item label="规则描述" prop="ruleDesc">
        <el-input type="textarea" v-model="ruleForm.ruleDesc" placeholder="请输入规则描述" />
      </el-form-item>

      <el-form-item label="告警级别">
        <el-select v-model="ruleForm.alertLevel" placeholder="请选择告警级别">
          <el-option label="紧急" value="1" />
          <el-option label="重要" value="2" />
          <el-option label="一般" value="3" />
          <el-option label="提醒" value="4" />
        </el-select>
      </el-form-item>

      <el-form-item label="状态">
        <el-switch v-model="ruleForm.status" active-text="启用" inactive-text="停用" />
      </el-form-item>

      <div class="condition-section">
        <h3>告警条件配置</h3>
        <el-form-item label="选择设备类型">
          <el-select v-model="ruleForm.deviceTypeId" placeholder="请选择设备类型">
            <el-option v-for="type in deviceTypeList" :key="type.id" :label="type.typeName" :value="type.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="监测属性">
          <el-select v-model="ruleForm.propertyCode" placeholder="请选择监测属性">
            <el-option label="温度" value="temperature" />
            <el-option label="湿度" value="humidity" />
            <el-option label="土壤湿度" value="soilMoisture" />
            <el-option label="土壤温度" value="soilTemp" />
            <el-option label="PH值" value="ph" />
            <el-option label="光照强度" value="lightIntensity" />
            <el-option label="CO2浓度" value="co2" />
          </el-select>
        </el-form-item>
        <el-form-item label="比较条件">
          <el-select v-model="ruleForm.operator" placeholder="请选择比较条件">
            <el-option label="大于" value=">" />
            <el-option label="小于" value="<" />
            <el-option label="等于" value="=" />
            <el-option label="大于等于" value=">=" />
            <el-option label="小于等于" value="<=" />
            <el-option label="不等于" value="!=" />
            <el-option label="在范围外" value="out_of_range" />
          </el-select>
        </el-form-item>
        <el-form-item label="阈值上限">
          <el-input v-model="ruleForm.thresholdMax" placeholder="请输入阈值上限" />
          <span class="unit">根据属性自动填充单位</span>
        </el-form-item>
        <el-form-item v-if="ruleForm.operator === 'out_of_range'" label="阈值下限">
          <el-input v-model="ruleForm.thresholdMin" placeholder="请输入阈值下限" />
        </el-form-item>
        <el-form-item label="持续时间(秒)">
          <el-input v-model="ruleForm.duration" placeholder="持续满足条件才触发告警" />
        </el-form-item>
        <el-form-item label="告警间隔(秒)">
          <el-input v-model="ruleForm.interval" placeholder="相同告警的重复间隔" />
        </el-form-item>
      </div>

      <div class="notify-section">
        <h3>通知配置</h3>
        <el-form-item label="启用推送">
          <el-switch v-model="ruleForm.pushEnabled" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="推送渠道" v-if="ruleForm.pushEnabled">
          <el-checkbox-group v-model="ruleForm.pushChannels">
            <el-checkbox label="wechat" label-name="微信" />
            <el-checkbox label="sms" label-name="短信" />
            <el-checkbox label="email" label-name="邮件" />
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="通知人员" v-if="ruleForm.pushEnabled">
          <el-select v-model="ruleForm.notifyUsers" multiple placeholder="请选择通知人员">
            <el-option label="管理员" value="admin" />
            <el-option label="操作员A" value="user1" />
            <el-option label="操作员B" value="user2" />
          </el-select>
        </el-form-item>
      </div>

      <div class="action-section">
        <h3>联动动作</h3>
        <el-form-item label="启用联动">
          <el-switch v-model="ruleForm.actionEnabled" active-text="开启" inactive-text="关闭" />
        </el-form-item>
        <el-form-item label="执行设备" v-if="ruleForm.actionEnabled">
          <el-select v-model="ruleForm.actionDeviceId" placeholder="请选择执行设备">
            <el-option v-for="device in actionDeviceList" :key="device.id" :label="device.deviceName" :value="device.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行命令" v-if="ruleForm.actionEnabled">
          <el-select v-model="ruleForm.actionCommand" placeholder="请选择执行命令">
            <el-option label="开启" value="open" />
            <el-option label="关闭" value="close" />
            <el-option label="启动" value="start" />
            <el-option label="停止" value="stop" />
          </el-select>
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
  alertLevel: '3',
  status: true,
  deviceTypeId: '',
  propertyCode: '',
  operator: '>',
  thresholdMax: '',
  thresholdMin: '',
  duration: '30',
  interval: '300',
  pushEnabled: true,
  pushChannels: ['wechat'],
  notifyUsers: ['admin'],
  actionEnabled: false,
  actionDeviceId: '',
  actionCommand: 'open'
})

const deviceTypeList = ref([
  { id: 1, typeName: '温湿度传感器' },
  { id: 2, typeName: '土壤传感器' },
  { id: 3, typeName: '光照传感器' },
  { id: 4, typeName: '灌溉控制器' }
])

const actionDeviceList = ref([
  { id: 1, deviceName: '灌溉控制器-001' },
  { id: 2, deviceName: '通风设备-001' },
  { id: 3, deviceName: '遮阳设备-001' }
])

const saveRule = () => {
  uni.showToast({ title: '告警规则保存成功', icon: 'success' })
}
</script>

<style scoped>
.alert-rule {
  padding: 20px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid #eee;
}

.rule-header h2 {
  margin: 0;
  font-size: 20px;
  color: #333;
}

.rule-form {
  max-width: 800px;
}

.condition-section,
.notify-section,
.action-section {
  margin-top: 24px;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.condition-section h3,
.notify-section h3,
.action-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: #333;
  font-weight: 600;
}

.unit {
  margin-left: 12px;
  color: #999;
  font-size: 14px;
}

.el-checkbox-group {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}
</style>