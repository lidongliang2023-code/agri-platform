<template>
  <view class="register-page">
    <view class="page-hero">
      <text class="eyebrow">MEMBER ONBOARDING</text>
      <text class="title">注册与认证</text>
      <text class="subtitle">账号、主体、认证可分步完成，也可以先保存后继续。</text>
      <view class="steps">
        <view :class="{ on: step >= 1 }" @tap="goStep(1)"><text>1</text><span>注册账号</span></view>
        <i />
        <view :class="{ on: step >= 2, locked: !accountCreated }" @tap="goStep(2)"><text>2</text><span>创建主体</span></view>
        <i />
        <view :class="{ on: step >= 3, locked: !merchantId }" @tap="goStep(3)"><text>3</text><span>认证开通</span></view>
      </view>
    </view>

    <view v-if="messageText" :class="['message-box', messageType]">{{ messageText }}</view>

    <view v-if="step === 1" class="form-card">
      <view class="section-head"><text>1. 注册登录账号</text><text>仅创建身份凭证</text></view>
      <view class="field">
        <text class="field-label">手机号 *</text>
        <input v-model="phone" type="number" maxlength="11" placeholder="请输入 11 位手机号" />
      </view>
      <view class="field code-field">
        <text class="field-label">短信验证码 *</text>
        <input v-model="smsCode" type="number" maxlength="6" placeholder="6 位验证码" />
        <button :disabled="sending || countdown > 0" @tap="requestCode">
          {{ sending ? '发送中…' : countdown > 0 ? `${countdown}s` : '获取验证码' }}
        </button>
      </view>
      <view class="field">
        <text class="field-label">设置密码 *</text>
        <input v-model="password" password maxlength="20" placeholder="8-20 位，同时包含字母和数字" />
      </view>
      <view class="field">
        <text class="field-label">确认密码 *</text>
        <input v-model="confirmPassword" password maxlength="20" placeholder="请再次输入密码" />
      </view>
      <view class="field">
        <text class="field-label">称呼</text>
        <input v-model="nickname" maxlength="20" placeholder="选填，如：王经理" />
      </view>
      <view class="hint-box">创建账号后可立即继续创建企业或个人主体，也可以稍后从登录页继续。</view>
      <button class="primary-button" :disabled="saving" @tap="submitAccount(true)">
        {{ saving ? '创建中…' : '创建账号并创建主体' }}
      </button>
      <button v-if="!accountCreated" class="secondary-button" :disabled="saving" @tap="submitAccount(false)">仅创建账号，稍后继续</button>
      <button v-else class="secondary-button" @tap="enterWorkbench">账号已创建，稍后继续</button>
    </view>

    <view v-if="step === 2" class="form-card">
      <view class="section-head"><text>2. 创建经营主体</text><text>企业或个人二选一</text></view>
      <view class="identity-grid">
        <button :class="{ on: identity === 'enterprise' }" @tap="identity = 'enterprise'">
          <text class="identity-icon">企</text>
          <text class="identity-title">企业主体</text>
          <text class="identity-desc">企业采购、供应与供应链金融</text>
        </button>
        <button :class="{ on: identity === 'personal' }" @tap="identity = 'personal'">
          <text class="identity-icon">人</text>
          <text class="identity-title">个人主体</text>
          <text class="identity-desc">农户、家庭农场与个体经营户</text>
        </button>
      </view>

      <template v-if="identity === 'enterprise'">
        <view class="field"><text class="field-label">企业名称 *</text><input v-model="companyName" placeholder="与营业执照保持一致" /></view>
        <view class="field"><text class="field-label">信用代码 *</text><input v-model="creditCode" maxlength="18" placeholder="15-18 位统一社会信用代码" /></view>
        <view class="field"><text class="field-label">法定代表人 *</text><input v-model="legalPerson" placeholder="请输入法定代表人姓名" /></view>
        <view class="field"><text class="field-label">所属行业</text><input v-model="industry" placeholder="如：粮油产业" /></view>
        <view class="field"><text class="field-label">企业规模</text><input v-model="companySize" placeholder="如：小型（20-100人）" /></view>
        <view class="field"><text class="field-label">注册地址</text><input v-model="address" placeholder="省 / 市 / 区 / 详细地址" /></view>
      </template>
      <template v-else>
        <view class="field"><text class="field-label">真实姓名 *</text><input v-model="realName" placeholder="请输入真实姓名" /></view>
        <view class="field"><text class="field-label">身份证号 *</text><input v-model="idCard" maxlength="18" placeholder="仅保存掩码与摘要" /></view>
        <view class="field"><text class="field-label">经营类型</text><input v-model="businessType" placeholder="家庭农场 / 个体采购户" /></view>
      </template>
      <view class="field"><text class="field-label">联系人 *</text><input v-model="contactName" placeholder="用于接收重要通知" /></view>
      <view class="field"><text class="field-label">联系电话</text><input v-model="contactPhone" type="number" maxlength="11" :placeholder="phone || '默认使用登录手机号'" /></view>
      <view class="hint-box">经营主体创建成功后，可在下一步完成实名材料核验；未认证前不会获得完整交易和金融权限。</view>
      <button class="primary-button" :disabled="saving" @tap="submitSubject(true)">{{ saving ? '保存中…' : '保存并继续认证' }}</button>
      <button class="secondary-button" :disabled="saving" @tap="submitSubject(false)">仅保存主体，稍后继续</button>
    </view>

    <view v-if="step === 3" class="form-card">
      <view class="section-head">
        <text>3. 实名认证与开通</text>
        <text :class="['status-pill', onboardingStage]">{{ stageText }}</text>
      </view>

      <view v-if="onboardingStage === 'pending'" class="state-card pending">
        <text class="state-icon">审</text>
        <text class="state-title">认证申请已提交</text>
        <text class="state-desc">平台正在审核主体资料，审核通过后认证状态自动生效。</text>
      </view>
      <view v-else-if="onboardingStage === 'done'" class="state-card done">
        <text class="state-icon">✓</text>
        <text class="state-title">主体认证已完成</text>
        <text class="state-desc">当前主体已开通平台交易与经营权限。</text>
      </view>

      <template v-else-if="identity === 'personal'">
        <view class="verify-summary">
          <view><text>实名主体</text><strong>{{ realName || subjectName || '个人主体' }}</strong></view>
          <view><text>证件号码</text><strong>{{ maskedIdCard }}</strong></view>
          <view><text>认证方式</text><strong>公安二要素 + 活体检测</strong></view>
        </view>
        <view class="verify-actions">
          <button :class="{ done: verification.policeVerified }" :disabled="verifying" @tap="verifyPersonal('police')">
            <text>{{ verification.policeVerified ? '✓ 公安二要素已通过' : '公安二要素核验' }}</text>
            <small>校验姓名与身份证号是否一致</small>
          </button>
          <button :class="{ done: verification.livenessVerified }" :disabled="verifying" @tap="verifyPersonal('liveness')">
            <text>{{ verification.livenessVerified ? '✓ 人脸活体已通过' : '开始人脸活体检测' }}</text>
            <small>活体通过后完成实名认证前置核验</small>
          </button>
        </view>
      </template>

      <template v-else>
        <view class="verify-summary">
          <view><text>企业主体</text><strong>{{ companyName || subjectName || '企业主体' }}</strong></view>
          <view><text>法定代表人</text><strong>{{ legalPerson || '待补充' }}</strong></view>
          <view><text>认证方式</text><strong>营业执照 + 法人扫脸 + 对公打款</strong></view>
        </view>
        <view class="upload-grid">
          <button :class="{ done: businessLicenseUrl }" @tap="chooseBusinessFile('business_license')">
            <text>{{ businessLicenseUrl ? '✓' : '+' }}</text>
            <strong>{{ businessLicenseUrl ? '营业执照已上传' : '上传营业执照' }}</strong>
            <small>完整清晰、在有效期内</small>
          </button>
          <button :class="{ done: legalPersonFaceUrl }" @tap="chooseBusinessFile('legal_person_face')">
            <text>{{ legalPersonFaceUrl ? '✓' : '+' }}</text>
            <strong>{{ legalPersonFaceUrl ? '法人扫脸已采集' : '法人扫脸材料' }}</strong>
            <small>调用摄像头采集法人面部</small>
          </button>
          <button :class="{ done: corporateTransferProofUrl }" @tap="chooseBusinessFile('corporate_transfer_proof')">
            <text>{{ corporateTransferProofUrl ? '✓' : '+' }}</text>
            <strong>{{ corporateTransferProofUrl ? '打款凭证已上传' : '上传对公打款凭证' }}</strong>
            <small>银行回单或转账凭证</small>
          </button>
        </view>
        <view class="field"><text class="field-label">注册资本</text><input v-model="registeredCapital" placeholder="如：5000 万元" /></view>
        <view class="field"><text class="field-label">账户户名 *</text><input v-model="corporateBankName" placeholder="与营业执照企业名称一致" /></view>
        <view class="field"><text class="field-label">对公账号 *</text><input v-model="corporateBankAccount" type="number" placeholder="请输入 8-32 位账号" /></view>
        <view class="field"><text class="field-label">打款金额 *</text><input v-model="corporateTransferAmount" type="digit" placeholder="如：0.37" /></view>
        <view class="field"><text class="field-label">打款流水号 *</text><input v-model="corporateTransferReference" placeholder="银行回单流水号" /></view>
        <button class="verify-button" :disabled="verifying || uploading !== ''" @tap="prepareEnterprise">
          {{ verifying ? '校验中…' : certificationReady ? '✓ 企业认证材料已通过前置校验' : '校验法人扫脸与对公打款材料' }}
        </button>
      </template>

      <label v-if="onboardingStage !== 'pending' && onboardingStage !== 'done'" class="agreement">
        <checkbox :checked="agreed" color="#159a5e" @tap="agreed = !agreed" />
        <text>我确认资料真实有效，并同意《用户服务协议》《隐私政策》与《企业入驻规则》。</text>
      </label>
      <button v-if="onboardingStage !== 'pending' && onboardingStage !== 'done'" class="primary-button"
        :disabled="saving || !certificationReady || !agreed" @tap="submitCertification">
        {{ saving ? '提交中…' : !certificationReady ? '请先完成前置核验' : '提交认证并开通' }}
      </button>
      <button v-if="onboardingStage === 'pending' || onboardingStage === 'done'" class="primary-button" @tap="enterWorkbench">
        进入生产管理工作台
      </button>
      <button class="secondary-button" @tap="enterWorkbench">稍后完成，先进入账号</button>
    </view>

    <view class="bottom-link">
      <text>已有账号？</text>
      <text @tap="backToLogin">返回登录 →</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import {
  createOnboardingSubject,
  getOnboardingStatus,
  isLoggedIn,
  login,
  prepareEnterpriseOnboarding,
  registerAccount,
  sendSmsCode,
  submitOnboardingCertification,
  uploadOnboardingFile,
  verifyPersonalOnboarding,
  type OnboardingStatus,
} from '@/utils/auth'

