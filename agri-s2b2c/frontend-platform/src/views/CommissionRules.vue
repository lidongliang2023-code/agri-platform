<template>
  <div class="commission-rules-page">
    <div class="page-head">
      <div>
        <h2>渠道等级与佣金规则</h2>
        <p>渠道订单结算时按渠道等级取这里的比例；等级由「等级考核规则」按周期内有效订单与 GMV 自动评定，未配置的等级回落到商品自带佣金率。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="ruleColumns"
      :data="rules"
      :row-key="(row) => String(row.id ?? row.grade)"
      :loading="loadingRules"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:commission-rules"
      empty-text="还没有配置佣金规则，渠道订单将使用商品自带佣金率"
      @refresh="load"
    >
      <template #toolbar-left>
        <el-button type="primary" @click="openEdit()">新增 / 修改规则</el-button>
      </template>
      <template #cell-rate="{ row }">{{ Number(row.rate) }}%</template>
      <template #cell-status="{ row }">
        <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'edit', label: '编辑', onClick: () => openEdit(row) }]" />
      </template>
    </AgriElementListTable>

    <div class="section-header">
      <div>
        <h3>等级考核规则</h3>
        <p>按近 N 天「已支付且未取消/退款」订单的订单数与 GMV 自动定级；每月 1 日 03:00 自动执行，也可手动考核。</p>
      </div>
    </div>

    <AgriElementListTable
      :columns="gradeRuleColumns"
      :data="gradeRules"
      :row-key="(row) => String(row.id ?? row.grade)"
      :loading="loadingGrades"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:grade-rules"
      empty-text="未配置考核规则，立即考核会被拒绝"
      @refresh="loadGrades"
    >
      <template #toolbar-left>
        <el-input-number v-model="evalDays" :min="1" :max="365" :precision="0" style="width: 110px" />
        <el-button type="primary" :loading="evaluating" @click="evaluate">立即考核</el-button>
        <el-button @click="openGradeEdit()">新增 / 修改门槛</el-button>
      </template>
      <template #cell-minOrders="{ row }">≥ {{ row.minOrders }}</template>
      <template #cell-minGmv="{ row }">≥ ¥{{ money(row.minGmv) }}</template>
      <template #cell-status="{ row }">
        <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">{{ row.status === 'ACTIVE' ? '启用' : '停用' }}</el-tag>
      </template>
      <template #cell-actions="{ row }">
        <AgriVueRowActions :actions="[{ key: 'edit', label: '编辑', onClick: () => openGradeEdit(row) }]" />
      </template>
    </AgriElementListTable>

    <AgriElementListTable
      :columns="gradeChangeColumns"
      :data="gradeChanges"
      :row-key="(row) => String(row.id ?? `${row.channelId}-${row.createTime}`)"
      :loading="loadingGrades"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:grade-changes"
      empty-text="暂无等级调整记录"
      @refresh="loadGrades"
    >
      <template #toolbar-left>
        <h3 class="inline-title">最近等级调整</h3>
      </template>
      <template #cell-channel="{ row }">{{ row.shopName || row.channelId }}</template>
      <template #cell-change="{ row }">{{ row.fromGrade }} → {{ row.toGrade }}</template>
      <template #cell-gmv="{ row }">¥{{ money(row.gmv) }}</template>
    </AgriElementListTable>

    <AgriElementListTable
      :columns="settlementColumns"
      :data="settlements"
      :row-key="(row) => String(row.id ?? row.batchNo)"
      :loading="loadingSettlements"
      client-pagination
      column-settings-storage-key="agri-s2b2c-platform:commission-rule-settlements"
      empty-text="暂无佣金结算批次"
      @refresh="loadSettlements"
    >
      <template #toolbar-left>
        <h3 class="inline-title">佣金结算批次</h3>
        <el-input v-model="settleChannelId" placeholder="渠道 ID（留空=全部渠道）" style="width: 210px" />
        <el-button type="primary" :loading="settling" @click="settle">批量结算待结算佣金</el-button>
      </template>
      <template #cell-channelId="{ row }">{{ row.channelId || '全部' }}</template>
      <template #cell-amount="{ row }">{{ Number(row.amount).toFixed(2) }}</template>
    </AgriElementListTable>

    <el-dialog v-model="gradeDialog" title="等级考核门槛" width="460px">
      <el-form label-width="110px">
        <el-form-item label="渠道等级">
          <el-select v-model="gradeForm.grade" style="width: 100%">
            <el-option label="LEVEL_1" value="LEVEL_1" />
            <el-option label="LEVEL_2" value="LEVEL_2" />
            <el-option label="LEVEL_3" value="LEVEL_3" />
          </el-select>
        </el-form-item>
        <el-form-item label="订单数门槛">
          <el-input-number v-model="gradeForm.minOrders" :min="0" :precision="0" style="width: 100%" />
        </el-form-item>
        <el-form-item label="GMV 门槛(元)">
          <el-input-number v-model="gradeForm.minGmv" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="gradeForm.status">
            <el-radio value="ACTIVE">启用</el-radio>
            <el-radio value="DISABLED">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="gradeForm.remark" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="gradeDialog = false">取消</el-button>
        <el-button type="primary" :loading="savingGrade" @click="saveGrade">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showEdit" title="佣金规则" width="460px">
      <el-form label-width="90px">
        <el-form-item label="渠道等级">
          <el-select v-model="form.grade" style="width: 100%">
            <el-option label="LEVEL_1" value="LEVEL_1" />
            <el-option label="LEVEL_2" value="LEVEL_2" />
            <el-option label="LEVEL_3" value="LEVEL_3" />
          </el-select>
        </el-form-item>
        <el-form-item label="佣金比例(%)">
          <el-input-number v-model="form.rate" :min="0" :max="50" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="ACTIVE">启用</el-radio>
            <el-radio value="DISABLED">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" maxlength="200" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEdit = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { AgriElementListTable, AgriVueRowActions } from '@agri/shared/vue/element'
