<template>
  <section class="growth-page">
    <header class="page-head"><div><small>GROWTH & SERVICE</small><h1>营销与售后</h1><p>平台活动、分享素材、渠道佣金和客户售后统一在这里处理。</p></div><el-button @click="load">刷新数据</el-button></header>
    <div class="metrics">
      <article><span>可领优惠券</span><b>{{ data.marketing?.coupons?.length || 0 }}</b><small>平台统一活动</small></article>
      <article><span>佣金记录</span><b>{{ data.commissions?.length || 0 }}</b><small>订单确认后生成</small></article>
      <article><span>待处理售后</span><b>{{ pendingAfterSales }}</b><small>及时响应客户</small></article>
      <article><span>累计佣金</span><b>{{ money(commissionTotal) }}</b><small>平台自动计算</small></article>
    </div>
    <div class="grid">
      <section class="card">
        <header><h2>平台营销活动</h2><span>可直接用于社群推广</span></header>
        <div v-for="item in data.marketing?.flashSales || []" :key="`f${item.id}`" class="campaign"><span>⚡</span><div><b>{{ item.productName }}</b><small>限时秒杀 ¥{{ item.salePrice }}</small></div><el-tag type="danger">秒杀</el-tag></div>
        <div v-for="item in data.marketing?.groupBuys || []" :key="`g${item.id}`" class="campaign"><span>👥</span><div><b>{{ item.name }}</b><small>{{ item.groupSize }} 人团 ¥{{ item.groupPrice }}</small></div><el-tag type="success">拼团</el-tag></div>
        <div class="share"><el-input v-model="shareText" type="textarea" :rows="4" readonly/><el-button type="primary" @click="copyShare">复制推广文案</el-button></div>
      </section>
      <section class="card">
        <header><h2>佣金记录</h2><span>销售转化自动分润</span></header>
        <div v-for="item in data.commissions || []" :key="item.id" class="list-row"><div><b>订单 {{ item.orderId }}</b><small>{{ item.createTime }}</small></div><strong>{{ money(item.amount) }}</strong><el-tag :type="item.status === 'SETTLED' ? 'success' : 'warning'">{{ item.status === 'SETTLED' ? '已结算' : '待结算' }}</el-tag></div>
        <el-empty v-if="!(data.commissions || []).length" description="暂无佣金记录" />
      </section>
    </div>
    <section class="card">
      <header><h2>渠道售后协同</h2><span>来自你销售订单的售后申请</span></header>
      <div v-for="item in data.afterSales || []" :key="item.id" class="service-row"><div><b>{{ item.type }} · 订单 {{ item.orderId }}</b><small>{{ item.reason }}</small></div><strong>{{ money(item.amount) }}</strong><el-tag :type="item.status === 'PENDING' ? 'warning' : 'success'">{{ item.status === 'PENDING' ? '平台处理中' : '已处理' }}</el-tag></div>
      <el-empty v-if="!(data.afterSales || []).length" description="暂无售后申请" />
    </section>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { channelApi } from '../api'
import { currentChannelId } from '../api/channelSession'

const data = ref({})
const shareText = ref('丰链云产地直发：五常大米限时秒杀 ¥58，邻里 3 人成团更优惠。点击进入我的小店查看。')
const pendingAfterSales = computed(() => (data.value.afterSales || []).filter((item) => item.status === 'PENDING').length)
const commissionTotal = computed(() => (data.value.commissions || []).reduce((sum, item) => sum + Number(item.amount || 0), 0))

async function load() {
  const channelId = await currentChannelId()
  if (!channelId) {
    ElMessage.warning('当前账号还没有渠道档案，请先提交渠道入驻')
    return
  }
  try {
    data.value = await channelApi.getGrowth(channelId)
  } catch (e) {
    ElMessage.error(e?.message || '增长数据读取失败')
  }
}

async function copyShare() {
  await navigator.clipboard.writeText(shareText.value)
  ElMessage.success('推广文案已复制')
}

function money(value) { return `¥${Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}` }
onMounted(load)
</script>

<style scoped>
.growth-page{display:grid;gap:16px}.page-head{display:flex;justify-content:space-between;align-items:flex-end;padding:22px;border-radius:18px;background:radial-gradient(circle at 90% 0,rgba(104,222,150,.3),transparent 30%),linear-gradient(135deg,#073821,#12764a);color:#fff}.page-head small{color:#a9d9ba;letter-spacing:.12em}.page-head h1{margin:6px 0;font-size:28px}.page-head p{color:rgba(255,255,255,.65)}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.metrics article,.card{padding:18px;border:1px solid #e1e9e3;border-radius:16px;background:#fff}.metrics span,.metrics small{display:block;color:#839188;font-size:12px}.metrics b{display:block;margin:8px 0;color:#173e2a;font-size:24px}.grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}.card header{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:12px}.card header h2{font-size:17px}.card header span{color:#87958d;font-size:12px}.campaign,.list-row,.service-row{display:grid;grid-template-columns:40px 1fr auto;align-items:center;gap:10px;padding:12px 0;border-top:1px solid #edf2ee}.campaign:first-of-type{border-top:0}.campaign>span{display:grid;width:38px;height:38px;place-items:center;border-radius:10px;background:#e9f7ef}.campaign small,.list-row small,.service-row small{display:block;margin-top:4px;color:#87958d;font-size: var(--agri-font-size-micro)}.list-row{grid-template-columns:1fr auto auto}.service-row{grid-template-columns:1fr auto auto}.share{display:grid;gap:10px;margin-top:14px;padding-top:14px;border-top:1px solid #edf2ee}.share .el-button{justify-self:end}@media(max-width:900px){.metrics,.grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.metrics,.grid{grid-template-columns:1fr}}
</style>