type Identity = 'enterprise' | 'personal'
type Step = 1 | 2 | 3
type UploadKind = 'business_license' | 'legal_person_face' | 'corporate_transfer_proof'

const step = ref<Step>(1)
const identity = ref<Identity>('enterprise')
const phone = ref('')
const smsCode = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const companyName = ref('')
const creditCode = ref('')
const legalPerson = ref('')
const industry = ref('粮油产业')
const companySize = ref('小型（20-100人）')
const address = ref('')
const realName = ref('')
const idCard = ref('')
const businessType = ref('家庭农场')
const contactName = ref('')
const contactPhone = ref('')
const subjectName = ref('')
const merchantId = ref('')
const onboardingStage = ref('')
const accountCreated = ref(false)
const saving = ref(false)
const verifying = ref(false)
const sending = ref(false)
const countdown = ref(0)
const uploading = ref<UploadKind | ''>('')
const agreed = ref(false)
const messageText = ref('')
const messageType = ref<'error' | 'notice'>('error')
const verification = ref({
  policeVerified: false,
  livenessVerified: false,
  businessLicenseUrl: '',
  legalPersonFaceUrl: '',
  legalPersonFaceStatus: '',
  corporateTransferProofUrl: '',
  corporateTransferStatus: '',
})
const registeredCapital = ref('')
const corporateBankName = ref('')
const corporateBankAccount = ref('')
const corporateTransferAmount = ref('')
const corporateTransferReference = ref('')
let timer: ReturnType<typeof setInterval> | null = null

