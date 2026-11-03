<template>
  <div class="m-container" v-loading="loading">
    <!-- 页头 -->
    <div class="m-page-hd">
      <h1>账户安全</h1>
      <span class="sub">密码、手机号等敏感凭据由统一认证（SSO）管理，商城侧只展示身份信息与可自助修改的昵称</span>
      <div class="hd-actions">
        <button type="button" class="m-btn sm" @click="router.push('/mine')">返回个人中心 ›</button>
      </div>
    </div>

    <!-- 未登录 -->
    <EmptyBlock
      v-if="userStore.booted && !consumerId"
      icon="🔐"
      title="登录后查看账户信息"
      desc="账户信息来自统一认证换回的消费者档案。当前浏览器没有检测到已登录的统一身份，请从统一门户登录后再进入商城。"
    >
      <template #actions>
        <button type="button" class="m-btn primary" @click="router.push('/')">返回首页</button>
      </template>
    </EmptyBlock>

    <template v-else>
      <!-- 可自助修改：昵称 -->
      <section class="m-card">
        <header class="m-card-hd">
          <h3>昵称</h3>
          <div class="hd-actions muted small">昵称只影响商城内的展示名，不改变统一账号的用户名</div>
        </header>
        <div class="m-card-pad">
          <div class="nick-row">
            <div class="m-field nick-field">
              <label for="nickname">商城昵称</label>
              <el-input id="nickname" v-model="nickname" maxlength="30" show-word-limit placeholder="请输入昵称" />
              <span v-if="nickError" class="err">{{ nickError }}</span>
              <span v-else class="hint">当前昵称：{{ userStore.displayName }}</span>
            </div>
            <button type="button" class="m-btn primary" :disabled="savingNick" @click="saveNickname">
              {{ savingNick ? '保存中…' : '保存昵称' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 统一账号信息（只读） -->
      <section class="m-card info-card">
        <header class="m-card-hd">
          <h3>统一账号信息</h3>
          <div class="hd-actions muted small">由统一认证签发，本端只读</div>
        </header>
        <dl class="kv">
          <div>
            <dt>统一账号用户名</dt>
            <dd>{{ userStore.user?.username || '—' }}</dd>
          </div>
          <div>
            <dt>统一账号 ID</dt>
            <dd class="num">{{ userStore.user?.unifiedUserId || '—' }}</dd>
          </div>
          <div>
            <dt>商城消费者 ID</dt>
            <dd class="num">{{ consumerId || '—' }}</dd>
          </div>
          <div>
            <dt>绑定手机号</dt>
            <dd class="num">{{ maskedPhone }}</dd>
          </div>
          <div v-if="permissions.length" class="full">
            <dt>角色权限</dt>
            <dd class="m-row-wrap">
              <span v-for="code in permissions" :key="code" class="m-tag plain">{{ code }}</span>
            </dd>
          </div>
        </dl>
        <p class="card-note muted small">
          角色权限来自统一平台权限接口（<code>/api/v1/platform/permissions/mine</code>）；未取到权限清单时这里不展示该行，不会用默认值填充。
        </p>
      </section>

      <!-- 由统一认证管理的能力 -->
      <section class="m-card">
        <header class="m-card-hd">
          <h3>由统一账号管理</h3>
          <div class="hd-actions">
            <a class="m-btn sm" :href="ssoCenter" target="_blank" rel="noopener">前往统一账号中心 ›</a>
          </div>
        </header>
        <div class="manage-list">
          <div v-for="row in managedRows" :key="row.label" class="manage-row">
            <span class="mr-ic">{{ row.icon }}</span>
            <div class="mr-info">
              <b>{{ row.label }}</b>
              <small>{{ row.desc }}</small>
            </div>
            <span class="m-tag plain">由统一账号管理</span>
            <a class="m-btn sm" :href="ssoCenter" target="_blank" rel="noopener">去处理</a>
          </div>
        </div>
        <p class="card-note muted small">
          商城消费者端<b>没有</b>修改密码、更换手机号、查看登录设备、注销账户的接口，因此这些条目只做指引：
          点击后跳转到统一账号中心（<span class="num">{{ ssoCenter }}</span>）完成操作，本页不会伪造"修改成功"的结果。
        </p>
      </section>

      <!-- 风险提示 -->
      <section class="m-card risk-card">
        <h3>⚠️ 操作影响范围</h3>
        <ul>
          <li>
            <b>修改密码 / 更换手机号</b>：凭据由统一认证保管，改完后所有已登录端（商城、供应商端、渠道商端、运营端）
            的会话都可能失效，需要重新从统一门户登录。
          </li>
          <li>
            <b>修改昵称</b>：只写入商城消费者档案（<code>s2b2c_consumer.nickname</code>），影响商品评价、页面右上角等处的展示名，
            不影响登录方式与其它端。
          </li>
          <li>
            <b>注销账户</b>：入口在统一账号中心；注销前请确认没有未完成的订单与售后，否则售后与退款将无法继续跟进。
          </li>
          <li>
            <b>退出登录</b>：本端退出会清理商城本地登录态并跳转统一认证注销页，见「个人中心 → 退出登录」。
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'
import { unifiedSession } from '../../../frontend-shared/unified-auth'
import EmptyBlock from '../components/EmptyBlock.vue'

const router = useRouter()
const userStore = useUserStore()

const loading = ref(false)
const savingNick = ref(false)
const nickname = ref('')
const nickError = ref('')

const consumerId = computed(() => userStore.consumerId)
const permissions = computed(() => (Array.isArray(unifiedSession.permissions) ? unifiedSession.permissions : []))

/** 统一认证入口：与 unified-auth.js 的 ssoOrigin 保持同一套主机名拼装规则。 */
const ssoCenter = computed(() => `http://${window.location.hostname}:8090`)

const maskedPhone = computed(() => {
  const phone = String(userStore.user?.phone || '').trim()
  if (!phone) return '未绑定'
  if (/^\d{11}$/.test(phone)) return `${phone.slice(0, 3)}****${phone.slice(7)}`
  return phone
})

const managedRows = [
  { icon: '🔑', label: '登录密码', desc: '修改、找回密码都在统一账号中心完成，商城侧不接触密码' },
  { icon: '📱', label: '绑定手机号', desc: '手机号同时是统一账号登录名，换号需在统一账号中心验证' },
  { icon: '💻', label: '登录设备', desc: '本端没有设备列表接口，登录记录请在统一账号中心查看' },
  { icon: '🗑️', label: '注销账户', desc: '注销是不可逆操作，须在统一账号中心申请并确认无未完成订单' },
]

/** 昵称保存：写接口只回 success，必须 refreshProfile 回读档案确认昵称真的变了。 */
async function saveNickname() {
  const value = nickname.value.trim()
  nickError.value = ''
  if (!value) {
    nickError.value = '昵称不能为空'
    return
  }
  if (value.length > 30) {
    nickError.value = '昵称最多 30 个字'
    return
  }
  if (value === (userStore.user?.nickname || '')) {
    ElMessage.warning('昵称没有变化')
    return
  }
  if (!consumerId.value) {
    ElMessage.warning('登录后才能修改昵称')
    return
  }

  savingNick.value = true
  try {
    const res = await consumerApi.updateInfo({ id: consumerId.value, nickname: value })
    if (res?.success === false) {
      ElMessage.error(res.message || '昵称保存失败')
      return
    }
    const profile = await userStore.refreshProfile()
    const saved = profile?.nickname || userStore.user?.nickname || ''
    if (saved === value) {
      nickname.value = saved
      ElMessage.success('昵称已更新')
    } else {
      ElMessage.error('保存后回读昵称未变化，请稍后重试')
    }
  } catch (err) {
    ElMessage.error(err.friendlyMessage || '昵称保存失败')
  } finally {
    savingNick.value = false
  }
}

/** 进入页面时先把当前昵称填入输入框；消费者 ID 是异步换回的，换回后再补一次。 */
async function load() {
  loading.value = true
  try {
    await userStore.refreshProfile()
    nickname.value = userStore.user?.nickname || ''
  } finally {
    loading.value = false
  }
}

onMounted(load)

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

/* 多张卡纵向排列时的统一间距（风险提示卡单独设了背景，不需要额外处理） */
.m-container > .m-card + .m-card {
  margin-top: 16px;
}

.nick-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
}

.nick-field {
  flex: 1;
  max-width: 460px;
}

.nick-row .m-btn {
  height: 36px;
}

.err {
  color: #c94b4b;
  font-size: 12px;
}

.info-card .kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 32px;
  margin: 0;
  padding: 8px 22px;
}

