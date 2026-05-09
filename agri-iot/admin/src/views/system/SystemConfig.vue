<template>
  <div class="system-config">
    <div class="page-header">
      <h2>系统配置</h2>
    </div>

    <div class="config-section">
      <h3 class="section-title">🌐 网络配置</h3>
      <div class="config-card">
        <div class="config-item">
          <label>服务器端口</label>
          <input v-model="config.serverPort" />
        </div>
        <div class="config-item">
          <label>最大连接数</label>
          <input v-model="config.maxConnections" />
        </div>
        <div class="config-item">
          <label>超时时间(秒)</label>
          <input v-model="config.timeout" />
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3 class="section-title">🔔 告警配置</h3>
      <div class="config-card">
        <div class="config-item">
          <label>告警级别</label>
          <select v-model="config.alertLevel">
            <option value="critical">仅紧急</option>
            <option value="warning">紧急+警告</option>
            <option value="info">全部</option>
          </select>
        </div>
        <div class="config-item">
          <label>通知间隔(分钟)</label>
          <input v-model="config.notifyInterval" />
        </div>
        <div class="config-item">
          <label>最大通知次数</label>
          <input v-model="config.maxNotifyCount" />
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3 class="section-title">💾 数据配置</h3>
      <div class="config-card">
        <div class="config-item">
          <label>数据保留天数</label>
          <input v-model="config.dataRetention" />
        </div>
        <div class="config-item">
          <label>备份频率</label>
          <select v-model="config.backupFrequency">
            <option value="daily">每日</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
        </div>
        <div class="config-item">
          <label>自动清理</label>
          <div class="toggle-switch">
            <span>关闭</span>
            <input type="checkbox" v-model="config.autoClean" />
            <span>开启</span>
          </div>
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3 class="section-title">🔐 安全配置</h3>
      <div class="config-card">
        <div class="config-item">
          <label>会话超时(分钟)</label>
          <input v-model="config.sessionTimeout" />
        </div>
        <div class="config-item">
          <label>密码有效期(天)</label>
          <input v-model="config.passwordExpire" />
        </div>
        <div class="config-item">
          <label>双因素认证</label>
          <div class="toggle-switch">
            <span>关闭</span>
            <input type="checkbox" v-model="config.twoFactor" />
            <span>开启</span>
          </div>
        </div>
      </div>
    </div>

    <div class="config-actions">
      <button class="save-btn" @click="saveConfig">保存配置</button>
      <button class="reset-btn" @click="resetConfig">恢复默认</button>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'

const config = reactive({
  serverPort: '8082',
  maxConnections: '1000',
  timeout: '30',
  alertLevel: 'warning',
  notifyInterval: '5',
  maxNotifyCount: '3',
  dataRetention: '90',
  backupFrequency: 'daily',
  autoClean: true,
  sessionTimeout: '30',
  passwordExpire: '90',
  twoFactor: false
})

const saveConfig = () => {
  alert('配置已保存')
}

const resetConfig = () => {
  config.serverPort = '8082'
  config.maxConnections = '1000'
  config.timeout = '30'
  config.alertLevel = 'warning'
  config.notifyInterval = '5'
  config.maxNotifyCount = '3'
  config.dataRetention = '90'
  config.backupFrequency = 'daily'
  config.autoClean = true
  config.sessionTimeout = '30'
  config.passwordExpire = '90'
  config.twoFactor = false
  alert('已恢复默认配置')
}
</script>

<style scoped>
.system-config {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.config-section {
  margin-bottom: 24px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
}

.config-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.config-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid #f5f5f5;
}

.config-item:last-child {
  border-bottom: none;
}

.config-item label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.config-item input[type="text"],
.config-item input[type="number"],
.config-item select {
  width: 200px;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
}

.toggle-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toggle-switch span {
  font-size: 13px;
  color: #999;
}

.toggle-switch input[type="checkbox"] {
  width: 48px;
  height: 26px;
  -webkit-appearance: none;
  appearance: none;
  background: #d9d9d9;
  border-radius: 13px;
  position: relative;
  cursor: pointer;
}

.toggle-switch input[type="checkbox"]::before {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: left 0.2s ease;
}

.toggle-switch input[type="checkbox"]:checked {
  background: #4080ff;
}

.toggle-switch input[type="checkbox"]:checked::before {
  left: 24px;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 24px;
}

.save-btn {
  padding: 12px 30px;
  background: #4080ff;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.reset-btn {
  padding: 12px 30px;
  background: #f0f0f0;
  color: #666;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}
</style>