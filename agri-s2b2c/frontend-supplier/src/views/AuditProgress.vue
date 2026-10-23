<template>
  <div class="audit-progress-page">
    <div class="progress-card">
      <h2>审核进度</h2>
      <el-timeline>
        <el-timeline-item
          v-for="(item, index) in steps"
          :key="index"
          :icon="item.icon"
          :type="item.type"
          :color="item.color"
        >
          <div class="step-content">
            <h3>{{ item.title }}</h3>
            <p>{{ item.desc }}</p>
            <span v-if="item.time" class="step-time">{{ item.time }}</span>
          </div>
        </el-timeline-item>
      </el-timeline>
      <div class="audit-opinion" v-if="auditStatus === 'REJECTED' && auditOpinion">
        <h3>审核意见</h3>
        <p>{{ auditOpinion }}</p>
        <el-button type="primary" @click="reapply">重新申请</el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supplierApi } from '../api'

const router = useRouter()

const auditStatus = ref('PENDING')
const auditOpinion = ref('')
const auditTime = ref('')

const steps = ref([])

const initSteps = () => {
  const baseSteps = [
    { title: '提交申请', desc: '供应商提交入驻申请', icon: 'Document', type: 'success', color: '#67c23a', time: '2025-01-15 10:30' },
    { title: '资质审核', desc: '平台审核供应商资质信息', icon: 'User', type: '', color: '', time: '' },
    { title: '产品审核', desc: '审核商品信息及图片', icon: 'Goods', type: '', color: '', time: '' },
    { title: '审核通过', desc: '入驻成功，可正常经营', icon: 'CircleCheck', type: '', color: '', time: '' }
  ]

  if (auditStatus.value === 'APPROVED') {
    baseSteps[1].type = 'success'
    baseSteps[1].color = '#67c23a'
    baseSteps[1].time = '2025-01-15 14:00'
    baseSteps[2].type = 'success'
    baseSteps[2].color = '#67c23a'
    baseSteps[2].time = '2025-01-15 16:00'
    baseSteps[3].type = 'success'
    baseSteps[3].color = '#67c23a'
    baseSteps[3].time = '2025-01-15 16:30'
  } else if (auditStatus.value === 'PENDING') {
    baseSteps[1].type = 'primary'
    baseSteps[1].color = '#409eff'
  } else if (auditStatus.value === 'REJECTED') {
    baseSteps[1].type = 'danger'
    baseSteps[1].color = '#f56c6c'
    baseSteps[1].time = '2025-01-15 14:00'
  }

  steps.value = baseSteps
}

onMounted(() => {
  loadAuditInfo()
})

const loadAuditInfo = async () => {
  const res = await supplierApi.getDetail(1)
  auditStatus.value = res.auditStatus
  auditOpinion.value = res.auditOpinion
  auditTime.value = res.auditTime
  initSteps()
}

const reapply = () => {
  router.push('/apply')
}
</script>

<style scoped>
.audit-progress-page {
  display: flex;
  justify-content: center;
}

.progress-card {
  width: 600px;
  background: #fff;
  border-radius: 12px;
  padding: 30px;
}

.progress-card h2 {
  text-align: center;
  margin-bottom: 30px;
}

.step-content {
  margin-left: 15px;
}

.step-content h3 {
  font-size: 16px;
  margin-bottom: 5px;
}

.step-content p {
  font-size: 14px;
  color: #999;
}

.step-time {
  font-size: 12px;
  color: #999;
}

.audit-opinion {
  margin-top: 30px;
  padding: 20px;
  background: #fef0f0;
  border-radius: 8px;
}

.audit-opinion h3 {
  font-size: 16px;
  color: #f56c6c;
  margin-bottom: 10px;
}

.audit-opinion p {
  font-size: 14px;
  color: #666;
}
</style>