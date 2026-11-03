<template>
  <div class="activity-create-page">
    <div class="page-head">
      <div>
        <h2>创建营销活动</h2>
        <p>支持优惠券、秒杀与拼团的创建、预算与费用承担；预算扣减在核销/下单时原子执行，审批流与 ROI 归因尚未建模。</p>
      </div>
      <el-button @click="$router.push('/activities')">返回活动列表</el-button>
    </div>

    <el-tabs v-model="tab">
      <el-tab-pane label="优惠券" name="coupon">
        <el-form label-width="120px" class="form-card">
          <el-form-item label="名称" required><el-input v-model="coupon.name" maxlength="100" /></el-form-item>
          <el-form-item label="类型">
            <el-radio-group v-model="coupon.type">
              <el-radio value="FIXED">满减券</el-radio>
              <el-radio value="DISCOUNT">折扣券</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="coupon.type === 'FIXED'" label="面额(元)" required>
            <el-input v-model="coupon.amount" placeholder="如 10" />
          </el-form-item>
          <el-form-item v-else label="折扣" required>
            <el-input v-model="coupon.discountRate" placeholder="大于 0 且小于 10，如 9.5 表示 95 折" />
          </el-form-item>
          <el-form-item label="使用门槛(元)"><el-input v-model="coupon.minAmount" placeholder="0 表示无门槛" /></el-form-item>
          <el-form-item label="发行量"><el-input v-model="coupon.totalCount" /></el-form-item>
          <el-form-item label="每人限领"><el-input v-model="coupon.perUserLimit" /></el-form-item>
          <el-form-item label="活动预算(元)"><el-input v-model="coupon.budget" placeholder="留空表示不限" /></el-form-item>
          <el-form-item label="费用承担方">
            <el-select v-model="coupon.costBearer" style="width: 200px">
              <el-option label="平台承担" value="PLATFORM" />
              <el-option label="供应商承担" value="SUPPLIER" />
              <el-option label="渠道承担" value="CHANNEL" />
            </el-select>
          </el-form-item>
          <el-form-item label="有效期">
            <el-date-picker v-model="coupon.validStart" type="date" value-format="YYYY-MM-DD" placeholder="开始" />
            <span class="range-sep">至</span>
            <el-date-picker v-model="coupon.validEnd" type="date" value-format="YYYY-MM-DD" placeholder="结束" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submitCoupon">创建优惠券</el-button>
          </el-form-item>
        </el-form>
        <p class="note">预算按核销优惠金额扣减；预算用完时不能再领取或核销。费用承担方仅做记录，不自动生成结算单。</p>
      </el-tab-pane>

      <el-tab-pane label="秒杀" name="flash">
        <el-form label-width="120px" class="form-card">
          <el-form-item label="商品" required>
            <el-select v-model="flash.productId" filterable placeholder="选择已审核商品" style="width: 100%" @change="onFlashProduct">
              <el-option v-for="item in products" :key="item.id" :label="`${item.name}（现价 ¥${money(item.price)}）`" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="秒杀价(元)" required><el-input v-model="flash.salePrice" /></el-form-item>
          <el-form-item label="活动库存" required><el-input v-model="flash.totalStock" /></el-form-item>
          <el-form-item label="每人限购"><el-input v-model="flash.perUserLimit" /></el-form-item>
          <el-form-item label="活动预算(元)"><el-input v-model="flash.budget" placeholder="留空表示不限" /></el-form-item>
          <el-form-item label="费用承担方">
            <el-select v-model="flash.costBearer" style="width: 200px">
              <el-option label="平台承担" value="PLATFORM" />
              <el-option label="供应商承担" value="SUPPLIER" />
              <el-option label="渠道承担" value="CHANNEL" />
            </el-select>
          </el-form-item>
          <el-form-item label="开始时间">
            <el-date-picker v-model="flash.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="开始" />
          </el-form-item>
          <el-form-item label="结束时间">
            <el-date-picker v-model="flash.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="结束" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submitFlash">创建秒杀</el-button>
          </el-form-item>
        </el-form>
        <p class="note">秒杀价必须低于商品现价；库存以活动库存独立扣减，售罄后自动不可用。预算不足时按原价成交，不阻断下单。</p>
      </el-tab-pane>

      <el-tab-pane label="拼团" name="group">
        <el-form label-width="120px" class="form-card">
          <el-form-item label="活动名称" required><el-input v-model="group.name" maxlength="100" /></el-form-item>
          <el-form-item label="商品" required>
            <el-select v-model="group.productId" filterable placeholder="选择已审核商品" style="width: 100%" @change="onGroupProduct">
              <el-option v-for="item in products" :key="item.id" :label="`${item.name}（现价 ¥${money(item.price)}）`" :value="item.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="单买价(元)" required><el-input v-model="group.singlePrice" /></el-form-item>
          <el-form-item label="拼团价(元)" required><el-input v-model="group.groupPrice" /></el-form-item>
          <el-form-item label="团长价(元)"><el-input v-model="group.leaderPrice" placeholder="选填，不高于拼团价" /></el-form-item>
          <el-form-item label="成团人数">
            <el-select v-model="group.groupSize" style="width: 160px">
              <el-option v-for="n in [2, 3, 5, 10]" :key="n" :label="`${n} 人团`" :value="n" />
            </el-select>
          </el-form-item>
          <el-form-item label="成团有效期"><el-input v-model="group.validHours" placeholder="1-168 小时" /></el-form-item>
          <el-form-item label="每人限购"><el-input v-model="group.perUserLimit" /></el-form-item>
          <el-form-item label="活动预算(元)"><el-input v-model="group.budget" placeholder="留空表示不限" /></el-form-item>
          <el-form-item label="费用承担方">
            <el-select v-model="group.costBearer" style="width: 200px">
              <el-option label="平台承担" value="PLATFORM" />
              <el-option label="供应商承担" value="SUPPLIER" />
              <el-option label="渠道承担" value="CHANNEL" />
            </el-select>
          </el-form-item>
          <el-form-item label="活动时间">
            <el-date-picker v-model="group.startTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="开始" />
            <span class="range-sep">至</span>
            <el-date-picker v-model="group.endTime" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="结束" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="submitting" @click="submitGroup">创建拼团</el-button>
          </el-form-item>
        </el-form>
        <p class="note">拼团价必须低于单买价，成团人数 2-10；超时未成团由消费者端退款流程处理（本系统未接支付退款）。预算用完时不能继续参团。</p>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { platformApi } from '../api'

