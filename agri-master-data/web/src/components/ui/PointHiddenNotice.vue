<!--
  「部分操作已隐藏」横幅 + 一键申请授权。

  内容由 `v-point` 指令自己登记（当前页面被隐藏了哪些权限点），页面与按钮都不需要再维护一份清单 ——
  逐页手写提示一定会和按钮漂移，漂移后的表现是"按钮已经消失而横幅说没事"，比没有横幅更坏。

  列编码而不是列中文名的原因：编码就是运营端「角色权限矩阵 · 接口权限点」里可勾选的那一项，
  操作员拿着它能直接对上要授的点；而目录里的名称有相当一部分是 `控制器#方法名` 的退化值，
  拿它当提示反而说不清是哪件事。

  「申请授权」走的是主体侧端点（`/api/user/permission-points/requests`）：运营端那条前缀受 RBAC 的
  masterdata:read 保护，被拒的人不一定读得到它，所以申请入口必须和被申请的东西待在同一层。
  申请人身份由服务端从令牌取，前端不传用户名 —— 否则任何人都能替别人申请。
-->
<template>
  <NoticeBar v-if="points.hiddenCodes.length" tone="warning" :title="`部分操作已隐藏（${points.hiddenCodes.length} 项）：`">
    <div class="point-hidden__row">
      <div class="point-hidden__text">
        当前账号未持有下面这些权限点，对应按钮已经隐藏；服务端同样会拒绝这些操作，隐藏只是让门看得见。
        <div class="point-hidden__codes">{{ points.hiddenCodes.join('　·　') }}</div>
      </div>
      <button class="mds-btn mds-btn--primary" @click="openRequest">申请授权</button>
    </div>
  </NoticeBar>

  <div v-if="dialogOpen" class="mds-mask" @click.self="dialogOpen = false">
    <div class="mds-dialog">
      <div class="mds-dialog__head">
        <h3>申请权限点授权</h3>
        <button class="mds-dialog__close" @click="dialogOpen = false">×</button>
      </div>
      <div class="mds-dialog__body">
        <p class="mds-hint">
          勾选要申请的项并提交，运营端在「角色权限矩阵」页的「授权申请」卡片里处理；
          同意后会把这个点授给你已有的角色，刷新页面按钮即恢复。
        </p>
        <label v-for="code in points.hiddenCodes" :key="code" class="point-hidden__pick">
          <input type="checkbox" :value="code" v-model="picked" :disabled="points.isPending(code)" />
          <span class="mds-mono">{{ code }}</span>
          <span v-if="points.isPending(code)" class="mds-tag mds-tag--plain">已在排队</span>
        </label>
        <label class="mds-field">
          申请理由（会显示给处理人）
          <textarea v-model="reason" class="mds-input" rows="3" placeholder="例如：负责本月客户档案建档，需要新增客户按钮" />
        </label>
        <p v-if="submitError" class="mds-dialog__error">{{ submitError }}</p>
      </div>
      <div class="mds-dialog__foot">
        <button class="mds-btn" :disabled="submitting" @click="dialogOpen = false">取消</button>
        <button class="mds-btn mds-btn--primary" :disabled="submitting || !picked.length" @click="submit">
          {{ submitting ? '提交中…' : `提交 ${picked.length} 条申请` }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import NoticeBar from '@/components/ui/NoticeBar.vue'
import { usePointStore } from '@/stores/points'
import { userPost } from '@/utils/userApi'

const points = usePointStore()
const dialogOpen = ref(false)
const picked = ref<string[]>([])
const reason = ref('')
const submitting = ref(false)
const submitError = ref('')

function openRequest() {
  // 默认勾上还没排队的项；已经在排队的重复提交只会制造噪音
  picked.value = points.hiddenCodes.filter((code: string) => !points.isPending(code))
  reason.value = ''
  submitError.value = ''
  dialogOpen.value = true
}

async function submit() {
  submitting.value = true
  submitError.value = ''
  const failures: string[] = []
  for (const code of picked.value) {
    const response = await userPost('/api/user/permission-points/requests', {
      permCode: code,
      reason: reason.value.trim(),
      pagePath: window.location.pathname,
    }).catch((error: unknown) => ({ code: -1, message: String((error as Error)?.message ?? error), data: null }))
    if (response.code !== 200) failures.push(`${code}：${response.message || '提交失败'}`)
  }
  await points.load(true)
  submitting.value = false
  if (failures.length) {
    submitError.value = failures.join('；')
    return
  }
  dialogOpen.value = false
  message.success(`已提交 ${picked.value.length} 条授权申请，等待运营端在「角色权限矩阵」页处理`)
}
</script>

<style scoped>
.point-hidden__row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.point-hidden__text {
  flex: 1;
  min-width: 0;
}

.point-hidden__codes {
  margin-top: 6px;
  font-family: var(--mds-font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--mds-text-2, #5a6472);
  word-break: break-all;
}

.point-hidden__pick {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
}

.point-hidden__pick input[type='checkbox'] {
  flex: none;
}
</style>