import { platformApi } from '../api'

const rules = ref([])
const settlements = ref([])
const loadingRules = ref(false)
const loadingGrades = ref(false)
const loadingSettlements = ref(false)
const settleChannelId = ref('')
const settling = ref(false)
const showEdit = ref(false)
const saving = ref(false)
const form = reactive({ grade: 'LEVEL_1', rate: 5, status: 'ACTIVE', remark: '' })
const gradeRules = ref([])
const gradeChanges = ref([])
const gradeDialog = ref(false)
const savingGrade = ref(false)
const evaluating = ref(false)
const evalDays = ref(30)
const gradeForm = reactive({ grade: 'LEVEL_1', minOrders: 0, minGmv: 0, status: 'ACTIVE', remark: '' })

const ruleColumns = [
  { key: 'grade', prop: 'grade', label: '渠道等级', width: 140 },
  { key: 'rate', prop: 'rate', label: '佣金比例', width: 140 },
  { key: 'status', prop: 'status', label: '状态', width: 120 },
  { key: 'remark', prop: 'remark', label: '备注', minWidth: 200 },
  { key: 'actions', label: '操作', width: 100 },
]

const gradeRuleColumns = [
  { key: 'grade', prop: 'grade', label: '渠道等级', width: 120 },
  { key: 'minOrders', prop: 'minOrders', label: '订单数门槛', width: 130 },
  { key: 'minGmv', prop: 'minGmv', label: 'GMV 门槛', width: 150 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'remark', prop: 'remark', label: '备注', minWidth: 180 },
  { key: 'actions', label: '操作', width: 100 },
]

const gradeChangeColumns = [
  { key: 'createTime', prop: 'createTime', label: '时间', width: 180 },
  { key: 'channel', prop: 'shopName', label: '渠道', minWidth: 160 },
  { key: 'change', label: '调整', width: 160 },
  { key: 'orders', prop: 'orders', label: '订单数', width: 90 },
  { key: 'gmv', prop: 'gmv', label: 'GMV', width: 120 },
  { key: 'operator', prop: 'operator', label: '操作人', width: 110 },
]

const settlementColumns = [
  { key: 'batchNo', prop: 'batchNo', label: '批次号', width: 200 },
  { key: 'channelId', prop: 'channelId', label: '渠道', width: 130 },
  { key: 'commissionCount', prop: 'commissionCount', label: '笔数', width: 90 },
  { key: 'amount', prop: 'amount', label: '金额(元)', width: 130 },
  { key: 'operator', prop: 'operator', label: '操作人', width: 120 },
  { key: 'createdAt', prop: 'createdAt', label: '结算时间', minWidth: 170 },
]