const businessLicenseUrl = computed(() => verification.value.businessLicenseUrl)
const legalPersonFaceUrl = computed(() => verification.value.legalPersonFaceUrl)
const corporateTransferProofUrl = computed(() => verification.value.corporateTransferProofUrl)
const certificationReady = computed(() => identity.value === 'personal'
  ? verification.value.policeVerified && verification.value.livenessVerified
  : verification.value.legalPersonFaceStatus === 'verified'
    && ['submitted', 'verified'].includes(verification.value.corporateTransferStatus))
const maskedIdCard = computed(() => idCard.value.length === 18
  ? `${idCard.value.slice(0, 3)}***********${idCard.value.slice(-4)}`
  : '已安全保存')
const stageText = computed(() => {
  if (onboardingStage.value === 'done') return '已认证'
  if (onboardingStage.value === 'pending') return '审核中'
  if (onboardingStage.value === 'rejected') return '需重新认证'
  return '待认证'
})

function notice(text: string, type: 'error' | 'notice' = 'error'): void {
  messageType.value = type
  messageText.value = text
}

function startCountdown(): void {
  countdown.value = 60
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

function applyStatus(status: OnboardingStatus | null | undefined): void {
  if (!status) return
  accountCreated.value = true
  onboardingStage.value = status.stage || 'certification'
  if (status.identity === 'personal' || status.identity === 'enterprise') identity.value = status.identity
  subjectName.value = status.subjectName || ''
  merchantId.value = status.merchantId == null ? '' : String(status.merchantId)
  phone.value = status.phone || phone.value
  nickname.value = status.nickname || nickname.value
  if (status.identity === 'enterprise') companyName.value = status.subjectName || companyName.value
  if (status.identity === 'personal') realName.value = status.subjectName || realName.value
  const evidence = status.verification
  if (evidence) {
    creditCode.value = evidence.creditCode || creditCode.value
    legalPerson.value = evidence.legalPerson || legalPerson.value
    verification.value = {
      policeVerified: Boolean(evidence.policeVerified),
      livenessVerified: Boolean(evidence.livenessVerified),
      businessLicenseUrl: evidence.businessLicenseUrl || '',
      legalPersonFaceUrl: evidence.legalPersonFaceUrl || '',
      legalPersonFaceStatus: evidence.legalPersonFaceStatus || '',
      corporateTransferProofUrl: evidence.corporateTransferProofUrl || '',
      corporateTransferStatus: evidence.corporateTransferStatus || '',
    }
    registeredCapital.value = evidence.registeredCapital || registeredCapital.value
    corporateBankName.value = evidence.corporateBankName || corporateBankName.value
    corporateTransferAmount.value = evidence.corporateTransferAmount || corporateTransferAmount.value
    corporateTransferReference.value = evidence.corporateTransferReference || corporateTransferReference.value
  }
}

async function loadStatus(): Promise<void> {
  try {
    const status = await getOnboardingStatus()
    applyStatus(status)
    if (status.stage === 'subject') step.value = 2
    else if (status.stage !== 'done' && status.stage !== '') step.value = 3
  } catch {
    if (isLoggedIn()) notice('登录会话已创建，请继续创建经营主体', 'notice')
  }
}

onLoad((query) => {
  const requested = Number(query?.step)
  if (requested === 2 || requested === 3) step.value = requested
  if (isLoggedIn()) void loadStatus()
  else if (requested === 2 || requested === 3) {
    notice('请先完成账号注册或登录，再继续创建主体', 'error')
    step.value = 1
  }
})

async function requestCode(): Promise<void> {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) {
    notice('请输入正确的 11 位手机号')
    return
  }
  sending.value = true
  try {
    const result = await sendSmsCode(phone.value, 'register')
    notice(result?.hint || '验证码已发送', 'notice')
    startCountdown()
  } catch (error) {
    notice(error instanceof Error ? error.message : '验证码发送失败')
  } finally {
    sending.value = false
  }
}