.info-card .kv > div {
  display: flex;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dashed #eef3ef;
  font-size: 13px;
}

.info-card .kv > .full {
  grid-column: 1 / -1;
}

.info-card dt {
  flex: 0 0 110px;
  color: #6b7c72;
}

.info-card dd {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  color: #0b1a12;
  font-weight: 500;
  word-break: break-all;
}

.manage-list {
  padding: 4px 22px 0;
}

.manage-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px dashed #eef3ef;
}

.manage-row:last-child {
  border-bottom: 0;
}

.mr-ic {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #f1fbf5;
  font-size: 16px;
}

.mr-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.mr-info b {
  font-size: 13.5px;
}

.mr-info small {
  color: #6b7c72;
  font-size: 12px;
}

.manage-row .m-tag {
  margin-left: auto;
}

.card-note {
  margin: 0;
  padding: 12px 22px 16px;
  line-height: 1.8;
}

.card-note code,
.risk-card code {
  padding: 1px 5px;
  border-radius: 4px;
  background: #f1f5f2;
  color: #12764a;
  font-size: 12px;
}

.risk-card {
  margin-top: 16px;
  padding: 18px 22px;
  border-color: #f2e2c8;
  background: linear-gradient(120deg, #fdf8ef, #fff 60%);
}

.risk-card h3 {
  margin: 0 0 8px;
  font-size: 14.5px;
  font-weight: 700;
}

.risk-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding-left: 18px;
  color: #4b5d53;
  font-size: 12.5px;
  line-height: 1.8;
}

@media (max-width: 960px) {
  .nick-row { flex-direction: column; align-items: stretch; }
  .info-card .kv { grid-template-columns: minmax(0, 1fr); }
}
</style>