onMounted(() => { load(); loadSettlements(); loadGrades() })

async function loadSettlements() {
  loadingSettlements.value = true
  try {
    settlements.value = (await platformApi.getSettlements()) || []
  } catch {
    settlements.value = []
  } finally {
    loadingSettlements.value = false
  }
}

async function settle() {
  settling.value = true
  try {
    const payload = settleChannelId.value ? { channelId: settleChannelId.value } : {}
    const res = await platformApi.settleCommissions(payload)
    if (res?.success === false) {
      ElMessage.warning(res.message || '没有待结算佣金')
      return
    }
    ElMessage.success(res?.message || '结算完成')
    await loadSettlements()
  } catch (e) {
    ElMessage.error(e?.message || '结算失败')
  } finally {
    settling.value = false
  }
}

async function load() {
  loadingRules.value = true
  try {
    rules.value = (await platformApi.getCommissionRules()) || []
  } catch (e) {
    ElMessage.error(e?.message || '佣金规则读取失败')
  } finally {
    loadingRules.value = false
  }
}

async function loadGrades() {
  loadingGrades.value = true
  try {
    const [gradeRuleRows, changeRows] = await Promise.all([
      platformApi.getGradeRules(),
      platformApi.getGradeChanges(50),
    ])
    gradeRules.value = gradeRuleRows || []
    gradeChanges.value = changeRows || []
  } catch (e) {
    gradeRules.value = []
    gradeChanges.value = []
    ElMessage.error(e?.message || '等级考核数据读取失败')
  } finally {
    loadingGrades.value = false
  }
}

function openGradeEdit(row) {
  if (row) {
    gradeForm.grade = row.grade
    gradeForm.minOrders = Number(row.minOrders || 0)
    gradeForm.minGmv = Number(row.minGmv || 0)
    gradeForm.status = row.status || 'ACTIVE'
    gradeForm.remark = row.remark || ''
  } else {
    gradeForm.grade = 'LEVEL_1'
    gradeForm.minOrders = 0
    gradeForm.minGmv = 0
    gradeForm.status = 'ACTIVE'
    gradeForm.remark = ''
  }
  gradeDialog.value = true
}

async function saveGrade() {
  savingGrade.value = true
  try {
    const res = await platformApi.saveGradeRule({ ...gradeForm })
    if (res?.success === false) return ElMessage.error(res.message || '保存失败')
    ElMessage.success('等级考核门槛已保存')
    gradeDialog.value = false
    await loadGrades()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    savingGrade.value = false
  }
}

async function evaluate() {
  evaluating.value = true
  try {
    const res = await platformApi.evaluateChannelGrades(evalDays.value)
    if (res?.success === false) return ElMessage.warning(res.message || '考核失败')
    ElMessage.success(res?.message || '考核完成')
    await loadGrades()
  } catch (e) {
    ElMessage.error(e?.message || '考核失败')
  } finally {
    evaluating.value = false
  }
}

const money = (value) => Number(value || 0).toFixed(2)

function openEdit(row) {
  if (row) {
    form.grade = row.grade
    form.rate = Number(row.rate)
    form.status = row.status || 'ACTIVE'
    form.remark = row.remark || ''
  } else {
    form.grade = 'LEVEL_1'
    form.rate = 5
    form.status = 'ACTIVE'
    form.remark = ''
  }
  showEdit.value = true
}

async function save() {
  saving.value = true
  try {
    const res = await platformApi.saveCommissionRule({ ...form })
    if (res?.success === false) {
      ElMessage.error(res.message || '保存失败')
      return
    }
    ElMessage.success('已保存，新订单将按新规则计算佣金')
    showEdit.value = false
    await load()
  } catch (e) {
    ElMessage.error(e?.message || '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.commission-rules-page { display: flex; flex-direction: column; gap: 16px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-head h2 { margin: 0 0 6px; font-size: 18px; }
.page-head p { margin: 0; color: #6b7c72; font-size: 13px; line-height: 1.6; max-width: 760px; }
.section-header h3 { margin: 4px 0 4px; font-size: 15px; color: #173e2a; }
.section-header p { margin: 0; color: #84938a; font-size: 12px; line-height: 1.6; }
.inline-title { margin: 0; font-size: 15px; color: #173e2a; }
</style>
