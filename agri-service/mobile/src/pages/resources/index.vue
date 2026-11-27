<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onPullDownRefresh, onShow } from '@dcloudio/uni-app'
import { serviceApi, type Expert, type ServiceResource } from '../../api'

const tab = ref<'land' | 'labor' | 'legal'>('land')
const resources = ref<ServiceResource[]>([])
const experts = ref<Expert[]>([])
const identityName = ref('')
const loading = ref(false)
const error = ref('')
const publishOpen = ref(false)
const submitting = ref(false)
const question = ref('')
const form = reactive({ resourceType: 'land', title: '', location: '', areaMu: '', price: '', unit: '元/亩/年', description: '', contactPhone: '' })
const landList = computed(() => resources.value.filter((item) => item.resourceType === 'land'))
const laborList = computed(() => resources.value.filter((item) => item.resourceType === 'labor'))
const lawyer = computed(() => experts.value.find((item) => item.category === '法律咨询'))

onShow(load)
onPullDownRefresh(async () => { await load(); uni.stopPullDownRefresh() })

async function load() {
  if (loading.value) return
  loading.value = true
  error.value = ''
  try {
    const [rows, roster, identity] = await Promise.all([serviceApi.resources(), serviceApi.experts(), serviceApi.identity().catch(() => null)])
    resources.value = rows
    experts.value = roster
    identityName.value = identity?.merchantName || ''
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : '资源数据暂不可用'
  } finally { loading.value = false }
}

function chooseTab(value: 'land' | 'labor' | 'legal') {
  tab.value = value
  if (value !== 'legal') {
    form.resourceType = value
    form.unit = value === 'labor' ? '元/人/天' : '元/亩/年'
  }
}

function openPublish() {
  form.resourceType = tab.value === 'labor' ? 'labor' : 'land'
  form.title = ''; form.location = ''; form.areaMu = ''; form.price = ''; form.description = ''; form.contactPhone = ''
  form.unit = form.resourceType === 'labor' ? '元/人/天' : '元/亩/年'
  publishOpen.value = true
}

async function publish() {
  if (submitting.value) return
  if (!form.title.trim() || !form.location.trim() || !form.price || !form.contactPhone.trim()) {
    uni.showToast({ title: '请补全标题、所在地、价格和电话', icon: 'none' }); return
  }
  if (!/^1[3-9]\d{9}$/.test(form.contactPhone)) {
    uni.showToast({ title: '请填写 11 位联系电话', icon: 'none' }); return
  }
  submitting.value = true
  try {
    const result = await serviceApi.createResource({ ...form, areaMu: form.areaMu ? Number(form.areaMu) : 0, price: Number(form.price) })
    publishOpen.value = false
    uni.showToast({ title: `资源已发布：${result.title}`, icon: 'success' })
    await load()
  } catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '发布失败', icon: 'none' }) }
  finally { submitting.value = false }
}

function goDemand() { uni.navigateTo({ url: '/pages/demand/publish' }) }

async function askLegal() {
  if (!lawyer.value) { uni.showToast({ title: '当前没有在册律师', icon: 'none' }); return }
  if (!question.value.trim()) { uni.showToast({ title: '请先描述法律问题', icon: 'none' }); return }
  try {
    const result = await serviceApi.createConsultation({ type: '法律图文', expertId: lawyer.value.id, subject: question.value.trim().slice(0, 24), content: question.value.trim() })
    question.value = ''
    uni.showModal({ title: '问题已受理', content: `问诊号 ${result.consultNo} 已提交，复核结论会在消息中心通知。`, showCancel: false, success: () => load() })
  } catch (reason) { uni.showToast({ title: reason instanceof Error ? reason.message : '提交失败', icon: 'none' }) }
}
</script>

