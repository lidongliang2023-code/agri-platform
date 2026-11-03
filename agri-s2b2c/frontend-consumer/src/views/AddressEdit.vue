<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>{{ isEdit ? '编辑收货地址' : '新增收货地址' }}</h1>
      <span class="sub">
        {{ isEdit ? '修改后请确认信息无误，保存会回读地址列表校验是否真的落库' : '新增的地址会立即出现在地址列表与结算页的地址选择里' }}
      </span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/addresses')">地址列表 ›</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后才能维护收货地址"
      desc="地址挂在商城消费者账号下。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <!-- 编辑态但地址不存在 -->
    <EmptyBlock
      v-else-if="isEdit && notFound"
      icon="📍"
      title="收货地址不存在或已删除"
      desc="该地址可能已被删除，或者不属于当前账号。请返回地址列表重新选择。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/addresses')">返回地址列表</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <section class="m-card m-card-pad">
        <div class="m-form-grid">
          <!-- 收货人 -->
          <div class="m-field">
            <label for="addr-name">收货人 <span class="req">*</span></label>
            <el-input
              id="addr-name"
              v-model="form.name"
              maxlength="20"
              show-word-limit
              placeholder="请填写收货人姓名"
            />
            <span v-if="errors.name" class="err">{{ errors.name }}</span>
            <span v-else class="hint">最多 20 个字，建议填写真实姓名</span>
          </div>

          <!-- 手机号 -->
          <div class="m-field">
            <label for="addr-phone">手机号 <span class="req">*</span></label>
            <el-input id="addr-phone" v-model="form.phone" maxlength="11" placeholder="请填写 11 位手机号" />
            <span v-if="errors.phone" class="err">{{ errors.phone }}</span>
            <span v-else class="hint">配送员联系用，填错会导致无法派送</span>
          </div>

          <!-- 省市区：后端地址表就是三个独立字段，直接手填，本端没有可用的地域接口 -->
          <div class="m-field">
            <label for="addr-province">省份 <span class="req">*</span></label>
            <el-input id="addr-province" v-model="form.province" maxlength="50" placeholder="如：浙江省" />
            <span v-if="errors.province" class="err">{{ errors.province }}</span>
          </div>

          <div class="m-field">
            <label for="addr-city">城市 <span class="req">*</span></label>
            <el-input id="addr-city" v-model="form.city" maxlength="50" placeholder="如：杭州市" />
            <span v-if="errors.city" class="err">{{ errors.city }}</span>
          </div>

          <div class="m-field">
            <label for="addr-district">区 / 县 <span class="req">*</span></label>
            <el-input id="addr-district" v-model="form.district" maxlength="50" placeholder="如：西湖区" />
            <span v-if="errors.district" class="err">{{ errors.district }}</span>
          </div>

          <!-- 详细地址 -->
          <div class="m-field full">
            <label for="addr-detail">详细地址 <span class="req">*</span></label>
            <el-input
              id="addr-detail"
              v-model="form.address"
              type="textarea"
              :rows="3"
              maxlength="100"
              show-word-limit
              placeholder="街道、门牌号、楼栋室号，如：文三路 100 号 XX 大厦 12 楼 1201 室"
            />
            <span v-if="errors.address" class="err">{{ errors.address }}</span>
            <span v-else class="hint">最多 100 个字，写到门牌号可以减少配送电话确认</span>
          </div>

          <!-- 默认地址 -->
          <div class="m-field full">
            <label>设为默认地址</label>
            <div class="m-row">
              <el-switch v-model="form.isDefault" />
              <span class="muted small">开启后，其它地址的默认标记会被自动取消（由后端统一处理）</span>
            </div>
          </div>
        </div>
      </section>

      <p class="note muted small">
        省 / 市 / 区为三个独立文本字段，本端没有接入行政区划选择接口，请按「省 + 市 + 区 + 详细地址」的习惯填写；
        下单时按该顺序拼接后随订单提交。
      </p>

      <!-- 底部固定操作条 -->
      <div class="action-bar">
        <button type="button" class="m-btn" :disabled="saving" @click="cancel">取消</button>
        <button type="button" class="m-btn primary" :disabled="saving" @click="save">
          {{ saving ? '保存中…' : isEdit ? '保存修改' : '保存地址' }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import EmptyBlock from '../components/EmptyBlock.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const consumerId = computed(() => userStore.consumerId)
const isEdit = computed(() => Boolean(route.params.id))
const fromConfirm = computed(() => route.query.from === 'confirm')

const loading = ref(false)
const saving = ref(false)
const notFound = ref(false)

const form = reactive({
  name: '',
  phone: '',
  province: '',
  city: '',
  district: '',
  address: '',
  isDefault: false,
})

const errors = reactive({ name: '', phone: '', province: '', city: '', district: '', address: '' })

function resetErrors() {
  Object.keys(errors).forEach((key) => {
    errors[key] = ''
  })
}

/** 前端校验只做「必填 + 格式 + 长度」，长度上限与后端 VARCHAR 保持一致。 */
function validate() {
  resetErrors()
  const name = form.name.trim()
  const phone = form.phone.trim()

  if (!name) errors.name = '请填写收货人姓名'
  else if (name.length > 20) errors.name = '收货人姓名最多 20 个字'

  if (!phone) errors.phone = '请填写手机号'
  else if (!/^1[3-9]\d{9}$/.test(phone)) errors.phone = '手机号格式不正确，请填写 11 位大陆手机号'

  if (!form.province.trim()) errors.province = '请填写省份'
  if (!form.city.trim()) errors.city = '请填写城市'
  if (!form.district.trim()) errors.district = '请填写区 / 县'

  const detail = form.address.trim()
  if (!detail) errors.address = '请填写详细地址'
  else if (detail.length > 100) errors.address = '详细地址最多 100 个字'

  return !Object.values(errors).some(Boolean)
}

/** 提交字段白名单：不带 createTime / status，避免时间反序列化失败和误改软删状态。 */
function payload() {
  return {
    consumerId: consumerId.value,
    name: form.name.trim(),
    phone: form.phone.trim(),
    province: form.province.trim(),
    city: form.city.trim(),
    district: form.district.trim(),
    address: form.address.trim(),
    isDefault: Boolean(form.isDefault),
  }
}

function fillForm(target) {
  form.name = target.name || ''
  form.phone = target.phone || ''
  form.province = target.province || ''
  form.city = target.city || ''
  form.district = target.district || ''
  form.address = target.address || ''
  form.isDefault = Boolean(target.isDefault)
}

/** 编辑态回填：地址接口没有单条查询，只能取列表后按 id 匹配。 */
async function loadDetail() {
  if (!consumerId.value) return
  if (!isEdit.value) {
    notFound.value = false
    return
  }
  loading.value = true
  notFound.value = false
  try {
    const rows = (await consumerApi.getAddresses(consumerId.value)) || []
    const target = rows.find((item) => String(item.id) === String(route.params.id))
    if (!target) {
      notFound.value = true
      return
    }
    fillForm(target)
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '地址加载失败')
  } finally {
    loading.value = false
  }
}