function validateAccount(): boolean {
  if (!/^1[3-9]\d{9}$/.test(phone.value)) return notice('请输入正确的 11 位手机号'), false
  if (!/^\d{6}$/.test(smsCode.value)) return notice('请输入 6 位短信验证码'), false
  if (password.value.length < 8 || password.value.length > 20
    || !/[A-Za-z]/.test(password.value) || !/\d/.test(password.value)) {
    return notice('密码应为 8-20 位，且同时包含字母和数字'), false
  }
  if (password.value !== confirmPassword.value) return notice('两次输入的密码不一致'), false
  return true
}

async function submitAccount(continueToSubject: boolean): Promise<void> {
  if (!validateAccount()) return
  saving.value = true
  try {
    const status = await registerAccount({
      phone: phone.value,
      code: smsCode.value,
      password: password.value,
      nickname: nickname.value,
    })
    applyStatus(status)
    smsCode.value = ''
    if (continueToSubject) {
      step.value = 2
      notice('登录账号已创建，请继续登记经营主体', 'notice')
    } else {
      notice('登录账号已创建，可以稍后继续创建主体', 'notice')
      setTimeout(enterWorkbench, 700)
    }
  } catch (error) {
    notice(error instanceof Error ? error.message : '账号创建失败')
  } finally {
    saving.value = false
  }
}

