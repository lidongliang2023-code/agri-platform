<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>收货地址</h1>
      <span class="sub">下单时从这里选择收货信息；设为默认后结算页会优先选中该地址</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm primary" @click="router.push('/address/new')">+ 新增收货地址</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后管理收货地址"
      desc="地址挂在商城消费者账号下，只能本人查看和修改。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 统计条 -->
      <div class="m-card sum-bar">
        <span>已保存 <b class="num">{{ rows.length }}</b> 个收货地址</span>
        <span class="m-spacer" />
        <span class="muted small">后端未限制地址数量，建议只保留常用地址，避免结算时选错</span>
      </div>

      <!-- 地址列表 -->
      <div v-if="rows.length" class="m-stack">
        <article v-for="addr in rows" :key="addr.id" class="m-card addr-card" :class="{ on: addr.isDefault }">
          <div class="addr-hd">
            <b>{{ addr.name || '未填写收货人' }}</b>
            <span class="muted num">{{ addr.phone || '未填写电话' }}</span>
            <span v-if="addr.isDefault" class="m-tag">默认</span>
            <span class="m-spacer" />
            <span class="muted small num">创建于 {{ dateTime(addr.createTime) }}</span>
          </div>

          <p class="addr-text">
            {{ [addr.province, addr.city, addr.district, addr.address].filter(Boolean).join(' ') || '地址信息不完整' }}
          </p>

          <div class="addr-ft">
            <button type="button" class="m-btn sm" @click="router.push(`/address/${addr.id}/edit`)">编辑</button>
            <button
              type="button"
              class="m-btn sm"
              :disabled="addr.isDefault || busyId === addr.id"
              @click="setDefault(addr)"
            >
              {{ addr.isDefault ? '已是默认' : '设为默认' }}
            </button>
            <button type="button" class="m-btn sm" :disabled="busyId === addr.id" @click="remove(addr)">删除</button>
          </div>
        </article>
      </div>

      <EmptyBlock
        v-else-if="!loading"
        icon="📍"
        title="还没有收货地址"
        desc="地址由你主动新增，平台不会自动生成。没有地址时无法提交订单，请先添加一个收货地址。"
      >
        <template #actions>
          <button type="button" class="m-btn primary" @click="router.push('/address/new')">+ 新增收货地址</button>
        </template>
      </EmptyBlock>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { dateTime } from '../utils/format'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const busyId = ref('')
const rows = ref([])

const consumerId = computed(() => userStore.consumerId)

/**
 * 提交给后端的字段白名单：只带地址本身的字段。
 * 不能整条回传 —— 接口里的 createTime 是字符串，回传会触发时间反序列化失败，
 * 也不该把 status 一起写回去（删除是软删，由后端维护）。
 */
function payloadOf(addr, isDefault) {
  return {
    id: addr.id,
    consumerId: consumerId.value,
    name: addr.name,
    phone: addr.phone,
    province: addr.province,
    city: addr.city,
    district: addr.district,
    address: addr.address,
    isDefault,
  }
}

async function load() {
  if (!consumerId.value) {
    rows.value = []
    return
  }
  loading.value = true
  try {
    rows.value = (await consumerApi.getAddresses(consumerId.value)) || []
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '收货地址加载失败')
  } finally {
    loading.value = false
  }
}

/** 设为默认：后端会把其它地址的 isDefault 置 false，回读后逐条核对，不轻信写接口返回值。 */
async function setDefault(addr) {
  if (addr.isDefault || busyId.value) return
  busyId.value = addr.id
  try {
    const res = await consumerApi.updateAddress(payloadOf(addr, true))
    if (res?.success === false) {
      ElMessage.error(res.message || '设置默认地址失败')
      await load()
      return
    }
    await load()
    const target = rows.value.find((item) => String(item.id) === String(addr.id))
    const others = rows.value.filter((item) => String(item.id) !== String(addr.id))
    if (target?.isDefault && others.every((item) => !item.isDefault)) {
      ElMessage.success('已设为默认地址')
    } else {
      ElMessage.error('默认地址未生效，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '设置默认地址失败')
    await load()
  } finally {
    busyId.value = ''
  }
}

/** 删除：软删除后回读列表，确认条数减少且该条已消失。 */
async function remove(addr) {
  try {
    await ElMessageBox.confirm(
      `确认删除「${addr.name || '该收货人'} ${addr.phone || ''}」这条收货地址？删除后需要重新添加。`,
      '删除收货地址',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  busyId.value = addr.id
  const before = rows.value.length
  try {
    const res = await consumerApi.deleteAddress(addr.id)
    if (res?.success === false) {
      ElMessage.error(res.message || '删除失败')
      await load()
      return
    }
    await load()
    const stillThere = rows.value.some((item) => String(item.id) === String(addr.id))
    if (!stillThere && rows.value.length < before) {
      ElMessage.success('地址已删除')
    } else {
      ElMessage.error('删除未生效，请刷新后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '删除地址失败')
    await load()
  } finally {
    busyId.value = ''
  }
}

onMounted(load)

// 统一身份异步换回消费者 ID：拿到后再查地址
watch(
  () => consumerId.value,
  (id) => {
    if (id) load()
  },
)
</script>

<style scoped>
.m-container {
  width: min(1280px, calc(100% - 48px));
  margin: 18px auto 0;
}

.sum-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  padding: 12px 18px;
}

.sum-bar b {
  color: #0b1a12;
  font-size: 15px;
  font-weight: 800;
}

.addr-card {
  padding: 16px 20px;
  transition: border-color .15s, box-shadow .15s;
}

.addr-card:hover {
  border-color: #d4e7db;
  box-shadow: 0 8px 22px rgba(4, 31, 20, .05);
}

.addr-card.on {
  border-color: #bfe0cd;
  background: linear-gradient(120deg, #f6fcf9, #fff 55%);
}

.addr-hd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.addr-hd b {
  font-size: 15px;
  font-weight: 700;
}

.addr-text {
  margin: 8px 0 12px;
  color: #33453b;
  font-size: 13.5px;
  line-height: 1.8;
}

.addr-ft {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px dashed #eef3ef;
}
</style>
