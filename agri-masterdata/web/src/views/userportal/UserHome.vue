<template>
  <div class="user-home">
    <div class="welcome-section">
      <div class="welcome-content">
        <h1>欢迎回来，{{ userInfo.nickname }}</h1>
        <p>今天是 {{ currentDate }}，祝您工作愉快！</p>
      </div>
      <div class="quick-actions">
        <button class="action-btn primary" @click="goToDataQuery">
          <span class="btn-icon">🔍</span>
          <span>数据查询</span>
        </button>
        <button class="action-btn" @click="goToReport">
          <span class="btn-icon">📊</span>
          <span>查看报表</span>
        </button>
      </div>
    </div>

    <div class="stats-section">
      <div class="stat-card" v-for="stat in stats" :key="stat.label">
        <div class="stat-icon">{{ stat.icon }}</div>
        <div class="stat-info">
          <div class="stat-value">{{ stat.value }}</div>
          <div class="stat-label">{{ stat.label }}</div>
        </div>
        <div class="stat-trend" :class="stat.trend">{{ stat.change }}</div>
      </div>
    </div>

    <div class="main-content">
      <div class="data-section">
        <div class="section-header">
          <h2>我的数据</h2>
          <button class="view-all">查看全部 →</button>
        </div>
        <div class="data-grid">
          <div v-for="item in myData" :key="item.id" class="data-card">
            <div class="card-icon">{{ item.icon }}</div>
            <div class="card-content">
              <h3>{{ item.title }}</h3>
              <p>{{ item.desc }}</p>
              <div class="card-meta">
                <span>{{ item.count }} 条记录</span>
                <span class="update-time">{{ item.updateTime }}</span>
              </div>
            </div>
            <button class="card-action">查看</button>
          </div>
        </div>
      </div>

      <div class="side-panel">
        <div class="panel-card">
          <div class="panel-header">
            <h3>最近更新</h3>
          </div>
          <div class="update-list">
            <div v-for="update in recentUpdates" :key="update.id" class="update-item">
              <span class="update-icon">{{ update.icon }}</span>
              <div class="update-content">
                <span class="update-title">{{ update.title }}</span>
                <span class="update-time">{{ update.time }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="panel-card">
          <div class="panel-header">
            <h3>快捷链接</h3>
          </div>
          <div class="link-list">
            <a v-for="link in quickLinks" :key="link.name" :href="link.path" class="link-item">
              <span class="link-icon">{{ link.icon }}</span>
              <span>{{ link.name }}</span>
            </a>
          </div>
        </div>
      </div>
    </div>

    <div class="chart-section">
      <div class="section-header">
        <h2>数据使用趋势</h2>
        <select class="time-select">
          <option>本周</option>
          <option>本月</option>
          <option>本季度</option>
        </select>
      </div>
      <div class="chart-container">
        <div class="chart-bars">
          <div v-for="(day, index) in chartData" :key="index" class="bar-wrapper">
            <div class="bar" :style="{ height: day.value + '%' }">
              <span class="bar-value">{{ day.count }}</span>
            </div>
            <span class="bar-label">{{ day.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const userInfo = ref({ nickname: '张三' })

const currentDate = computed(() => {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const weekDay = weekDays[now.getDay()]
  return `${year}年${month}月${day}日 ${weekDay}`
})

const stats = ref([
  { label: '数据查询次数', value: '2,847', icon: '🔍', change: '+12.5%', trend: 'up' },
  { label: '报表生成', value: '156', icon: '📊', change: '+8.3%', trend: 'up' },
  { label: '数据导出', value: '328', icon: '📥', change: '-2.1%', trend: 'down' },
  { label: 'API调用', value: '8,934', icon: '🔌', change: '+15.7%', trend: 'up' }
])

const myData = ref([
  { id: 1, icon: '👤', title: '用户主数据', desc: '管理用户基础信息数据', count: 1256, updateTime: '10分钟前更新' },
  { id: 2, icon: '🏢', title: '组织架构数据', desc: '管理企业组织架构信息', count: 89, updateTime: '1小时前更新' },
  { id: 3, icon: '📦', title: '商品目录数据', desc: '商品信息及分类管理', count: 3421, updateTime: '2小时前更新' },
  { id: 4, icon: '👥', title: '客户信息数据', desc: '客户基本信息管理', count: 2156, updateTime: '3小时前更新' }
])

const recentUpdates = ref([
  { id: 1, icon: '🔄', title: '用户数据已同步更新', time: '10分钟前' },
  { id: 2, icon: '✅', title: '数据质量检测完成', time: '30分钟前' },
  { id: 3, icon: '📤', title: '数据分发任务已执行', time: '1小时前' },
  { id: 4, icon: '🔔', title: '新公告发布', time: '2小时前' }
])

const quickLinks = ref([
  { name: '数据字典', icon: '📖', path: '/user/data/dict' },
  { name: '编码规则', icon: '🔢', path: '/user/data/coderule' },
  { name: '质量报告', icon: '📝', path: '/user/report/quality' },
  { name: '系统帮助', icon: '❓', path: '/user/help' }
])

const chartData = ref([
  { label: '周一', value: 65, count: 234 },
  { label: '周二', value: 78, count: 289 },
  { label: '周三', value: 82, count: 305 },
  { label: '周四', value: 71, count: 264 },
  { label: '周五', value: 85, count: 317 },
  { label: '周六', value: 45, count: 167 },
  { label: '周日', value: 38, count: 142 }
])

const goToDataQuery = () => {
  router.push('/user/data')
}

const goToReport = () => {
  router.push('/user/report')
}

onMounted(() => {})
</script>

<style scoped>
.user-home {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #238636 0%, #2ea043 100%);
  border-radius: 16px;
  padding: 30px 40px;
  color: #fff;
  margin-bottom: 24px;
}

.welcome-content h1 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 8px;
}

.welcome-content p {
  font-size: 14px;
  opacity: 0.8;
  margin: 0;
}

.quick-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn.primary {
  background: #fff;
  color: #238636;
  border-color: #fff;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.btn-icon {
  font-size: 18px;
}

.stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(35, 134, 54, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}

.stat-info {
  flex: 1;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.stat-label {
  font-size: 13px;
  color: #a0aec0;
  margin: 4px 0 0;
}

.stat-trend {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 12px;
}

.stat-trend.up {
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
}

.stat-trend.down {
  background: rgba(218, 54, 51, 0.1);
  color: #da3633;
}

.main-content {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 20px;
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.view-all {
  font-size: 13px;
  color: #238636;
  background: none;
  border: none;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
}

.view-all:hover {
  background: rgba(35, 134, 54, 0.1);
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.data-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.2s;
}

.data-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
}

.card-content {
  flex: 1;
}

.card-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 6px;
}

.card-content p {
  font-size: 13px;
  color: #a0aec0;
  margin: 0 0 10px;
}

.card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #a0aec0;
}

.card-action {
  padding: 8px 16px;
  background: rgba(35, 134, 54, 0.1);
  color: #238636;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.card-action:hover {
  background: #238636;
  color: #fff;
}

.side-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.panel-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
  margin: 0;
}