function validateSubject(): boolean {
  if (identity.value === 'enterprise') {
    if (!companyName.value.trim()) return notice('请填写企业名称'), false
    if (!/^[0-9A-Za-z]{15,18}$/.test(creditCode.value.trim())) return notice('请填写 15-18 位统一社会信用代码'), false
    if (!legalPerson.value.trim()) return notice('请填写法定代表人姓名'), false
  } else {
    if (!realName.value.trim()) return notice('请填写真实姓名'), false
    if (!/^\d{17}[\dXx]$/.test(idCard.value.trim())) return notice('身份证号应为 18 位，末位可为 X'), false
  }
  if (!contactName.value.trim()) return notice('请填写联系人姓名'), false
  if (contactPhone.value.trim() && !/^1[3-9]\d{9}$/.test(contactPhone.value.trim())) {
    return notice('请填写正确的 11 位联系电话'), false
  }
  return true
}

async function submitSubject(continueToCertification: boolean): Promise<void> {
  if (!validateSubject()) return
  saving.value = true
  try {
    const status = await createOnboardingSubject({
      identity: identity.value,
      companyName: companyName.value.trim(),
      creditCode: creditCode.value.trim(),
      industry: identity.value === 'enterprise' ? industry.value : '',
      companySize: identity.value === 'enterprise' ? companySize.value : '',
      address: identity.value === 'enterprise' ? address.value.trim() : '',
      realName: realName.value.trim(),
      idCard: idCard.value.trim(),
      businessType: identity.value === 'personal' ? businessType.value : '',
      contactName: contactName.value.trim(),
      contactPhone: contactPhone.value.trim() || phone.value,
      legalPerson: identity.value === 'enterprise' ? legalPerson.value.trim() : realName.value.trim(),
      licenseNo: identity.value === 'enterprise' ? creditCode.value.trim() : '',
    })
    applyStatus(status)
    if (continueToCertification) {
      step.value = 3
      notice('经营主体已创建，请完成实名材料核验', 'notice')
    } else {
      notice('经营主体已保存，可以稍后继续认证', 'notice')
      setTimeout(enterWorkbench, 700)
    }
  } catch (error) {
    notice(error instanceof Error ? error.message : '主体创建失败')
  } finally {
    saving.value = false
  }
}

async function verifyPersonal(kind: 'police' | 'liveness'): Promise<void> {
  verifying.value = true
  try {
    const status = await verifyPersonalOnboarding(kind, {
      realName: realName.value,
      idCard: idCard.value,
    })
    applyStatus(status)
    notice(kind === 'police' ? '公安二要素核验通过' : '人脸活体检测通过', 'notice')
  } catch (error) {
    notice(error instanceof Error ? error.message : '实名核验失败')
  } finally {
    verifying.value = false
  }
}

function chooseBusinessFile(kind: UploadKind): void {
  if (!merchantId.value) {
    notice('请先保存经营主体')
    return
  }
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: kind === 'legal_person_face' ? ['camera'] : ['album', 'camera'],
    success: async (result) => {
      const filePath = result.tempFilePaths?.[0]
      if (!filePath) return
      uploading.value = kind
      try {
        const url = await uploadOnboardingFile(merchantId.value, kind, filePath)
        if (kind === 'business_license') verification.value.businessLicenseUrl = url
        if (kind === 'legal_person_face') {
          verification.value.legalPersonFaceUrl = url
          verification.value.legalPersonFaceStatus = 'uploaded'
        }
        if (kind === 'corporate_transfer_proof') {
          verification.value.corporateTransferProofUrl = url
          verification.value.corporateTransferStatus = 'uploaded'
        }
        notice(kind === 'legal_person_face' ? '法人扫脸材料已采集' : '认证材料上传成功', 'notice')
      } catch (error) {
        notice(error instanceof Error ? error.message : '认证材料上传失败')
      } finally {
        uploading.value = ''
      }
    },
  })
}