<template>
  <view class="page page-pad resources-page">
    <view class="intro card"><text class="card-title">产业资源对接</text><text class="muted">土地流转与季节性用工由经营主体自行发布，法律求助直接生成真实问诊单。</text></view>
    <view class="resource-tabs"><button :class="{ on: tab === 'land' }" @click="chooseTab('land')"><text>🌳</text><text>土地流转</text><text class="tiny">{{ landList.length }} 条在挂</text></button><button :class="{ on: tab === 'labor' }" @click="chooseTab('labor')"><text>🧑‍🌾</text><text>劳务用工</text><text class="tiny">{{ laborList.length }} 条在挂</text></button><button :class="{ on: tab === 'legal' }" @click="chooseTab('legal')"><text>⚖️</text><text>法律咨询</text><text class="tiny">{{ lawyer ? `${lawyer.name} 可接诊` : '暂无律师' }}</text></button></view>
    <button v-if="tab !== 'legal'" class="btn btn-primary btn-block publish-btn" @click="openPublish">＋ 发布{{ tab === 'land' ? '土地' : '劳务' }}资源</button>
    <view v-if="error" class="card error-state"><text>{{ error }}</text><button class="btn btn-ghost" @click="load">重新加载</button></view>
    <view v-else-if="loading" class="loading">正在加载产业资源…</view>
    <template v-else-if="tab !== 'legal'">
      <view class="section-head"><text class="card-title">{{ tab === 'land' ? '在挂地源' : '在挂工队' }}</text><text class="muted">按登录主体记录归属</text></view>
      <view v-if="!(tab === 'land' ? landList : laborList).length" class="empty"><text class="empty-icon">📭</text><text>暂未有主体发布资源</text></view>
      <view v-for="row in (tab === 'land' ? landList : laborList)" :key="row.id" class="card resource-card"><view class="between"><text class="strong">{{ row.title }}</text><text class="tag" :class="row.mine ? 'tag-green' : 'tag-blue'">{{ row.mine ? '我发布的' : row.merchantName || '其他主体' }}</text></view><text class="muted">{{ row.description || '未填写说明' }}</text><text class="tiny">📍 {{ row.location }} · {{ row.areaMu ? `${row.areaMu} 亩` : '面积待补充' }}</text><view class="between resource-foot"><text class="price">¥{{ row.price }} <text>{{ row.unit }}</text></text><text class="tiny">☎ {{ row.mine ? row.contactPhone : '联系方式已脱敏' }}</text></view><button class="btn btn-ghost btn-block" @click="goDemand">发起服务需求</button></view>
    </template>
    <view v-else class="card legal-card"><view class="section-head"><text class="card-title">{{ lawyer ? `${lawyer.name} · ${lawyer.title}` : '涉农法律咨询' }}</text><text class="tag" :class="lawyer ? 'tag-green' : 'tag-gray'">{{ lawyer ? '可接诊' : '暂无在册' }}</text></view><text class="muted">{{ lawyer ? `${lawyer.organization} · ${lawyer.summary}` : '平台录入律师档案后才能受理法律问诊。' }}</text><textarea class="textarea" v-model="question" placeholder="例如：土地流转合同没有约定到期地上作物归属，风险怎么处理？" /><button class="btn btn-primary btn-block" :disabled="!lawyer" @click="askLegal">提交法律问题</button><view class="topics"><button v-for="topic in ['土地承包到期续签','果园冻害损失责任','临时用工工伤','农机作业质量纠纷']" :key="topic" class="tag tag-gray" @click="question = topic">{{ topic }}</button></view></view>

    <view v-if="publishOpen" class="sheet-mask" @click.self="publishOpen = false"><view class="mobile-sheet"><view class="between"><text class="card-title">发布产业资源</text><text class="close" @click="publishOpen = false">×</text></view><view class="form-item"><text class="form-label">资源类型</text><picker :range="['土地流转','劳务用工']" :value="form.resourceType === 'land' ? 0 : 1" @change="form.resourceType = Number($event.detail.value) === 0 ? 'land' : 'labor'"><view class="input">{{ form.resourceType === 'land' ? '土地流转' : '劳务用工' }} ▾</view></picker></view><view class="form-item"><text class="form-label">标题</text><input class="input" v-model="form.title" placeholder="如：乔口镇连片水田 128 亩" /></view><view class="form-item"><text class="form-label">所在地</text><input class="input" v-model="form.location" placeholder="区县 + 乡镇" /></view><view class="grid-2"><view class="form-item"><text class="form-label">面积 / 人数</text><input class="input" type="digit" v-model="form.areaMu" /></view><view class="form-item"><text class="form-label">价格</text><input class="input" type="digit" v-model="form.price" /></view></view><view class="form-item"><text class="form-label">计价单位</text><input class="input" v-model="form.unit" /></view><view class="form-item"><text class="form-label">资源说明</text><textarea class="textarea" v-model="form.description" placeholder="权属、技能或可上工时间等" /></view><view class="form-item"><text class="form-label">联系电话</text><input class="input" type="number" v-model="form.contactPhone" placeholder="对外展示的联系方式" /></view><text class="tiny">发布主体：{{ identityName || '由登录令牌解析' }}</text><button class="btn btn-primary btn-block" :loading="submitting" @click="publish">提交发布</button></view></view>
  </view>
</template>

<style lang="scss" scoped>
.intro { display: flex; flex-direction: column; gap: 8rpx; }
.resource-tabs { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10rpx; margin-bottom: 16rpx; }
.resource-tabs button { display: flex; min-height: 150rpx; align-items: center; justify-content: center; flex-direction: column; gap: 7rpx; padding: 12rpx 6rpx; border: 1rpx solid #e1e9e3; border-radius: 18rpx; background: #fff; font-size: 13px; }
.resource-tabs button:first-child text:first-child { font-size: 36rpx; }
.resource-tabs button.on { border-color: #12764a; background: #edf8f0; color: #0e5233; }
.publish-btn { margin-bottom: 18rpx; }
.section-head { display: flex; align-items: baseline; justify-content: space-between; margin: 22rpx 0 14rpx; }
.resource-card { display: flex; flex-direction: column; gap: 11rpx; }
.resource-card .between:first-child > text:first-child { max-width: 67%; }
.resource-foot { padding: 6rpx 0; }
.price { color: #0e5233; font-size: 15px; font-weight: 700; }
.price text { color: #52665a; font-size: 13px; font-weight: 400; }
.legal-card { display: flex; flex-direction: column; gap: 16rpx; }
.topics { display: flex; flex-wrap: wrap; gap: 10rpx; }
.topics button { min-height: 44px; }
.error-state { display: flex; flex-direction: column; gap: 18rpx; }
.close { color: #52665a; font-size: 44rpx; }

.resource-card .between { flex-wrap: wrap; align-items: flex-start; }
.resource-card .between:first-child > text:first-child { max-width: 100%; }
.resource-card .tag { min-width: 0; max-width: 100%; }
.section-head { gap: 10px; flex-wrap: wrap; }

</style>