.update-list {
  padding: 8px;
}

.update-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.update-item:hover {
  background: #f8fafc;
}

.update-icon {
  font-size: 18px;
}

.update-content {
  flex: 1;
}

.update-title {
  display: block;
  font-size: 13px;
  color: #2d3748;
  margin-bottom: 2px;
}

.update-time {
  font-size: 11px;
  color: #a0aec0;
}

.link-list {
  padding: 8px;
}

.link-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  text-decoration: none;
  color: #4a5568;
  font-size: 14px;
  border-radius: 8px;
  transition: background 0.2s;
}

.link-item:hover {
  background: #f8fafc;
  color: #238636;
}

.link-icon {
  font-size: 16px;
}

.chart-section {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.time-select {
  padding: 6px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 13px;
  color: #4a5568;
  background: #fff;
  cursor: pointer;
}

.chart-container {
  padding-top: 20px;
}

.chart-bars {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  height: 200px;
  padding: 0 20px;
}

.bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar {
  width: 40px;
  background: linear-gradient(180deg, #238636 0%, #2ea043 100%);
  border-radius: 8px 8px 0 0;
  position: relative;
  transition: height 0.3s ease;
}

.bar-value {
  position: absolute;
  top: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #4a5568;
  font-weight: 500;
}

.bar-label {
  font-size: 12px;
  color: #a0aec0;
  margin-top: 8px;
}
</style>