async function prepareEnterprise(): Promise<void> {
  if (!legalPerson.value.trim()) return notice('请填写法定代表人姓名')
  if (!verification.value.businessLicenseUrl) return notice('请上传营业执照照片')
  if (!verification.value.legalPersonFaceUrl) return notice('请完成法人扫脸材料采集')
  if (!corporateBankName.value.trim()) return notice('请填写对公账户户名')
  if (!/^\d{8,32}$/.test(corporateBankAccount.value.replace(/\s/g, ''))) return notice('请填写有效的对公账户账号')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(corporateTransferAmount.value)) return notice('请填写正确的对公打款金额')
  if (corporateTransferReference.value.trim().length < 6) return notice('请填写至少 6 位的对公打款流水号')
  if (!verification.value.corporateTransferProofUrl) return notice('请上传对公打款凭证')
  verifying.value = true
  try {
    const status = await prepareEnterpriseOnboarding({
      legalPerson: legalPerson.value.trim(),
      registeredCapital: registeredCapital.value.trim(),
      businessLicenseUrl: verification.value.businessLicenseUrl,
      legalPersonFaceUrl: verification.value.legalPersonFaceUrl,
      corporateBankName: corporateBankName.value.trim(),
      corporateBankAccount: corporateBankAccount.value,
      corporateTransferAmount: corporateTransferAmount.value,
      corporateTransferReference: corporateTransferReference.value.trim(),
      corporateTransferProofUrl: verification.value.corporateTransferProofUrl,
    })
    applyStatus(status)
    notice('企业认证材料已通过前置校验，可以提交审核', 'notice')
  } catch (error) {
    notice(error instanceof Error ? error.message : '企业认证材料校验失败')
  } finally {
    verifying.value = false
  }
}

async function submitCertification(): Promise<void> {
  if (!certificationReady.value) return notice('请先完成实名前置核验')
  if (!agreed.value) return notice('请先同意用户服务协议与隐私政策')
  saving.value = true
  try {
    const result = await submitOnboardingCertification()
    onboardingStage.value = result.stage || 'pending'
    notice('认证申请已提交，平台审核通过后自动开通', 'notice')
  } catch (error) {
    notice(error instanceof Error ? error.message : '认证提交失败')
  } finally {
    saving.value = false
  }
}

function goStep(next: Step): void {
  if (next === 2 && !accountCreated.value) return notice('请先注册或登录账号')
  if (next === 3 && !merchantId.value) return notice('请先创建经营主体')
  step.value = next
  notice('', 'notice')
  uni.pageScrollTo({ scrollTop: 0, duration: 200 })
}

function enterWorkbench(): void {
  if (!isLoggedIn()) {
    backToLogin()
    return
  }
  uni.reLaunch({ url: '/pages/workbench/workbench' })
}

function backToLogin(): void {
  uni.reLaunch({ url: '/pages/login/login' })
}