const router = useRouter()
const tab = ref('coupon')
const submitting = ref(false)
const products = ref([])

const pad = (n) => String(n).padStart(2, '0')
const today = new Date()
const dateStr = (offset = 0) => {
  const d = new Date(today.getTime() + offset * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dateTimeStr = (offsetHours = 0) => {
  const d = new Date(today.getTime() + offsetHours * 3600000)
  return `${dateStr(0)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

const coupon = reactive({
  name: '', type: 'FIXED', amount: '', discountRate: '', minAmount: '0',
  totalCount: '1000', perUserLimit: '1', budget: '', costBearer: 'PLATFORM',
  validStart: dateStr(0), validEnd: dateStr(30),
})
const flash = reactive({
  productId: '', salePrice: '', totalStock: '50', perUserLimit: '1', budget: '', costBearer: 'PLATFORM',
  startTime: dateTimeStr(-1), endTime: dateTimeStr(24),
})
const group = reactive({
  name: '', productId: '', singlePrice: '', groupPrice: '', leaderPrice: '', groupSize: 3,
  validHours: '24', perUserLimit: '1', budget: '', costBearer: 'PLATFORM',
  startTime: dateTimeStr(-1), endTime: dateTimeStr(24),
})

onMounted(async () => {
  try {
    const res = await platformApi.getProducts({ page: 1, size: 100, status: 'APPROVED' })
    products.value = res.records || []
  } catch {
    products.value = []
  }
})

function onFlashProduct() {
  const product = products.value.find((item) => String(item.id) === String(flash.productId))
  if (product && !flash.salePrice) {
    flash.salePrice = (Number(product.price) * 0.9).toFixed(2)
  }
}

function onGroupProduct() {
  const product = products.value.find((item) => String(item.id) === String(group.productId))
  if (product) {
    group.singlePrice = String(product.price)
    if (!group.groupPrice) group.groupPrice = (Number(product.price) * 0.85).toFixed(2)
    if (!group.name) group.name = `${product.name} 拼团`
  }
}

async function submitCoupon() {
  if (!coupon.name.trim()) return ElMessage.warning('请填写优惠券名称')
  submitting.value = true
  try {
    const res = await platformApi.createCoupon({ ...coupon })
    if (res?.success === false) return ElMessage.error(res.message || '创建失败')
    ElMessage.success(`优惠券已创建（${res.id}）`)
    router.push('/activities')
  } catch (e) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function submitFlash() {
  if (!flash.productId) return ElMessage.warning('请选择商品')
  submitting.value = true
  try {
    const res = await platformApi.createFlashSale({ ...flash })
    if (res?.success === false) return ElMessage.error(res.message || '创建失败')
    ElMessage.success(`秒杀活动已创建（${res.id}）`)
    router.push('/activities')
  } catch (e) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

async function submitGroup() {
  if (!group.name.trim() || !group.productId) return ElMessage.warning('请填写活动名称并选择商品')
  submitting.value = true
  try {
    const res = await platformApi.createGroupBuy({ ...group })
    if (res?.success === false) return ElMessage.error(res.message || '创建失败')
    ElMessage.success(`拼团活动已创建（${res.id}）`)
    router.push('/activities')
  } catch (e) {
    ElMessage.error(e?.message || '创建失败')
  } finally {
    submitting.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)
</script>

<style scoped>
.activity-create-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 800px; }
.form-card { max-width: 720px; padding: 20px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.range-sep { margin: 0 8px; color: #84938a; font-size: 12px; }
.note { margin: 12px 0 0; color: #84938a; font-size: 12px; line-height: 1.7; }
</style>
