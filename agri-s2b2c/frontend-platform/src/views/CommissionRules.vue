<template>
  <div class="commission-rules-page">
    <div class="page-head">
      <div>
        <h2>渠道等级与佣金规则</h2>
        <p>渠道订单结算时按渠道等级取这里的比例；等级由「等级考核规则」按周期内有效订单与 GMV 自动评定，未配置的等级回落到商品自带佣金率。</p>
      </div>
      <el-button type="primary" @click="openEdit()">新增 / 修改规则</el-button>
    </div>

    <el-table :data="rules" border>
      <el-table-column prop="grade" label="渠道等级" width="140" />
      <el-table-column label="佣金比例" width="140">
        <template #default="{ row }">{{ Number(row.rate) }}%</template>
      </el-table-column>
      <el-table-column label="状态" width="120">
        <template #default="{ row }">
          <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
            {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button type="text" @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!rules.length" description="还没有配置佣金规则，渠道订单将使用商品自带佣金率" />

    <div class="grade-block">
      <div class="grade-head">
        <div>
          <h3>等级考核规则</h3>
          <p>按近 N 天「已支付且未取消/退款」订单的订单数与 GMV 自动定级；每月 1 日 03:00 自动执行，也可手动考核。</p>
        </div>
        <div class="grade-actions">
          <el-input-number v-model="evalDays" :min="1" :max="365" :precision="0" style="width: 120px" />
          <el-button type="primary" :loading="evaluating" @click="evaluate">立即考核</el-button>
          <el-button @click="openGradeEdit()">新增 / 修改门槛</el-button>
        </div>
      </div>
      <el-table :data="gradeRules" border size="small">
        <el-table-column prop="grade" label="渠道等级" width="110" />
        <el-table-column label="订单数门槛" width="130">
          <template #default="{ row }">≥ {{ row.minOrders }}</template>
        </el-table-column>
        <el-table-column label="GMV 门槛" width="150">
          <template #default="{ row }">≥ ¥{{ money(row.minGmv) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'">
              {{ row.status === 'ACTIVE' ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" />
        <el-table-column label="操作" width="90">
          <template #default="{ row }">
            <el-button link type="primary" @click="openGradeEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!gradeRules.length" description="未配置考核规则，立即考核会被拒绝" :image-size="60" />

      <h4 class="sub-title">最近等级调整</h4>
      <el-table :data="gradeChanges" border size="small">
        <el-table-column prop="createTime" label="时间" width="180" />
        <el-table-column label="渠道" min-width="160">
          <template #default="{ row }">{{ row.shopName || row.channelId }}</template>
        </el-table-column>
        <el-table-column label="调整" width="160">
          <template #default="{ row }">{{ row.fromGrade }} → {{ row.toGrade }}</template>
        </el-table-column>
        <el-table-column prop="orders" label="订单数" width="90" />
        <el-table-column label="GMV" width="120">
          <template #default="{ row }">¥{{ money(row.gmv) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="110" />
      </el-table>
      <el-empty v-if="!gradeChanges.length" description="暂无等级调整记录" :image-size="60" />
    </div>

    <div class="settle-block">
      <div class="settle-head">
        <h3>佣金结算批次</h3>
        <div class="settle-actions">
          <el-input v-model="settleChannelId" placeholder="渠道 ID（留空=全部渠道）" style="width: 220px" />
          <el-button type="primary" :loading="settling" @click="settle">批量结算待结算佣金</el-button>
        </div>
      </div>
      <p class="settle-hint">每次结算会生成批次号，佣金行会记录批次；渠道端可在「佣金管理」看到自己相关的批次。</p>
      <el-table :data="settlements" border size="small">
        <el-table-column prop="batchNo" label="批次号" width="200" />
        <el-table-column label="渠道" width="120">
          <template #default="{ row }">{{ row.channelId || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="commissionCount" label="笔数" width="90" />
        <el-table-column label="金额(元)" width="130">
          <template #default="{ row }">{{ Number(row.amount).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="createdAt" label="结算时间" />
      </el-table>
    </div>

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
import { platformApi } from '../api'

const rules = ref([])
const settlements = ref([])
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

onMounted(() => { load(); loadSettlements(); loadGrades() })

async function loadSettlements() {
  try {
    settlements.value = (await platformApi.getSettlements()) || []
  } catch {
    settlements.value = []
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
  try {
    rules.value = (await platformApi.getCommissionRules()) || []
  } catch (e) {
    ElMessage.error(e?.message || '佣金规则读取失败')
  }
}

async function loadGrades() {
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
.commission-rules-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-head h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.page-head p {
  margin: 0;
  color: #6b7c72;
  font-size: 13px;
  line-height: 1.6;
  max-width: 760px;
}
.grade-block { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.grade-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.grade-head h3 { margin: 0 0 4px; font-size: 15px; }
.grade-head p { margin: 0; color: #84938a; font-size: 12px; line-height: 1.6; }
.grade-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.sub-title { margin: 14px 0 6px; color: #52665a; font-size: 13px; }
.settle-block { display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid #e3eae5; border-radius: 12px; background: #fff; }
.settle-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.settle-head h3 { margin: 0; font-size: 15px; }
.settle-actions { display: flex; gap: 8px; }
.settle-hint { margin: 0; color: #84938a; font-size: 12px; }
</style>