onUnload(() => {
  if (timer) clearInterval(timer)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style lang="scss" scoped>
.register-page {
  min-height: 100vh;
  padding: 0 26rpx calc(44rpx + env(safe-area-inset-bottom));
  background:
    radial-gradient(circle at 90% 4%, rgba(64, 184, 117, .2), transparent 320rpx),
    linear-gradient(180deg, #0f5838 0, #147a4d 390rpx, #f3f7f5 390rpx, #f3f7f5 100%);
}

.page-hero {
  padding: 34rpx 12rpx 28rpx;
  color: #fff;
}

.eyebrow,
.title,
.subtitle {
  display: block;
}

.eyebrow {
  color: #a5e8c1;
  font-size: 18rpx;
  font-weight: 700;
  letter-spacing: 2rpx;
}

.title {
  margin-top: 8rpx;
  font-size: 44rpx;
  font-weight: 800;
}

.subtitle {
  margin-top: 9rpx;
  color: rgba(255, 255, 255, .7);
  font-size: 22rpx;
  line-height: 1.6;
}

.steps {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-top: 30rpx;
}

.steps view,
.steps uni-view {
  display: flex;
  align-items: center;
  gap: 7rpx;
  color: rgba(255, 255, 255, .48);
  font-size: 19rpx;
}

.steps view text,
.steps uni-view uni-text {
  display: grid;
  width: 32rpx;
  height: 32rpx;
  place-items: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, .12);
  font-size: 16rpx;
  font-weight: 800;
}

.steps view.on,
.steps uni-view.on {
  color: #fff;
}

.steps view.on text,
.steps uni-view.on uni-text {
  background: #91e5b4;
  color: #0f5b38;
}

.steps view.locked,
.steps uni-view.locked {
  opacity: .42;
}

.steps i {
  height: 1rpx;
  flex: 1;
  background: rgba(255, 255, 255, .18);
}

.message-box {
  margin-bottom: 16rpx;
  padding: 18rpx 20rpx;
  border-radius: 14rpx;
  font-size: 22rpx;
  line-height: 1.6;
}

.message-box.error {
  border: 1rpx solid #f0c8c2;
  background: #fff4f2;
  color: #b42318;
}

.message-box.notice {
  border: 1rpx solid #b9dfc8;
  background: #eefaf3;
  color: #14764a;
}

.form-card {
  overflow: hidden;
  padding: 26rpx;
  border: 1rpx solid #dfeae3;
  border-radius: 22rpx;
  background: #fff;
  box-shadow: 0 18rpx 54rpx rgba(21, 67, 43, .08);
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 22rpx;
  padding-bottom: 18rpx;
  border-bottom: 1rpx solid #edf2ee;
}

.section-head > text:first-child,
.section-head > uni-text:first-child {
  color: #254633;
  font-size: 30rpx;
  font-weight: 750;
}

.section-head > text:last-child,
.section-head > uni-text:last-child {
  color: #8a9a90;
  font-size: 19rpx;
}

.field {
  display: flex;
  min-height: 88rpx;
  align-items: center;
  gap: 14rpx;
  border-bottom: 1rpx solid #eef3ef;
}

.field-label {
  width: 180rpx;
  flex: 0 0 auto;
  color: #4b6052;
  font-size: 23rpx;
  font-weight: 600;
}

.field input {
  min-width: 0;
  flex: 1;
  color: #263e2f;
  font-size: 24rpx;
  text-align: right;
}

.field.code-field input {
  text-align: left;
}

.code-field button {
  width: 150rpx;
  height: 58rpx;
  border: 1rpx solid #abd7bd;
  border-radius: 10rpx;
  background: #eff9f3;
  color: #14764a;
  font-size: 19rpx;
}

.code-field button[disabled] {
  opacity: .5;
}

.hint-box {
  margin-top: 22rpx;
  padding: 16rpx 18rpx;
  border: 1rpx solid #dcece3;
  border-radius: 12rpx;
  background: #f5fbf7;
  color: #6f8377;
  font-size: 20rpx;
  line-height: 1.65;
}

.primary-button,
.secondary-button,
.verify-button {
  height: 84rpx;
  margin-top: 22rpx;
  border-radius: 14rpx;
  font-size: 25rpx;
  font-weight: 700;
}

.primary-button {
  border: none;
  background: linear-gradient(135deg, #12764a, #1aa362);
  color: #fff;
  box-shadow: 0 10rpx 24rpx rgba(18, 118, 74, .18);
}

.secondary-button {
  border: 1rpx solid #c9ddd1;
  background: #fff;
  color: #3d6650;
}

.primary-button[disabled],
.secondary-button[disabled],
.verify-button[disabled] {
  opacity: .52;
}

.identity-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14rpx;
  margin-bottom: 12rpx;
}

.identity-grid button,
.identity-grid uni-button {
  display: flex;
  min-height: 190rpx;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
  padding: 20rpx;
  border: 1rpx solid #dfe9e3;
  border-radius: 16rpx;
  background: #fbfdfc;
  text-align: left;
}

.identity-grid button.on,
.identity-grid uni-button.on {
  border-color: #159a5e;
  background: #eefaf3;
  box-shadow: 0 0 0 3rpx rgba(21, 154, 94, .07);
}

.identity-icon {
  display: grid;
  width: 48rpx;
  height: 48rpx;
  place-items: center;
  border-radius: 13rpx;
  background: #e0f3e8;
  color: #117a49;
  font-size: 23rpx;
  font-weight: 800;
}

.identity-title {
  color: #284633;
  font-size: 24rpx;
  font-weight: 800;
}

.identity-desc {
  color: #7e9084;
  font-size: 18rpx;
  line-height: 1.5;
}

.status-pill {
  padding: 5rpx 12rpx;
  border-radius: 999rpx;
  background: #edf3ef;
  color: #667a6e !important;
}

.status-pill.pending {
  background: #fff4dd;
  color: #a15c00 !important;
}

.status-pill.done {
  background: #e3f7eb;
  color: #0e7144 !important;
}

.verify-summary {
  display: grid;
  gap: 14rpx;
  padding: 18rpx;
  border: 1rpx solid #e2ebe6;
  border-radius: 14rpx;
  background: #f8fbf9;
}

.verify-summary view,
.verify-summary uni-view {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  color: #7b8d82;
  font-size: 20rpx;
}

.verify-summary strong {
  color: #365440;
  font-weight: 650;
  text-align: right;
}

.verify-actions {
  display: grid;
  gap: 12rpx;
  margin-top: 18rpx;
}

.verify-actions button,
.verify-actions uni-button,
.upload-grid button,
.upload-grid uni-button {
  display: flex;
  flex-direction: column;
  gap: 5rpx;
  padding: 17rpx 18rpx;
  border: 1rpx solid #dbe8df;
  border-radius: 13rpx;
  background: #fff;
  color: #355441;
  text-align: left;
}

.verify-actions button text,
.verify-actions uni-button uni-text,
.upload-grid button strong,
.upload-grid uni-button strong {
  font-size: 22rpx;
  font-weight: 700;
}

.verify-actions button small,
.verify-actions uni-button small,
.upload-grid button small,
.upload-grid uni-button small {
  color: #829389;
  font-size: 18rpx;
}

.verify-actions button.done,
.verify-actions uni-button.done,
.upload-grid button.done,
.upload-grid uni-button.done {
  border-color: #a9d9bb;
  background: #effaf3;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  margin: 18rpx 0;
}

.upload-grid button,
.upload-grid uni-button {
  min-width: 0;
  align-items: flex-start;
  padding: 14rpx;
}

.upload-grid button > text,
.upload-grid uni-button > uni-text {
  display: grid;
  width: 36rpx;
  height: 36rpx;
  place-items: center;
  border-radius: 50%;
  background: #e7f5ed;
  color: #14764a;
  font-size: 20rpx;
  font-weight: 800;
}

.verify-button {
  width: 100%;
  border: 1rpx solid #9ccdb1;
  background: #eef9f3;
  color: #116f44;
}

.agreement {
  display: flex;
  align-items: flex-start;
  gap: 8rpx;
  margin-top: 22rpx;
  color: #75877c;
  font-size: 19rpx;
  line-height: 1.6;
}

.agreement checkbox {
  transform: scale(.75);
}

.state-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 9rpx;
  padding: 36rpx 24rpx;
  border-radius: 16rpx;
  text-align: center;
}

.state-card.pending {
  background: #fff8e8;
}

.state-card.done {
  background: #eefaf3;
}

.state-icon {
  display: grid;
  width: 64rpx;
  height: 64rpx;
  place-items: center;
  border-radius: 50%;
  background: #159a5e;
  color: #fff;
  font-size: 26rpx;
  font-weight: 800;
}

.state-title {
  color: #2b4c38;
  font-size: 26rpx;
  font-weight: 800;
}

.state-desc {
  color: #75887c;
  font-size: 20rpx;
  line-height: 1.6;
}

.bottom-link {
  display: flex;
  justify-content: center;
  gap: 10rpx;
  padding: 28rpx 0 0;
  color: #809087;
  font-size: 21rpx;
}

.bottom-link text:last-child,
.bottom-link uni-text:last-child {
  color: #14764a;
  font-weight: 700;
}
</style>