/** 回读校验：编辑看该 id 的字段是否与提交一致，新增看列表里是否多出一条内容完全一致的记录。 */
async function verifySaved(submitted, beforeIds) {
  const rows = (await consumerApi.getAddresses(consumerId.value)) || []
  if (isEdit.value) {
    const target = rows.find((item) => String(item.id) === String(route.params.id))
    if (!target) return false
    return (
      target.name === submitted.name &&
      target.phone === submitted.phone &&
      target.province === submitted.province &&
      target.city === submitted.city &&
      target.district === submitted.district &&
      target.address === submitted.address &&
      Boolean(target.isDefault) === submitted.isDefault
    )
  }
  return rows.some(
    (item) =>
      !beforeIds.has(String(item.id)) &&
      item.name === submitted.name &&
      item.phone === submitted.phone &&
      item.province === submitted.province &&
      item.city === submitted.city &&
      item.district === submitted.district &&
      item.address === submitted.address,
  )
}

async function save() {
  if (saving.value) return
  if (!consumerId.value) {
    ElMessage.warning('登录后才能保存地址')
    return
  }
  if (!validate()) {
    ElMessage.warning('请先补全标红的必填项')
    return
  }

  saving.value = true
  try {
    // 新增前记下已有 id，回读时用来判断"确实多了一条新记录"
    let beforeIds = new Set()
    if (!isEdit.value) {
      const before = (await consumerApi.getAddresses(consumerId.value).catch(() => [])) || []
      beforeIds = new Set(before.map((item) => String(item.id)))
    }

    const data = payload()
    const res = isEdit.value
      ? await consumerApi.updateAddress({ ...data, id: route.params.id })
      : await consumerApi.addAddress(data)

    if (res?.success === false) {
      ElMessage.error(res.message || '地址保存失败')
      return
    }

    const ok = await verifySaved(data, beforeIds).catch(() => false)
    if (!ok) {
      ElMessage.error('保存后回读未查到该地址，请检查地址列表或重新保存')
      return
    }

    ElMessage.success(isEdit.value ? '地址已更新' : '地址已添加')
    if (fromConfirm.value) {
      router.replace('/order/confirm')
    } else if (window.history.state?.back) {
      router.back()
    } else {
      router.push('/addresses')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '地址保存失败')
  } finally {
    saving.value = false
  }
}

function cancel() {
  if (fromConfirm.value) {
    router.replace('/order/confirm')
    return
  }
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/addresses')
  }
}

onMounted(loadDetail)

// 统一身份异步换回消费者 ID：拿到后再回填编辑数据
watch(
  () => consumerId.value,
  (id) => {
    if (id) loadDetail()
  },
)

// 同一个组件被 /address/new 与 /address/:id/edit 复用：切换路由时清空或重新回填
watch(
  () => route.params.id,
  () => {
    resetErrors()
    if (!isEdit.value) {
      form.name = ''
      form.phone = ''
      form.province = ''
      form.city = ''
      form.district = ''
      form.address = ''
      form.isDefault = false
    }
    loadDetail()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
  padding-bottom: 88px;
}

.req {
  color: #c94b4b;
}

.err {
  color: #c94b4b;
  font-size: 12px;
}

.note {
  margin: 14px 0 0;
  line-height: 1.8;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  z-index: 90;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  width: 100%;
  padding: 12px max(24px, calc((100% - 1280px) / 2 + 24px));
  border-top: 1px solid #e3eae5;
  background: rgba(255, 255, 255, .96);
  backdrop-filter: blur(6px);
}

.action-bar .m-btn {
  height: 38px;
  padding: 0 24px;
}
</style>
