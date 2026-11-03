<template>
  <div class="recruit-page">
    <div class="page-head">
      <div>
        <h2>分销商招募</h2>
        <p>生成邀请码给渠道商；渠道带码入驻后在此形成招募关系，平台审核通过后状态同步。合同与佣金仍由平台统一规则管理。</p>
      </div>
      <div class="head-actions">
        <el-button @click="load">刷新</el-button>
        <el-button type="primary" @click="createVisible = true">生成邀请码</el-button>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><h3>我的邀请码</h3><span class="muted">渠道入驻时填写邀请码即绑定招募关系</span></div>
      <el-table :data="invites" border>
        <el-table-column prop="code" label="邀请码" width="180" />
        <el-table-column label="使用情况" width="140">
          <template #default="{ row }">{{ row.usedCount || 0 }} / {{ row.channelLimit > 0 ? row.channelLimit : '不限' }}</template>
        </el-table-column>
        <el-table-column label="过期时间" width="180">
          <template #default="{ row }">{{ row.expireAt || '长期有效' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="copy(row.code)">复制</el-button>
            <el-button v-if="row.status === 'ACTIVE'" link type="danger" @click="changeStatus(row, 'DISABLED')">停用</el-button>
            <el-button v-else link type="success" @click="changeStatus(row, 'ACTIVE')">启用</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!invites.length" description="还没有邀请码" :image-size="60" />
    </div>

    <div class="card">
      <div class="card-head"><h3>招募到的渠道</h3><span class="muted">审核状态由平台入驻审核同步</span></div>
      <el-table :data="recruits" border>
        <el-table-column prop="channelName" label="渠道商" min-width="180" />
        <el-table-column prop="inviteCode" label="邀请码" width="180" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="row.status === 'APPROVED' ? 'success' : row.status === 'REJECTED' ? 'danger' : 'warning'">
              {{ statusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="绑定时间" width="180" />
      </el-table>
      <el-empty v-if="!recruits.length" description="还没有渠道通过邀请码入驻" :image-size="60" />
    </div>

    <el-dialog v-model="createVisible" title="生成邀请码" width="480px">
      <el-form label-width="110px">
        <el-form-item label="渠道数量上限">
          <el-input v-model="form.channelLimit" placeholder="0 或留空表示不限" />
        </el-form-item>
        <el-form-item label="过期时间">
          <el-date-picker v-model="form.expireAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" placeholder="长期有效" />
        </el-form-item>
      </el-form>
      <p class="muted">邀请码用于渠道入驻时绑定招募关系；渠道被平台驳回后使用次数会自动退回。</p>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="create">生成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { supplierApi } from '../api'

const invites = ref([])
const recruits = ref([])
const createVisible = ref(false)
const creating = ref(false)
const form = reactive({ channelLimit: '0', expireAt: '' })

onMounted(load)

async function load() {
  try {
    const [inviteRows, recruitRows] = await Promise.all([
      supplierApi.getInvites(),
      supplierApi.getRecruits(),
    ])
    invites.value = inviteRows || []
    recruits.value = recruitRows || []
  } catch (e) {
    ElMessage.error(e?.message || '招募数据读取失败')
  }
}

async function create() {
  creating.value = true
  try {
    const res = await supplierApi.createInvite({
      channelLimit: Number(form.channelLimit || 0),
      expireAt: form.expireAt || undefined,
    })
    if (res?.success === false) return ElMessage.error(res.message || '生成失败')
    ElMessage.success(`邀请码已生成：${res.code}`)
    createVisible.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '生成失败')
  } finally {
    creating.value = false
  }
}

async function changeStatus(row, status) {
  try {
    const res = await supplierApi.updateInviteStatus(row.id, status)
    if (res?.success === false) return ElMessage.error(res.message || '操作失败')
    ElMessage.success(status === 'ACTIVE' ? '已启用' : '已停用')
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '操作失败')
  }
}

async function copy(code) {
  try {
    await navigator.clipboard.writeText(code)
    ElMessage.success('邀请码已复制')
  } catch {
    ElMessage.warning('浏览器未授权剪贴板，请手动复制')
  }
}

const statusText = (value) => ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回' }[value] || value)
</script>

<style scoped>
.recruit-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 820px; }
.head-actions { display: flex; gap: 8px; }
.card { padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.card-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-head h3 { margin: 0; font-size: 15px; }
.muted { color: #84938a; font-size: 12px; }
</style>
