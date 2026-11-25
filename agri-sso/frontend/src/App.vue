<template>
  <div class="auth-shell">
    <div class="auth-topbar">
      <a class="tb-left" :href="homeUrl"><Icon name="back" :size="14" />返回首页</a>
      <span class="tb-right">统一认证中心 · {{ isRegister ? '账号注册' : forgotOpen ? '找回密码' : '安全登录' }}</span>
    </div>

    <div class="auth-wrap">
      <div class="auth-card">
        <!-- 左侧品牌栏 -->
        <aside v-if="isRegister" class="auth-aside">
          <div class="aside-brand">
            <span class="logo"><BrandMark :size="44" /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </div>
          <div class="aside-body">
            <div class="aside-title">先创建账号<br />再开通会员能力</div>
            <div class="aside-sub">
              丰链云采用「账号 → 主体 → 认证」三段式开通流程。本页将一次收集账号与主体资料，
              提交后进入平台认证审核。
            </div>
            <div class="flow-list">
              <div class="flow-item on"><span class="n">1</span><div><strong>注册账号 / 登录账号</strong><small>手机号 + 验证码 + 密码，创建登录凭证</small></div></div>
              <div class="flow-item"><span class="n">2</span><div><strong>创建主体会员</strong><small>选择企业或个人类型，登记主体信息</small></div></div>
              <div class="flow-item"><span class="n">3</span><div><strong>认证审核 · 开通权限</strong><small>材料审核通过后，自动开通交易 / 金融 / 溯源能力</small></div></div>
            </div>
            <div class="aside-stats">
              <div><div class="n">38万+</div><div class="d">注册账号</div></div>
              <div><div class="n">12,800+</div><div class="d">认证主体</div></div>
              <div><div class="n">4.2h</div><div class="d">平均审核时长</div></div>
            </div>
          </div>
        </aside>

        <aside v-else-if="forgotOpen" class="auth-aside">
          <div class="aside-brand">
            <span class="logo"><BrandMark :size="44" /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </div>
          <div class="aside-body">
            <div class="aside-title">找回密码<br />安全地重新进入</div>
            <div class="aside-sub">
              通过注册手机号验证身份后设置新密码。整个过程不需要旧密码，也不会把验证码回显在页面上。
            </div>
            <div class="flow-list">
              <div class="flow-item on"><span class="n">1</span><div><strong>验证本人身份</strong><small>验证码只发送到注册手机号，5 分钟内有效</small></div></div>
              <div class="flow-item"><span class="n">2</span><div><strong>设置新密码</strong><small>8-20 位，同时包含字母和数字，避开连续数字与生日</small></div></div>
              <div class="flow-item"><span class="n">3</span><div><strong>全端退出</strong><small>重置成功后，该账号在所有设备上的登录立即失效</small></div></div>
            </div>
          </div>
        </aside>

        <aside v-else class="auth-aside">
          <div class="aside-brand">
            <span class="logo"><BrandMark :size="44" /></span>
            <span>丰链云<small>FENGCHAIN · AGRI</small></span>
          </div>
          <div class="aside-body">
            <div class="aside-title">登录丰链云<br />继续您的产业协作</div>
            <div class="aside-sub">
              登录后系统会自动识别您所处的环节：未创建主体将引导登记，未认证将引导提交材料，
              已认证则直接进入会员中心。
            </div>
            <div class="flow-list">
              <div class="flow-item on"><span class="n">1</span><div><strong>注册账号 / 登录账号</strong><small>手机号 + 验证码 / 账号密码，仅用于身份登录</small></div></div>
              <div class="flow-item"><span class="n">2</span><div><strong>创建主体会员</strong><small>登录后登记企业或个人主体，取得交易身份</small></div></div>
              <div class="flow-item"><span class="n">3</span><div><strong>认证审核 · 开通权限</strong><small>审核通过后自动开通交易 / 金融 / 溯源等功能</small></div></div>
            </div>
            <div class="aside-stats">
              <div><div class="n">12,800+</div><div class="d">认证企业</div></div>
              <div><div class="n">480万吨</div><div class="d">年撮合交易量</div></div>
              <div><div class="n">86%</div><div class="d">撮合成功率</div></div>
            </div>
          </div>
        </aside>

        <main class="auth-main">
          <div class="mobile-brand"><span class="logo"><BrandMark :size="30" /></span>丰链云</div>

          <!-- 注册与分步认证视图 -->
          <template v-if="isRegister">
            <div class="form-title">注册与认证</div>
            <div class="form-sub">注册账号、创建主体、认证开通可分步完成，也可暂时保存后继续</div>

            <div class="steps">
              <button type="button" :class="['step', { on: regStep >= 1 }]" @click="goToStep(1)">1 注册账号</button>
              <button type="button" :class="['step', { on: regStep >= 2 }]" :disabled="!accountCreated" @click="goToStep(2)">2 创建主体</button>
              <button type="button" :class="['step', { on: regStep >= 3 }]" :disabled="!onboardingMerchantId" @click="goToStep(3)">3 认证开通</button>
            </div>

            <form class="auth-form" @submit.prevent="handleRegisterSubmit">
              <template v-if="regStep === 1">
                <div class="form-section">1. 注册账号<small>手机号、验证码与登录密码</small></div>

                <label class="auth-field">
                  联系电话<span class="req">*</span>
                  <input
                    class="auth-input"
                    type="tel"
                    :value="reg.phone"
                    maxlength="11"
                    inputmode="numeric"
                    autocomplete="tel"
                    placeholder="请输入 11 位手机号"
                    @input="patchReg({ phone: ($event.target as HTMLInputElement).value.replace(/\D/g, '') })"
                  />
                </label>

                <label class="auth-field">
                  短信验证码<span class="req">*</span>
                  <div class="code-row">
                    <input
                      class="auth-input"
                      :value="reg.code"
                      maxlength="6"
                      inputmode="numeric"
                      placeholder="6 位验证码"
                      @input="patchReg({ code: ($event.target as HTMLInputElement).value.replace(/\D/g, '') })"
                    />
                    <button
                      type="button"
                      class="btn-code"
                      :disabled="sending !== null || registerLeft > 0"
                      @click="requestCode('register', reg.phone, 'register')"
                    >
                      {{ sending === 'register' ? '发送中…' : registerLeft > 0 ? `重新获取（${registerLeft}s）` : '获取验证码' }}
                    </button>
                  </div>
                </label>

                <div class="form-grid">
                  <label class="auth-field">
                    设置密码<span class="req">*</span>
                    <PasswordInput
                      label="密码"
                      :model-value="reg.password"
                      :max-length="20"
                      auto-complete="new-password"
                      placeholder="8-20 位字母+数字"
                      @update:model-value="(value) => patchReg({ password: value })"
                    />
                    <span :class="['pwd-meter', strength]"><i /><i /><i /></span>
                  </label>
                  <label class="auth-field">
                    确认密码<span class="req">*</span>
                    <PasswordInput
                      label="确认密码"
                      :model-value="reg.confirm"
                      :max-length="20"
                      auto-complete="new-password"
                      placeholder="再次输入密码"
                      @update:model-value="(value) => patchReg({ confirm: value })"
                    />
                  </label>
                </div>

                <label class="auth-field">
                  称呼 <small class="muted">选填</small>
                  <input
                    class="auth-input"
                    :value="reg.nickname"
                    maxlength="20"
                    placeholder="如：王经理（用于平台内展示，可后续修改）"
                    @input="patchReg({ nickname: ($event.target as HTMLInputElement).value })"
                  />
                </label>

                <div class="auth-notice">
                  注册账号、创建主体、认证开通可分步完成。账号创建成功后即可暂时退出，稍后从认证中心继续。
                </div>

                <div v-if="accountCreated" class="auth-step-actions">
                  <button type="button" class="auth-submit" @click="goToStep(2)">创建经营主体</button>
                  <button type="button" class="auth-back" @click="finishOnboardingForNow">稍后继续</button>
                </div>
                <button v-else type="submit" class="auth-submit" style="margin-top: 18px" :disabled="busy">
                  {{ busy ? '创建中…' : '创建登录账号' }}
                </button>
              </template>

              <template v-else-if="regStep === 2">
                <div class="form-section">2. 创建主体<small>选择企业或个人会员，登记经营主体</small></div>

                <div class="auth-field">
                  <span>注册身份</span>
                  <div class="identity-cards">
                    <label :class="['identity-card', { on: reg.identity === 'enterprise' }]">
                      <input type="radio" name="register-identity" :checked="reg.identity === 'enterprise'" @change="patchReg({ identity: 'enterprise' })" />
                      <span class="ic"><Icon name="factory" :size="18" /></span>
                      <span><strong>企业会员</strong><small>支持采购 / 供应 / 金融，需资质认证</small></span>
                    </label>
                    <label :class="['identity-card', { on: reg.identity === 'personal' }]">
                      <input type="radio" name="register-identity" :checked="reg.identity === 'personal'" @change="patchReg({ identity: 'personal' })" />
                      <span class="ic"><Icon name="user" :size="18" /></span>
                      <span><strong>个人会员</strong><small>合作社 / 家庭农场 / 采购个体户</small></span>
                    </label>
                  </div>
                </div>

                <template v-if="reg.identity === 'enterprise'">
                  <div class="form-grid">
                    <label class="auth-field">
                      企业名称<span class="req">*</span>
                      <input class="auth-input" :value="reg.companyName" placeholder="与营业执照一致" @input="patchReg({ companyName: ($event.target as HTMLInputElement).value })" />
                    </label>
                    <label class="auth-field">
                      统一社会信用代码<span class="req">*</span>
                      <input class="auth-input" :value="reg.creditCode" maxlength="18" placeholder="15-18 位字母数字" @input="patchReg({ creditCode: ($event.target as HTMLInputElement).value.replace(/\s/g, '') })" />
                    </label>
                  </div>
                  <label class="auth-field">
                    法定代表人<span class="req">*</span>
                    <input class="auth-input" :value="reg.legalPerson" placeholder="请输入法定代表人或经营者姓名" @input="patchReg({ legalPerson: ($event.target as HTMLInputElement).value })" />
                  </label>
                  <div class="form-grid">
                    <label class="auth-field">
                      所属行业
                      <select class="auth-input auth-select" :value="reg.industry" @change="patchReg({ industry: ($event.target as HTMLSelectElement).value })">
                        <option v-for="item in INDUSTRIES" :key="item" :value="item">{{ item }}</option>
                      </select>
                    </label>
                    <label class="auth-field">
                      企业规模
                      <select class="auth-input auth-select" :value="reg.companySize" @change="patchReg({ companySize: ($event.target as HTMLSelectElement).value })">
                        <option v-for="item in COMPANY_SIZES" :key="item" :value="item">{{ item }}</option>
                      </select>
                    </label>
                  </div>
                  <label class="auth-field">
                    注册地址
                    <input class="auth-input" :value="reg.address" placeholder="省 / 市 / 区 / 详细地址" @input="patchReg({ address: ($event.target as HTMLInputElement).value })" />
                  </label>
                </template>

                <template v-else>
                  <label class="auth-field">
                    真实姓名<span class="req">*</span>
                    <input class="auth-input" :value="reg.realName" placeholder="请输入真实姓名" @input="patchReg({ realName: ($event.target as HTMLInputElement).value })" />
                  </label>
                  <label class="auth-field">
                    身份证号<span class="req">*</span>
                    <input class="auth-input" :value="reg.idCard" maxlength="18" placeholder="18 位身份证号（仅存掩码与摘要）" @input="patchReg({ idCard: ($event.target as HTMLInputElement).value.replace(/\s/g, '') })" />
                  </label>
                  <label class="auth-field">
                    经营类型
                    <select class="auth-input auth-select" :value="reg.businessType" @change="patchReg({ businessType: ($event.target as HTMLSelectElement).value })">
                      <option v-for="item in BUSINESS_TYPES" :key="item" :value="item">{{ item }}</option>
                    </select>
                  </label>
                </template>

                <label class="auth-field">
                  联系人姓名<span class="req">*</span>
                  <input class="auth-input" :value="reg.contactName" placeholder="用于接收重要通知" @input="patchReg({ contactName: ($event.target as HTMLInputElement).value })" />
                </label>
                <label class="auth-field">
                  联系电话
                  <input
                    class="auth-input"
                    type="tel"
                    :value="reg.contactPhone"
                    maxlength="11"
                    :placeholder="reg.phone || '默认使用登录手机号'"
                    @input="patchReg({ contactPhone: ($event.target as HTMLInputElement).value.replace(/\D/g, '') })"
                  />
                </label>

                <div class="auth-step-actions">
                  <button v-if="!accountCreated" type="button" class="auth-back" @click="goToStep(1)">上一步</button>
                  <button type="submit" class="auth-submit">保存并继续认证</button>
                  <button type="button" class="auth-back" :disabled="busy" @click="createSubjectStep(false)">仅保存主体</button>
                </div>
              </template>

              <template v-else>
                <div class="form-section">3. 认证开通<small>前置核验通过后提交平台审核</small></div>

                <section :class="['verification-card', reg.identity]">
                  <div class="verification-card-head">
                    <div>
                      <span class="verification-eyebrow">{{ reg.identity === 'enterprise' ? '企业实名（当前主体）' : '个人实名' }}</span>
                      <b>{{ reg.identity === 'enterprise' ? (reg.companyName || '企业主体') : (reg.realName || reg.nickname || '个人主体') }}</b>
                    </div>
                    <span :class="['verification-status', onboardingStage]">
                      {{
                        onboardingStage === 'done'
                          ? '✓ 已认证'
                          : onboardingStage === 'pending'
                            ? '审核中'
                            : certificationStatus === 'rejected'
                              ? '需补正认证'
                              : '待认证'
                      }}
                    </span>
                  </div>

                  <div v-if="reviewRemark" class="auth-notice" role="status">
                    <strong>审核意见：</strong>{{ reviewRemark }}
                    <small v-if="reviewTime"> · {{ reviewTime.replace('T', ' ') }}</small>
                    <button v-if="certificationStatus === 'rejected'" type="button" class="btn-ghost" @click="goToStep(2)">返回主体资料补正</button>
                  </div>

                  <div v-if="onboardingStage !== 'done'" class="verification-timeline">
                    <div
                      v-for="(item, index) in verificationTimeline"
                      :key="item.label"
                      :class="['verification-step', { done: item.done }]"
                    >
                      <span>{{ item.done ? '✓' : index + 1 }}</span>
                      <small>{{ item.label }}</small>
                    </div>
                  </div>

                  <div class="verification-facts">
                    <template v-if="reg.identity === 'enterprise'">
                      <div><span>企业名称</span><b>{{ reg.companyName || '—' }}</b></div>
                      <div><span>统一信用代码</span><b>{{ reg.creditCode || '—' }}</b></div>
                      <div><span>法定代表人</span><b>{{ reg.legalPerson || '—' }}</b></div>
                      <div><span>注册资本</span><b>{{ enterpriseVerification.registeredCapital || '—' }}</b></div>
                      <div><span>认证方式</span><b>法人扫脸 + 对公打款</b></div>
                      <div>
                        <span>核验状态</span>
                        <b>{{
                          onboardingStage === 'done'
                            ? '主体认证已通过（核验明细请查看主体档案）'
                            : enterpriseVerification.legalPersonFaceStatus === 'verified'
                              ? '法人扫脸已通过'
                              : '待法人扫脸'
                        }}</b>
                      </div>
                    </template>
                    <template v-else>
                      <div><span>姓名</span><b>{{ reg.realName || '—' }}</b></div>
                      <div><span>证件类型</span><b>居民身份证</b></div>
                      <div>
                        <span>证件号码</span>
                        <b>{{
                          reg.idCard.length === 18
                            ? `${reg.idCard.slice(0, 3)}***********${reg.idCard.slice(-4)}`
                            : (identityIdMasked || '已安全保存')
                        }}</b>
                      </div>
                      <div><span>认证渠道</span><b>公安二要素 + 活体</b></div>
                      <div><span>活体检测</span><b>{{ personalVerification.livenessVerified ? '已通过' : '待检测' }}</b></div>
                      <div><span>公安比对</span><b>{{ personalVerification.policeVerified ? '已通过' : '待核验' }}</b></div>
                    </template>
                  </div>

                  <div v-if="onboardingStage === 'pending'" class="auth-notice">
                    认证申请已提交，平台正在审核；审核通过后认证状态自动生效。
                  </div>
                  <div v-else-if="onboardingStage === 'done'" class="auth-notice">
                    当前主体已完成认证。
                    <button type="button" class="link-button" @click="finishOnboardingForNow">进入平台 →</button>
                  </div>
                  <template v-else-if="reg.identity === 'personal'">
                    <label v-if="!reg.idCard" class="auth-field verification-inline-field">
                      身份证号<span class="req">*</span>
                      <input
                        class="auth-input"
                        :value="reg.idCard"
                        maxlength="18"
                        placeholder="请重新输入 18 位身份证号用于公安核验"
                        @input="patchReg({ idCard: ($event.target as HTMLInputElement).value.replace(/\s/g, '').toUpperCase() })"
                      />
                    </label>
                    <div class="verification-actions-grid">
                      <button
                        type="button"
                        :class="['verification-action', { done: personalVerification.policeVerified }]"
                        :disabled="verificationSubmitting || onboardingStage === 'pending'"
                        @click="verifyPersonalEvidence('police')"
                      >
                        <strong>{{ personalVerification.policeVerified ? '✓ 公安二要素已通过' : '公安二要素核验' }}</strong>
                        <small>校验证件姓名与号码是否一致</small>
                      </button>
                      <button
                        type="button"
                        :class="['verification-action', { done: personalVerification.livenessVerified }]"
                        :disabled="verificationSubmitting || onboardingStage === 'pending'"
                        @click="verifyPersonalEvidence('liveness')"
                      >
                        <strong>{{ personalVerification.livenessVerified ? '✓ 人脸活体已通过' : '开始人脸活体检测' }}</strong>
                        <small>完成活体动作后进行公安库比对</small>
                      </button>
                    </div>
                    <div class="verification-tip">
                      <b>AI 认证加速</b>
                      本地联调环境使用模拟核验通道；生产环境将接入合规公安二要素和活体服务。
                    </div>
                  </template>
                  <template v-else>
                    <div class="verification-form-grid">
                      <label class="auth-field">
                        法定代表人<span class="req">*</span>
                        <input class="auth-input" :value="reg.legalPerson" @input="patchReg({ legalPerson: ($event.target as HTMLInputElement).value })" />
                      </label>
                      <label class="auth-field">
                        注册资本
                        <input v-model="enterpriseVerification.registeredCapital" class="auth-input" placeholder="如：5000 万元" />
                      </label>
                      <label class="auth-field">
                        对公账户户名<span class="req">*</span>
                        <input v-model="enterpriseVerification.corporateBankName" class="auth-input" placeholder="与营业执照企业名称一致" />
                      </label>
                      <label class="auth-field">
                        对公账户账号<span class="req">*</span>
                        <input
                          class="auth-input"
                          :value="enterpriseVerification.corporateBankAccount"
                          placeholder="仅保存账户掩码"
                          @input="enterpriseVerification.corporateBankAccount = ($event.target as HTMLInputElement).value.replace(/[^\d\s]/g, '')"
                        />
                      </label>
                      <label class="auth-field">
                        打款验证金额<span class="req">*</span>
                        <input
                          class="auth-input"
                          :value="enterpriseVerification.corporateTransferAmount"
                          placeholder="如：0.37"
                          @input="enterpriseVerification.corporateTransferAmount = ($event.target as HTMLInputElement).value.replace(/[^\d.]/g, '')"
                        />
                      </label>
                      <label class="auth-field">
                        打款流水号<span class="req">*</span>
                        <input v-model="enterpriseVerification.corporateTransferReference" class="auth-input" placeholder="银行回单流水号" />
                      </label>
                    </div>

                    <div class="verification-uploads">
                      <label
                        v-for="item in enterpriseUploadItems"
                        :key="item.kind"
                        :class="['verification-upload', { done: Boolean(item.url) }]"
                      >
                        <span class="verification-upload-icon">{{ item.url ? '✓' : '+' }}</span>
                        <strong>{{ item.url ? `${item.label}已上传` : `上传${item.label}` }}</strong>
                        <small>{{ verificationUploading === item.kind ? '上传中…' : item.hint }}</small>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          :capture="item.capture ? 'user' : undefined"
                          :disabled="Boolean(verificationUploading) || verificationSubmitting"
                          @change="onEvidenceFileChange(item.kind, $event)"
                        />
                      </label>
                    </div>

                    <button
                      type="button"
                      class="verification-verify-button"
                      :disabled="verificationSubmitting || verificationUploading !== ''"
                      @click="prepareEnterpriseEvidence"
                    >
                      {{
                        verificationSubmitting
                          ? '校验中…'
                          : enterpriseVerification.legalPersonFaceStatus === 'verified'
                            ? '✓ 前置核验已通过，可提交审核'
                            : '校验法人扫脸与对公打款材料'
                      }}
                    </button>
                    <div class="verification-tip">
                      <b>AI 认证加速</b>
                      执照 OCR、工商信息比对通过后自动通过法人扫脸；对公打款凭证由平台财务复核。
                    </div>
                  </template>
                </section>

                <template v-if="onboardingStage !== 'pending' && onboardingStage !== 'done'">
                  <label class="agreement">
                    <input type="checkbox" :checked="reg.agree" @change="patchReg({ agree: ($event.target as HTMLInputElement).checked })" />
                    <span>
                      我确认资料真实有效并同意
                      <a href="#protocol" @click.prevent="notice = '《丰链云用户服务协议》全文尚未在本页发布，请联系平台运营获取正式文本。'">《丰链云用户服务协议》</a>、
                      <a href="#privacy" @click.prevent="notice = '《隐私政策》全文尚未在本页发布，请联系平台运营获取正式文本。'">《隐私政策》</a> 及
                      <a href="#rules" @click.prevent="notice = '《企业入驻规则》全文尚未在本页发布，请联系平台运营获取正式文本。'">《企业入驻规则》</a>
                    </span>
                  </label>
                  <div class="auth-step-actions">
                    <button type="button" class="auth-back" @click="goToStep(2)">上一步</button>
                    <button type="submit" class="auth-submit" :disabled="busy || verificationSubmitting || !certificationReady">
                      {{ busy ? '提交中…' : !certificationReady ? '请先完成前置核验' : '提交认证并开通' }}
                    </button>
                    <button type="button" class="auth-back" @click="finishOnboardingForNow">稍后完成</button>
                  </div>
                  <div class="auth-notice">
                    主体资料已保存。认证开通可以稍后继续，认证通过前不会获得交易、签约和金融权限。
                  </div>
                </template>
              </template>

              <div v-if="contextMissing" class="auth-notice">当前为独立注册：账号会正常创建并登录认证中心，完成后请从子系统入口进入。</div>
              <div v-if="error !== ''" class="auth-error">{{ error }}</div>
              <div v-if="hint !== ''" class="auth-hint">{{ hint }}</div>
              <div v-if="notice !== ''" class="auth-notice">{{ notice }}</div>
            </form>

            <div class="auth-foot">
              已有账号？
              <button type="button" @click="switchView('/login')">直接登录 →</button>
              <button type="button" @click="goOpsConsole">平台运营端 →</button>
            </div>
          </template>

          <!-- 冻结申诉视图 -->
          <template v-else-if="appealOpen">
            <div class="form-title">提交冻结申诉</div>
            <div class="form-sub">账号被冻结后无法登录，因此这里不需要密码。填写注册手机号与申诉理由，运营会人工复核。</div>
            <button type="button" class="auth-reset-back" @click="closeAppeal">← 返回登录</button>
            <template v-if="appealDone !== ''">
              <div class="auth-notice">{{ appealDone }}</div>
              <div class="auth-hint">
                申诉不会自动解封，需运营复核后处理。结果会以站内信通知，也可稍后重新尝试登录查看是否已解除。
              </div>
            </template>
            <form v-else class="auth-form" @submit.prevent="submitAppeal">
              <label class="auth-field">
                注册手机号
                <input
                  class="auth-input"
                  type="tel"
                  :value="appealForm.phone"
                  maxlength="11"
                  inputmode="numeric"
                  autocomplete="tel"
                  placeholder="请输入 11 位手机号"
                  @input="appealForm.phone = ($event.target as HTMLInputElement).value.replace(/\D/g, ''); error = ''"
                />
              </label>
              <label class="auth-field">
                申诉理由
                <textarea
                  v-model="appealForm.reason"
                  class="auth-input"
                  rows="4"
                  maxlength="500"
                  placeholder="请说明情况，例如：账号因异常登录被冻结，本人可提供身份证明配合核实"
                  style="resize: vertical; min-height: 96px; line-height: 1.7"
                  @input="error = ''"
                />
              </label>
              <button type="submit" class="auth-submit" :disabled="appealBusy">{{ appealBusy ? '提交中…' : '提交申诉' }}</button>
              <div v-if="error !== ''" class="auth-error">{{ error }}</div>
              <div class="auth-hint">同一账号只能有一条待处理申诉；驳回后可补充说明重新提交。</div>
            </form>
          </template>

          <!-- 找回密码视图 -->
          <template v-else-if="forgotOpen">
            <div class="form-title">{{ resetStep === 3 ? '密码已重置' : '找回密码' }}</div>
            <div class="form-sub">
              {{
                resetStep === 1
                  ? '验证注册手机号，确认是本人在操作；验证码 5 分钟内有效。'
                  : resetStep === 2
                    ? '设置新密码。提交成功后，该账号在所有设备上的登录会立即失效。'
                    : '新密码已生效，旧密码与已登录的会话都不能再使用。'
              }}
            </div>
            <button v-if="resetStep < 3" type="button" class="auth-reset-back" @click="closeForgot">← 返回登录</button>

            <ol class="reset-steps" aria-label="找回密码步骤">
              <li
                v-for="item in resetStepsMeta"
                :key="item.step"
                :class="resetStep === item.step ? 'on' : resetStep > item.step ? 'done' : ''"
                :aria-current="resetStep === item.step ? 'step' : undefined"
              >
                <i>{{ resetStep > item.step ? '✓' : item.step }}</i>
                <span>{{ item.label }}</span>
              </li>
            </ol>

            <form v-if="resetStep === 1" class="auth-form" @submit.prevent="goResetStep2">
              <label class="auth-field">
                注册手机号<span class="req">*</span>
                <input
                  class="auth-input"
                  type="tel"
                  :value="resetForm.phone"
                  maxlength="11"
                  inputmode="numeric"
                  autocomplete="tel"
                  autofocus
                  placeholder="请输入 11 位手机号"
                  @input="handleResetPhoneInput"
                />
              </label>
              <label class="auth-field">
                短信验证码<span class="req">*</span>
                <div class="code-row">
                  <input
                    class="auth-input"
                    :value="resetForm.code"
                    maxlength="6"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    placeholder="6 位验证码"
                    @input="resetForm.code = ($event.target as HTMLInputElement).value.replace(/\D/g, ''); error = ''"
                  />
                  <button
                    type="button"
                    class="btn-code"
                    :disabled="sending !== null || resetLeft > 0"
                    @click="requestCode('reset_password', resetForm.phone, 'reset')"
                  >
                    {{
                      sending === 'reset'
                        ? '发送中…'
                        : resetLeft > 0
                          ? `重新获取（${resetLeft}s）`
                          : resetSentPhone !== '' && resetSentPhone === resetForm.phone
                            ? '重新获取'
                            : '获取验证码'
                    }}
                  </button>
                </div>
              </label>
              <button type="submit" class="auth-submit" :disabled="busy">下一步</button>
              <div v-if="error !== ''" class="auth-error" role="alert">{{ error }}</div>
              <div v-if="hint !== ''" class="auth-hint">{{ hint }}</div>
              <div class="auth-hint">没收到验证码？先确认手机号填写正确，60 秒后可重新获取。同一验证码连续输错会被作废，需要重新获取。</div>
            </form>

            <form v-else-if="resetStep === 2" class="auth-form" @submit.prevent="submitPasswordReset">
              <div class="reset-target">
                <span>正在重置 <strong>{{ maskPhone(resetForm.phone) }}</strong> 的登录密码</span>
                <button type="button" @click="resetStep = 1; error = ''">更换手机号</button>
              </div>
              <label class="auth-field">
                新密码<span class="req">*</span>
                <PasswordInput
                  label="新密码"
                  :model-value="resetForm.password"
                  :max-length="20"
                  auto-complete="new-password"
                  :auto-focus="true"
                  placeholder="8-20 位，同时包含字母和数字"
                  @update:model-value="(value) => { resetForm.password = value; error = '' }"
                />
                <span :class="['pwd-meter', resetStrength]" aria-hidden="true"><i /><i /><i /></span>
              </label>
              <label class="auth-field">
                确认新密码<span class="req">*</span>
                <PasswordInput
                  label="确认密码"
                  :model-value="resetForm.confirm"
                  :max-length="20"
                  auto-complete="new-password"
                  placeholder="请再次输入新密码"
                  @update:model-value="(value) => { resetForm.confirm = value; error = '' }"
                />
              </label>
              <ul class="pwd-rules" aria-label="密码规则">
                <li :class="{ ok: resetRules.length }">8-20 位</li>
                <li :class="{ ok: resetRules.letter }">含字母</li>
                <li :class="{ ok: resetRules.digit }">含数字</li>
                <li :class="{ ok: resetRules.match }">两次一致</li>
              </ul>
              <button type="submit" class="auth-submit" :disabled="busy">{{ busy ? '重置中…' : '确认重置密码' }}</button>
              <div v-if="error !== ''" class="auth-error" role="alert">{{ error }}</div>
              <div class="auth-hint">建议使用与其他网站不同的密码；手机号、生日、连续数字等易猜内容会被服务端拒绝。</div>
            </form>

            <div v-else class="reset-done">
              <div class="reset-done-icon" aria-hidden="true">✓</div>
              <p class="reset-done-text">
                手机号 <strong>{{ maskPhone(resetForm.phone) }}</strong> 的登录密码已更新，该账号在其它设备上的登录已全部退出。
              </p>
              <ul class="reset-done-tips">
                <li>请使用新密码重新登录；再次忘记时可重复本次流程。</li>
                <li>如果这不是你本人的操作，请立即联系平台客服冻结账号。</li>
              </ul>
              <button type="button" class="auth-submit" @click="backToLoginAfterReset">返回登录</button>
            </div>
          </template>

          <!-- 登录视图 -->
          <template v-else>
            <div class="form-title">欢迎回来</div>
            <div class="form-sub">登录后将自动识别您所处的账号环节，并引导至对应页面</div>

            <div v-if="mfaChallenge === ''" class="auth-tabs" role="tablist" aria-label="登录方式">
              <button type="button" role="tab" :aria-selected="tab === 'sms'" :class="{ on: tab === 'sms' }" @click="switchLoginTab('sms')">
                手机号 + 验证码
              </button>
              <button type="button" role="tab" :aria-selected="tab === 'pwd'" :class="{ on: tab === 'pwd' }" @click="switchLoginTab('pwd')">
                账号 + 密码
              </button>
            </div>

            <form class="auth-form" @submit.prevent="mfaChallenge ? submitMfa() : submitLogin()">
              <template v-if="mfaChallenge !== ''">
                <div class="auth-notice">
                  该账号已开启二次验证。请输入验证器（Google / 微软 Authenticator 等）上的 6 位动态码；
                  手机不在身边时，可用一个备用码登录（每个只能用一次）。
                </div>
                <label class="auth-field">
                  动态码 / 备用码
                  <input
                    class="auth-input"
                    :value="mfaCode"
                    maxlength="11"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    placeholder="6 位动态码，或 XXXX-XXXXX 备用码"
                    @input="mfaCode = ($event.target as HTMLInputElement).value.toUpperCase(); error = ''"
                  />
                </label>
              </template>

              <template v-else-if="tab === 'sms'">
                <label class="auth-field">
                  手机号
                  <input
                    class="auth-input"
                    type="tel"
                    :value="phone"
                    maxlength="11"
                    inputmode="numeric"
                    autocomplete="tel"
                    placeholder="请输入 11 位手机号"
                    @input="phone = ($event.target as HTMLInputElement).value.replace(/\D/g, ''); error = ''"
                  />
                </label>
                <label class="auth-field">
                  验证码
                  <div class="code-row">
                    <input
                      class="auth-input"
                      :value="smsCode"
                      maxlength="6"
                      inputmode="numeric"
                      placeholder="请输入 6 位验证码"
                      @input="smsCode = ($event.target as HTMLInputElement).value.replace(/\D/g, ''); error = ''"
                    />
                    <button
                      type="button"
                      class="btn-code"
                      :disabled="sending !== null || loginLeft > 0"
                      @click="requestCode('login', phone, 'login')"
                    >
                      {{ sending === 'login' ? '发送中…' : loginLeft > 0 ? `重新获取（${loginLeft}s）` : '获取验证码' }}
                    </button>
                  </div>
                </label>
              </template>

              <template v-else>
                <label class="auth-field">
                  账号
                  <input
                    v-model="account"
                    class="auth-input"
                    autocomplete="username"
                    placeholder="请输入手机号 / 用户名"
                    @input="error = ''"
                  />
                </label>
                <div class="auth-field">
                  <label for="login-password">密码</label>
                  <PasswordInput
                    id="login-password"
                    label="密码"
                    :model-value="password"
                    auto-complete="current-password"
                    placeholder="请输入登录密码"
                    @update:model-value="(value) => { password = value; error = '' }"
                  />
                </div>
              </template>

              <button type="submit" class="auth-submit" :disabled="busy">
                {{ busy ? '处理中…' : mfaChallenge !== '' ? '验 证' : '登 录' }}
              </button>

              <div v-if="mfaChallenge !== ''" class="auth-row">
                <button type="button" @click="cancelMfa">返回重新输入账号密码</button>
              </div>

              <div class="auth-row">
                <label><input v-model="remember" type="checkbox" />7 天内自动登录</label>
                <span style="display: flex; gap: 14px; align-items: center">
                  <button type="button" @click="openForgot">忘记密码？</button>
                  <button type="button" @click="openAppeal">账号被冻结？提交申诉</button>
                </span>
              </div>

              <div v-if="contextMissing" class="auth-notice">
                当前为独立登录：登录后会按账号开通阶段进入对应页面；如需返回原子系统，请从子系统入口登录。
              </div>
              <div v-if="error !== ''" class="auth-error">{{ error }}</div>
              <div v-if="hint !== ''" class="auth-hint">{{ hint }}</div>
              <div v-if="notice !== ''" class="auth-notice">{{ notice }}</div>

              <div v-if="mfaChallenge === ''" class="third-line">其他登录方式</div>
              <div class="third-icons">
                <button type="button" class="t-wechat" title="微信扫码" @click="showThirdNotice('微信扫码登录尚未接入：需要微信开放平台 AppID / AppSecret 与可公网回调的域名，配置后即可启用。')">
                  <ThirdPartyIcons provider="wechat" />
                </button>
                <button type="button" class="t-alipay" title="支付宝" @click="showThirdNotice('支付宝扫码登录尚未接入：需要支付宝开放平台应用与回调地址，配置后即可启用。')">
                  <ThirdPartyIcons provider="alipay" />
                </button>
                <button type="button" class="t-gov" title="国家政务服务平台" @click="showThirdNotice('国家政务服务平台统一登录尚未接入：需要完成平台对接与应用密钥配置。')">
                  <ThirdPartyIcons provider="gov" />
                </button>
              </div>
            </form>

            <div class="auth-foot">
              还没有账号？
              <button type="button" @click="switchView('/register')">立即免费注册 →</button>
            </div>
          </template>
        </main>
      </div>
    </div>

    <div v-if="success !== null" class="success-mask" role="dialog" aria-modal="true" aria-label="注册成功">
      <div class="success-card">
        <div class="check-icon"><Icon name="check" :size="34" /></div>
        <h3>注册成功！</h3>
        <p>
          欢迎加入丰链云，您的{{ IDENTITY_LABEL[success.identity] }}账号已创建{{
            success.redirect ? '并自动登录。' : '，并已登录认证中心。'
          }}{{
            success.identity === 'enterprise'
              ? '企业资质认证已随注册提交，平台审核通过后即可开展交易。'
              : success.hasIdCard
                ? '实名认证已随注册提交，平台审核通过后即可开展交易。'
                : '未填写身份证号，实名认证尚未提交，可联系平台运营补充。'
          }}
        </p>
        <div class="success-actions">
          <template v-if="success.redirect">
            <button type="button" class="ghost" @click="navigateTo(success.redirect || homeUrl)">查看认证进度</button>
            <button type="button" class="primary" @click="navigateTo(success.redirect || homeUrl)">进入首页</button>
          </template>
          <template v-else>
            <button type="button" class="ghost" @click="switchView('/login')">返回登录</button>
            <button type="button" class="primary" @click="navigateTo(platformEntry())">进入生产管理</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import BrandMark from './BrandMark.vue'
import Icon from './Icon.vue'
import PasswordInput from './PasswordInput.vue'
import ThirdPartyIcons from './ThirdPartyIcons.vue'

type LoginTab = 'sms' | 'pwd'
type Identity = 'enterprise' | 'personal'

interface RegisterForm {
  identity: Identity
  nickname: string
  companyName: string
  creditCode: string
  industry: string
  companySize: string
  address: string
  realName: string
  idCard: string
  businessType: string
  contactName: string
  legalPerson: string
  contactPhone: string
  phone: string
  code: string
  password: string
  confirm: string
  agree: boolean
}

interface SsoBody {
  code?: number
  message?: string
  data?: {
    redirect?: string
    hint?: string
    stage?: string
    phone?: string
    nickname?: string
    identity?: string
    subjectName?: string
    certificationStatus?: string
    reviewRemark?: string
    reviewTime?: string
    subject?: {
      creditCode?: string
      contactName?: string
      contactPhone?: string
      address?: string
      industry?: string
      companySize?: string
      businessType?: string
    }
    status?: string
    merchantId?: number | string
    mfaRequired?: boolean
    challengeToken?: string
    verification?: {
      channel?: string
      policeVerified?: boolean
      livenessVerified?: boolean
      businessLicenseUrl?: string
      legalPersonFaceUrl?: string
      legalPersonFaceStatus?: string
      corporateBankName?: string
      corporateBankAccount?: string
      corporateTransferAmount?: string
      corporateTransferReference?: string
      corporateTransferProofUrl?: string
      corporateTransferStatus?: string
      registeredCapital?: string
      idNoMasked?: string
      creditCode?: string
      legalPerson?: string
    }
  }
}

const INDUSTRIES = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '流通贸易', '加工制造', '其他']
const COMPANY_SIZES = ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）']
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他']
const IDENTITY_LABEL: Record<Identity, string> = { enterprise: '企业会员', personal: '个人会员' }
const resetStepsMeta = [
  { step: 1, label: '验证手机号' },
  { step: 2, label: '设置新密码' },
  { step: 3, label: '完成' },
]

function validCreditCode(raw: string): boolean {
  const code = raw.trim().toUpperCase()
  const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY'
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28]
  if (code.length !== 18 || [...code].some((c) => !chars.includes(c))) return false
  const sum = weights.reduce((total, weight, index) => total + chars.indexOf(code[index]) * weight, 0)
  return chars[(31 - (sum % 31)) % 31] === code[17]
}

const initialQuery = new URLSearchParams(window.location.search)
const ctx = {
  clientId: initialQuery.get('client_id') ?? '',
  redirectUri: initialQuery.get('redirect_uri') ?? '',
  state: initialQuery.get('state'),
  codeChallenge: initialQuery.get('code_challenge'),
  codeChallengeMethod: initialQuery.get('code_challenge_method'),
}
const homeUrl = `${window.location.protocol}//${window.location.hostname}:8098/portal/#/`
const isRegister =
  window.location.pathname.replace(/\/+$/, '').endsWith('/register') || initialQuery.get('mode') === 'register'
const contextMissing = ctx.clientId === '' || ctx.redirectUri === ''

function platformEntry(): string {
  return `${window.location.protocol}//${window.location.hostname}/production/login`
}

const RESET_COOLDOWN_KEY = 'agri_sso_reset_cooldown'
function readResetCooldown(phoneVal: string): number {
  if (!/^1[3-9]\d{9}$/.test(phoneVal)) return 0
  try {
    const raw = window.localStorage.getItem(RESET_COOLDOWN_KEY)
    if (!raw) return 0
    const saved = JSON.parse(raw) as { phone?: string; until?: number }
    if (saved.phone !== phoneVal || !saved.until) return 0
    return Math.max(0, Math.ceil((saved.until - Date.now()) / 1000))
  } catch {
    return 0
  }
}

function writeResetCooldown(phoneVal: string, seconds: number): void {
  try {
    window.localStorage.setItem(RESET_COOLDOWN_KEY, JSON.stringify({ phone: phoneVal, until: Date.now() + seconds * 1000 }))
  } catch {
    // 隐私模式降级
  }
}

function maskPhone(value: string): string {
  return /^\d{11}$/.test(value) ? `${value.slice(0, 3)}****${value.slice(7)}` : value
}

const tab = ref<LoginTab>('sms')
const phone = ref('')
const smsCode = ref('')
const account = ref('')
const password = ref('')
const remember = ref(true)
const forgotOpen = ref(initialQuery.get('mode') === 'forgot')

const appealOpen = ref(false)
const appealForm = reactive({ phone: '', reason: '' })
const appealBusy = ref(false)
const appealDone = ref('')

const resetForm = reactive({
  phone: initialQuery.get('mode') === 'forgot' ? (initialQuery.get('phone') ?? '').replace(/\D/g, '').slice(0, 11) : '',
  code: '',
  password: '',
  confirm: '',
})
const resetStep = ref<1 | 2 | 3>(1)
const resetSentPhone = ref('')

const reg = reactive<RegisterForm>({
  identity: initialQuery.get('identity') === 'personal' ? 'personal' : 'enterprise',
  nickname: '',
  companyName: '',
  creditCode: '',
  industry: INDUSTRIES[0],
  companySize: COMPANY_SIZES[0],
  address: '',
  realName: '',
  idCard: '',
  businessType: BUSINESS_TYPES[0],
  contactName: '',
  legalPerson: '',
  contactPhone: '',
  phone: '',
  code: '',
  password: '',
  confirm: '',
  agree: false,
})
const regStep = ref<1 | 2 | 3>(1)

const error = ref('')
const notice = ref('')
const hint = ref('')
const busy = ref(false)
const mfaChallenge = ref('')
const mfaCode = ref('')
const sending = ref<'login' | 'register' | 'reset' | null>(null)
const loginLeft = ref(0)
const registerLeft = ref(0)
const resetLeft = ref(0)
const success = ref<{ redirect: string | null; identity: Identity; hasIdCard: boolean } | null>(null)
const accountCreated = ref(false)
const onboardingStage = ref('')
const certificationStatus = ref('')
const reviewRemark = ref('')
const reviewTime = ref('')
const onboardingMerchantId = ref<string | null>(null)
const identityIdMasked = ref('')
const verificationUploading = ref('')
const verificationSubmitting = ref(false)

const personalVerification = reactive({ policeVerified: false, livenessVerified: false, channel: '' })
const enterpriseVerification = reactive({
  businessLicenseUrl: '',
  legalPersonFaceUrl: '',
  legalPersonFaceStatus: '',
  corporateBankName: '',
  corporateBankAccount: '',
  corporateTransferAmount: '',
  corporateTransferReference: '',
  corporateTransferProofUrl: '',
  corporateTransferStatus: '',
  registeredCapital: '',
  channel: '',
})

const enterpriseUploadItems = computed(() => [
  { kind: 'business_license' as const, label: '营业执照', hint: '完整清晰、在有效期内', url: enterpriseVerification.businessLicenseUrl, capture: false },
  { kind: 'legal_person_face' as const, label: '法人扫脸', hint: '调用摄像头采集法人面部', url: enterpriseVerification.legalPersonFaceUrl, capture: true },
  { kind: 'corporate_transfer_proof' as const, label: '对公打款凭证', hint: '银行回单或转账凭证', url: enterpriseVerification.corporateTransferProofUrl, capture: false },
])

const strength = computed(() => {
  const value = reg.password
  let score = 0
  if (value.length >= 8) score += 1
  if (/[a-zA-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^a-zA-Z0-9]/.test(value)) score += 1
  if (score >= 3 && value.length >= 10) return 'strong'
  if (score >= 2 && value.length >= 8) return 'fair'
  return ''
})

const resetStrength = computed(() => {
  const value = resetForm.password
  let score = 0
  if (value.length >= 8) score += 1
  if (/[a-zA-Z]/.test(value)) score += 1
  if (/\d/.test(value)) score += 1
  if (/[^a-zA-Z0-9]/.test(value)) score += 1
  if (score >= 3 && value.length >= 10) return 'strong'
  if (score >= 2 && value.length >= 8) return 'fair'
  return ''
})

const resetRules = computed(() => ({
  length: resetForm.password.length >= 8 && resetForm.password.length <= 20,
  letter: /[a-zA-Z]/.test(resetForm.password),
  digit: /\d/.test(resetForm.password),
  match: resetForm.password !== '' && resetForm.password === resetForm.confirm,
}))

const certificationReady = computed(() =>
  reg.identity === 'personal'
    ? personalVerification.policeVerified && personalVerification.livenessVerified
    : enterpriseVerification.legalPersonFaceStatus === 'verified' &&
      ['submitted', 'verified'].includes(enterpriseVerification.corporateTransferStatus),
)

const verificationTimeline = computed(() =>
  reg.identity === 'enterprise'
    ? [
        { label: '信息填写', done: Boolean(onboardingMerchantId.value) },
        { label: '执照 OCR', done: Boolean(enterpriseVerification.businessLicenseUrl) },
        { label: '工商比对', done: Boolean(reg.creditCode && reg.legalPerson) },
        {
          label: '法人验证',
          done:
            enterpriseVerification.legalPersonFaceStatus === 'verified' &&
            ['submitted', 'verified'].includes(enterpriseVerification.corporateTransferStatus),
        },
      ]
    : [
        { label: '证件 OCR', done: Boolean(reg.realName && (reg.idCard || onboardingMerchantId.value)) },
        { label: '人脸活体', done: personalVerification.livenessVerified },
        { label: '公安比对', done: personalVerification.policeVerified },
        { label: '完成', done: onboardingStage.value === 'pending' || onboardingStage.value === 'done' },
      ],
)

function applyOnboardingData(data: NonNullable<SsoBody['data']>): void {
  onboardingStage.value = data.stage ?? ''
  certificationStatus.value = data.certificationStatus ?? ''
  reviewRemark.value = data.reviewRemark ?? ''
  reviewTime.value = data.reviewTime ?? ''
  onboardingMerchantId.value = data.merchantId == null ? null : String(data.merchantId)
  accountCreated.value = true
  const evidence = data.verification
  if (evidence) {
    identityIdMasked.value = evidence.idNoMasked ?? ''
    personalVerification.policeVerified = Boolean(evidence.policeVerified)
    personalVerification.livenessVerified = Boolean(evidence.livenessVerified)
    personalVerification.channel = evidence.channel ?? ''
    enterpriseVerification.businessLicenseUrl = evidence.businessLicenseUrl ?? ''
    enterpriseVerification.legalPersonFaceUrl = evidence.legalPersonFaceUrl ?? ''
    enterpriseVerification.legalPersonFaceStatus = evidence.legalPersonFaceStatus ?? ''
    enterpriseVerification.corporateBankName = evidence.corporateBankName ?? ''
    enterpriseVerification.corporateBankAccount = evidence.corporateBankAccount ?? ''
    enterpriseVerification.corporateTransferAmount = evidence.corporateTransferAmount ?? ''
    enterpriseVerification.corporateTransferReference = evidence.corporateTransferReference ?? ''
    enterpriseVerification.corporateTransferProofUrl = evidence.corporateTransferProofUrl ?? ''
    enterpriseVerification.corporateTransferStatus = evidence.corporateTransferStatus ?? ''
    enterpriseVerification.registeredCapital = evidence.registeredCapital ?? ''
    enterpriseVerification.channel = evidence.channel ?? ''
  }
  if (data.phone) reg.phone = data.phone
  if (data.nickname) reg.nickname = data.nickname
  if (data.identity === 'personal') reg.identity = 'personal'
  else if (data.identity === 'enterprise') reg.identity = 'enterprise'
  if (data.identity === 'enterprise' && data.subjectName) reg.companyName = data.subjectName
  if (data.identity === 'personal' && data.subjectName) reg.realName = data.subjectName
  if (data.identity === 'enterprise') {
    reg.creditCode = data.subject?.creditCode ?? evidence?.creditCode ?? ''
    reg.legalPerson = evidence?.legalPerson ?? reg.legalPerson
  }
  reg.contactName = data.subject?.contactName ?? ''
  reg.contactPhone = data.subject?.contactPhone ?? ''
  reg.address = data.subject?.address ?? ''
  reg.industry = data.subject?.industry ?? ''
  reg.companySize = data.subject?.companySize ?? ''
  reg.businessType = data.subject?.businessType ?? ''
}

function patchReg(patch: Partial<RegisterForm>): void {
  Object.assign(reg, patch)
  error.value = ''
}

function goToStep(step: 1 | 2 | 3): void {
  const url = new URL(window.location.href)
  url.searchParams.set('step', String(step))
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  regStep.value = step
}

function switchView(path: '/login' | '/register'): void {
  const query = new URLSearchParams(window.location.search)
  for (const key of ['mode', 'step', 'newAccount', 'phone']) query.delete(key)
  if (path === '/register') query.set('newAccount', '1')
  window.location.href = path + (query.size ? `?${query.toString()}` : '')
}

function navigateTo(url: string): void {
  window.location.href = url
}

function goOpsConsole(): void {
  window.location.href = `${window.location.protocol}//${window.location.hostname}:8115/`
}

function switchLoginTab(next: LoginTab): void {
  tab.value = next
  error.value = ''
  notice.value = ''
}

function showThirdNotice(msg: string): void {
  notice.value = msg
  error.value = ''
}

function cancelMfa(): void {
  mfaChallenge.value = ''
  mfaCode.value = ''
  notice.value = ''
  error.value = ''
}

function openForgot(): void {
  forgotOpen.value = true
  resetStep.value = 1
  resetSentPhone.value = ''
  resetForm.phone = /^1[3-9]\d{9}$/.test(account.value.trim()) ? account.value.trim() : phone.value
  resetForm.code = ''
  resetForm.password = ''
  resetForm.confirm = ''
  error.value = ''
  hint.value = ''
  notice.value = ''
}

function openAppeal(): void {
  appealOpen.value = true
  appealForm.phone = /^1[3-9]\d{9}$/.test(account.value.trim()) ? account.value.trim() : phone.value
  appealForm.reason = ''
  appealDone.value = ''
  error.value = ''
  hint.value = ''
  notice.value = ''
}

function closeAppeal(): void {
  appealOpen.value = false
  error.value = ''
  notice.value = ''
  appealDone.value = ''
}

function closeForgot(): void {
  forgotOpen.value = false
  resetStep.value = 1
  resetForm.code = ''
  resetForm.password = ''
  resetForm.confirm = ''
  resetSentPhone.value = ''
  error.value = ''
  hint.value = ''
}

function backToLoginAfterReset(): void {
  forgotOpen.value = false
  resetStep.value = 1
  tab.value = 'pwd'
  account.value = resetForm.phone
  phone.value = resetForm.phone
  password.value = ''
  error.value = ''
  hint.value = ''
  notice.value = '密码已重置，请使用新密码登录'
}

function handleResetPhoneInput(event: Event): void {
  const next = (event.target as HTMLInputElement).value.replace(/\D/g, '')
  resetForm.phone = next
  resetForm.code = ''
  if (resetSentPhone.value !== next) resetSentPhone.value = ''
  error.value = ''
  hint.value = ''
}

async function requestCode(
  scene: 'login' | 'register' | 'reset_password',
  targetPhone: string,
  kind: 'login' | 'register' | 'reset',
): Promise<void> {
  error.value = ''
  hint.value = ''
  notice.value = ''
  if (!/^1[3-9]\d{9}$/.test(targetPhone)) {
    error.value = '请输入正确的 11 位手机号'
    return
  }
  sending.value = kind
  try {
    const response = await fetch('/api/v1/sso/sms/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: targetPhone, scene }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '验证码发送失败'
      return
    }
    hint.value = body.data?.hint ?? '验证码已发送'
    if (kind === 'login') loginLeft.value = 60
    else if (kind === 'register') registerLeft.value = 60
    else {
      resetSentPhone.value = targetPhone
      writeResetCooldown(targetPhone, 60)
      resetLeft.value = 60
      hint.value = `验证码已发送至 ${maskPhone(targetPhone)}，5 分钟内有效。${body.data?.hint ? ` ${body.data.hint}` : ''}`
    }
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    sending.value = null
  }
}

async function submitAppeal(): Promise<void> {
  error.value = ''
  notice.value = ''
  hint.value = ''
  if (!/^1[3-9]\d{9}$/.test(appealForm.phone)) {
    error.value = '请输入正确的 11 位手机号'
    return
  }
  if (appealForm.reason.trim().length < 5) {
    error.value = '请把申诉理由写清楚（至少 5 个字），便于运营复核'
    return
  }
  appealBusy.value = true
  try {
    const response = await fetch('/api/v1/sso/freeze-appeal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: appealForm.phone, reason: appealForm.reason.trim() }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '申诉提交失败，请重试'
      return
    }
    appealDone.value = body.message ?? '申诉已提交，请等待运营复核'
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    appealBusy.value = false
  }
}

function goResetStep2(): void {
  error.value = ''
  notice.value = ''
  if (!/^1[3-9]\d{9}$/.test(resetForm.phone)) {
    error.value = '请输入正确的 11 位注册手机号'
    return
  }
  if (resetSentPhone.value !== resetForm.phone) {
    error.value = '请先获取该手机号的验证码'
    return
  }
  if (!/^\d{6}$/.test(resetForm.code)) {
    error.value = '请输入 6 位短信验证码'
    return
  }
  resetStep.value = 2
}

async function submitPasswordReset(): Promise<void> {
  error.value = ''
  notice.value = ''
  if (
    resetForm.password.length < 8 ||
    resetForm.password.length > 20 ||
    !/[a-zA-Z]/.test(resetForm.password) ||
    !/\d/.test(resetForm.password)
  ) {
    error.value = '密码应为 8-20 位，且同时包含字母和数字'
    return
  }
  if (resetForm.password !== resetForm.confirm) {
    error.value = '两次输入的密码不一致'
    return
  }
  busy.value = true
  try {
    const response = await fetch('/api/v1/sso/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: resetForm.phone,
        code: resetForm.code,
        newPassword: resetForm.password,
        confirmPassword: resetForm.confirm,
      }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      const msg = body.message ?? '密码重置失败，请重试'
      if (msg.includes('验证码')) {
        resetStep.value = 1
        resetForm.code = ''
      }
      error.value = msg
      return
    }
    resetStep.value = 3
    resetForm.code = ''
    resetForm.password = ''
    resetForm.confirm = ''
    resetSentPhone.value = ''
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    busy.value = false
  }
}

function finishLogin(data: SsoBody['data']): void {
  const stage = data?.stage
  if (stage && stage !== 'done') {
    const query = new URLSearchParams(window.location.search)
    for (const key of ['mode', 'step', 'newAccount', 'phone']) query.delete(key)
    query.set('step', stage === 'subject' ? '2' : '3')
    window.location.href = `/register?${query.toString()}`
    return
  }
  const redirect = data?.redirect
  if (!redirect) {
    error.value = '认证中心未返回回跳地址，请联系平台运营'
    return
  }
  if (contextMissing && redirect === '/user-center-ops/') {
    window.location.href = `${window.location.protocol}//${window.location.hostname}:8115/`
    return
  }
  window.location.href =
    contextMissing && redirect.startsWith('/')
      ? `${window.location.protocol}//${window.location.hostname}${redirect}`
      : redirect
}

async function submitLogin(): Promise<void> {
  error.value = ''
  notice.value = ''
  hint.value = ''
  busy.value = true
  try {
    const common = {
      marketId: 1,
      clientId: ctx.clientId,
      redirectUri: ctx.redirectUri,
      state: ctx.state,
      codeChallenge: ctx.codeChallenge,
      codeChallengeMethod: ctx.codeChallengeMethod,
      remember: remember.value,
    }
    const loginUrl = contextMissing
      ? tab.value === 'sms'
        ? '/api/v1/sso/login-standalone-by-sms'
        : '/api/v1/sso/login-standalone'
      : tab.value === 'sms'
        ? '/api/v1/sso/login-by-sms'
        : '/api/v1/sso/login'
    const trimmedAccount = account.value.trim()
    const isPhoneAccount = /^1[3-9]\d{9}$/.test(trimmedAccount)
    const payload =
      tab.value === 'sms'
        ? contextMissing
          ? { phone: phone.value, code: smsCode.value, marketId: 1, remember: remember.value }
          : { ...common, phone: phone.value, code: smsCode.value }
        : contextMissing
          ? {
              username: isPhoneAccount ? undefined : trimmedAccount,
              phone: isPhoneAccount ? trimmedAccount : undefined,
              password: password.value,
              marketId: 1,
              remember: remember.value,
            }
          : {
              ...common,
              username: isPhoneAccount ? undefined : trimmedAccount,
              phone: isPhoneAccount ? trimmedAccount : undefined,
              password: password.value,
            }
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '登录失败，请重试'
      return
    }
    if (body.data?.mfaRequired) {
      mfaChallenge.value = body.data.challengeToken ?? ''
      mfaCode.value = ''
      notice.value = '该账号已开启二次验证，请输入验证器上的 6 位动态码'
      return
    }
    finishLogin(body.data)
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    busy.value = false
  }
}

async function submitMfa(): Promise<void> {
  error.value = ''
  notice.value = ''
  if (mfaCode.value.replace(/\s/g, '').length < 6) {
    error.value = '请输入验证器上的 6 位动态码，或一个备用码'
    return
  }
  busy.value = true
  try {
    const response = await fetch('/api/v1/sso/login-standalone-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: mfaChallenge.value,
        code: mfaCode.value.trim(),
        marketId: 1,
        remember: remember.value,
      }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '验证码不正确'
      mfaChallenge.value = ''
      mfaCode.value = ''
      return
    }
    finishLogin(body.data)
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    busy.value = false
  }
}

function validateAccountStep(): boolean {
  error.value = ''
  if (!/^1[3-9]\d{9}$/.test(reg.phone)) { error.value = '请填写正确的 11 位手机号'; return false }
  if (!/^\d{6}$/.test(reg.code)) { error.value = '请输入 6 位短信验证码'; return false }
  if (reg.password.length < 8 || reg.password.length > 20) { error.value = '密码长度应为 8-20 位'; return false }
  if (!/[a-zA-Z]/.test(reg.password) || !/\d/.test(reg.password)) { error.value = '密码需同时包含字母和数字'; return false }
  if (reg.password !== reg.confirm) { error.value = '两次输入的密码不一致'; return false }
  return true
}

function validateSubjectStep(): boolean {
  error.value = ''
  if (reg.identity === 'enterprise') {
    if (!reg.companyName.trim()) { error.value = '请填写企业名称'; return false }
    if (!validCreditCode(reg.creditCode)) { error.value = '请填写18位有效统一社会信用代码，并核对校验位'; return false }
    if (!reg.address.trim() || !reg.industry || !reg.companySize) { error.value = '请补齐营业执照完整住所、行业和企业规模'; return false }
    if (!reg.legalPerson.trim()) { error.value = '请填写法定代表人姓名'; return false }
  } else {
    if (!reg.realName.trim()) { error.value = '请填写真实姓名'; return false }
    if (!reg.idCard.trim()) { error.value = '请填写身份证号，个人实名认证将随注册提交'; return false }
    if (!/^\d{17}[\dXx]$/.test(reg.idCard.trim())) { error.value = '身份证号应为 18 位（末位可为 X）'; return false }
  }
  if (!reg.contactName.trim()) { error.value = '请填写联系人姓名'; return false }
  if (reg.contactPhone.trim() && !/^1[3-9]\d{9}$/.test(reg.contactPhone.trim())) { error.value = '请填写正确的 11 位联系电话'; return false }
  return true
}

async function registerAccountStep(): Promise<void> {
  if (!validateAccountStep()) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await fetch('/api/v1/sso/register-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: reg.phone,
        code: reg.code,
        password: reg.password,
        nickname: reg.nickname.trim(),
        marketId: 1,
        remember: true,
      }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '账号创建失败'
      return
    }
    if (body.data) applyOnboardingData(body.data)
    else {
      accountCreated.value = true
      onboardingStage.value = 'subject'
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('newAccount')
    url.searchParams.set('step', '1')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
    patchReg({ code: '', password: '', confirm: '' })
    notice.value = '登录账号已创建。你可以现在创建一个经营主体，也可以稍后继续。'
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    busy.value = false
  }
}

async function createSubjectStep(continueToCertification = true): Promise<void> {
  if (!validateSubjectStep()) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const response = await fetch('/api/v1/sso/onboarding/subject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: reg.identity,
        companyName: reg.companyName.trim(),
        creditCode: reg.creditCode.trim().toUpperCase(),
        industry: reg.identity === 'enterprise' ? reg.industry : '',
        companySize: reg.identity === 'enterprise' ? reg.companySize : '',
        address: reg.identity === 'enterprise' ? reg.address.trim() : '',
        realName: reg.realName.trim(),
        idCard: reg.idCard.trim(),
        businessType: reg.identity === 'personal' ? reg.businessType : '',
        contactName: reg.contactName.trim(),
        contactPhone: reg.contactPhone.trim() || reg.phone,
        legalPerson: reg.identity === 'enterprise' ? reg.legalPerson.trim() : reg.realName.trim(),
        licenseNo: reg.identity === 'enterprise' ? reg.creditCode.trim() : '',
      }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '主体创建失败'
      return
    }
    if (body.data) applyOnboardingData(body.data)
    else onboardingStage.value = 'certification'
    goToStep(continueToCertification ? 3 : 2)
    notice.value = continueToCertification
      ? '经营主体已创建，请完成认证资料后提交审核。'
      : '经营主体已保存。你可以稍后回到认证中心继续完成认证开通。'
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    busy.value = false
  }
}

function finishOnboardingForNow(): void {
  if (contextMissing) {
    switchView('/login')
    return
  }
  window.location.href = homeUrl
}

async function verifyPersonalEvidence(kind: 'police' | 'liveness'): Promise<void> {
  error.value = ''
  notice.value = ''
  hint.value = ''
  if (kind === 'police' && (!reg.realName.trim() || !reg.idCard.trim())) {
    error.value = '公安二要素核验需要真实姓名和身份证号，请先补充'
    return
  }
  verificationSubmitting.value = true
  try {
    const response = await fetch(`/api/v1/sso/onboarding/verification/personal/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: kind === 'police' ? JSON.stringify({ realName: reg.realName.trim(), idCard: reg.idCard.trim() }) : undefined,
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0 || !body.data) {
      error.value = body.message ?? (kind === 'police' ? '公安二要素核验失败' : '活体检测失败')
      return
    }
    applyOnboardingData(body.data)
    notice.value = kind === 'police' ? '公安二要素核验通过。' : '人脸活体检测通过。'
  } catch {
    error.value = '无法联系实名核验服务，请确认后端已启动'
  } finally {
    verificationSubmitting.value = false
  }
}

async function uploadEnterpriseEvidence(
  kind: 'business_license' | 'legal_person_face' | 'corporate_transfer_proof',
  file: File,
): Promise<void> {
  if (!onboardingMerchantId.value) { error.value = '经营主体尚未创建，无法上传认证材料'; return }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { error.value = '仅支持 JPG、PNG、WEBP 图片'; return }
  if (file.size > 5 * 1024 * 1024) { error.value = '单张图片不能超过 5MB'; return }
  error.value = ''
  verificationUploading.value = kind
  try {
    const form = new FormData()
    form.append('file', file)
    const response = await fetch(
      `/api/v1/sso/account/businesses/${onboardingMerchantId.value}/certification-files?kind=${kind}`,
      { method: 'POST', credentials: 'include', body: form },
    )
    const body = (await response.json()) as SsoBody & { data?: { url?: string } }
    if (!response.ok || body.code !== 0 || !body.data?.url) {
      error.value = body.message ?? '认证材料上传失败'
      return
    }
    if (kind === 'business_license') enterpriseVerification.businessLicenseUrl = body.data.url
    else if (kind === 'legal_person_face') {
      enterpriseVerification.legalPersonFaceUrl = body.data.url
      enterpriseVerification.legalPersonFaceStatus = 'uploaded'
    } else if (kind === 'corporate_transfer_proof') {
      enterpriseVerification.corporateTransferProofUrl = body.data.url
      enterpriseVerification.corporateTransferStatus = 'uploaded'
    }
    notice.value = kind === 'legal_person_face' ? '法人扫脸材料已采集。' : '认证材料上传成功。'
  } catch {
    error.value = '认证材料上传失败，请检查网络后重试'
  } finally {
    verificationUploading.value = ''
  }
}

function onEvidenceFileChange(
  kind: 'business_license' | 'legal_person_face' | 'corporate_transfer_proof',
  event: Event,
): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) void uploadEnterpriseEvidence(kind, file)
  input.value = ''
}

async function prepareEnterpriseEvidence(): Promise<void> {
  error.value = ''
  notice.value = ''
  if (!reg.legalPerson.trim()) { error.value = '请填写法定代表人姓名'; return }
  if (!enterpriseVerification.businessLicenseUrl) { error.value = '请上传营业执照照片'; return }
  if (!enterpriseVerification.legalPersonFaceUrl) { error.value = '请完成法人扫脸材料采集'; return }
  if (!enterpriseVerification.corporateBankName.trim()) { error.value = '请填写对公账户户名'; return }
  if (!/^\d{8,32}$/.test(enterpriseVerification.corporateBankAccount.replace(/\s/g, ''))) { error.value = '请填写有效的对公账户账号'; return }
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(enterpriseVerification.corporateTransferAmount)) { error.value = '请填写正确的对公打款金额'; return }
  if (enterpriseVerification.corporateTransferReference.trim().length < 6) { error.value = '请填写至少 6 位的对公打款流水号'; return }
  if (!enterpriseVerification.corporateTransferProofUrl) { error.value = '请上传对公打款凭证'; return }
  verificationSubmitting.value = true
  try {
    const response = await fetch('/api/v1/sso/onboarding/verification/enterprise/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        legalPerson: reg.legalPerson.trim(),
        registeredCapital: enterpriseVerification.registeredCapital.trim(),
        businessLicenseUrl: enterpriseVerification.businessLicenseUrl,
        legalPersonFaceUrl: enterpriseVerification.legalPersonFaceUrl,
        corporateBankName: enterpriseVerification.corporateBankName.trim(),
        corporateBankAccount: enterpriseVerification.corporateBankAccount,
        corporateTransferAmount: enterpriseVerification.corporateTransferAmount,
        corporateTransferReference: enterpriseVerification.corporateTransferReference.trim(),
        corporateTransferProofUrl: enterpriseVerification.corporateTransferProofUrl,
      }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0 || !body.data) {
      error.value = body.message ?? '企业认证材料校验失败'
      return
    }
    applyOnboardingData(body.data)
    notice.value = '营业执照、法人扫脸和对公打款材料已通过前置校验，可以提交审核。'
  } catch {
    error.value = '无法联系企业核验服务，请确认后端已启动'
  } finally {
    verificationSubmitting.value = false
  }
}

async function activateCertification(): Promise<void> {
  error.value = ''
  notice.value = ''
  hint.value = ''
  if (!reg.agree) {
    error.value = '请先阅读并同意用户服务协议、隐私政策与企业入驻规则'
    return
  }
  busy.value = true
  try {
    const response = await fetch('/api/v1/sso/onboarding/certification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: ctx.clientId,
        redirectUri: ctx.redirectUri,
        state: ctx.state,
        codeChallenge: ctx.codeChallenge,
        codeChallengeMethod: ctx.codeChallengeMethod,
      }),
    })
    const body = (await response.json()) as SsoBody
    if (!response.ok || body.code !== 0) {
      error.value = body.message ?? '认证提交失败'
      return
    }
    onboardingStage.value = body.data?.stage ?? 'pending'
    success.value = {
      redirect: body.data?.redirect ?? null,
      identity: reg.identity,
      hasIdCard: reg.idCard.trim() !== '',
    }
  } catch {
    error.value = '无法联系认证服务，请确认后端已启动'
  } finally {
    busy.value = false
  }
}

function handleRegisterSubmit(): void {
  if (regStep.value === 1) {
    if (!accountCreated.value) void registerAccountStep()
    return
  }
  if (regStep.value === 2) {
    void createSubjectStep()
    return
  }
  void activateCertification()
}

// 倒计时器
let ticker: number | null = null
onMounted(() => {
  ticker = window.setInterval(() => {
    if (loginLeft.value > 0) loginLeft.value -= 1
    if (registerLeft.value > 0) registerLeft.value -= 1
    if (resetLeft.value > 0) resetLeft.value -= 1
  }, 1000)

  if (isRegister && initialQuery.get('newAccount') !== '1') {
    void fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
      .then(async (response) => ({ ok: response.ok, body: (await response.json()) as SsoBody }))
      .then(({ ok, body }) => {
        if (!ok || body.code !== 0 || !body.data) return
        const stage = body.data.stage ?? ''
        const requestedStep = Number(new URLSearchParams(window.location.search).get('step'))
        if (stage === 'subject') regStep.value = requestedStep === 2 ? 2 : 1
        if (stage === 'certification' || stage === 'pending' || stage === 'done') {
          regStep.value = requestedStep === 1 || requestedStep === 2 ? (requestedStep as 1 | 2) : 3
        }
        applyOnboardingData(body.data)
      })
      .catch(() => {})
  }
})

onBeforeUnmount(() => {
  if (ticker != null) window.clearInterval(ticker)
})

watch(
  () => [forgotOpen.value, resetForm.phone] as const,
  ([open, phoneVal]) => {
    if (open) resetLeft.value = readResetCooldown(phoneVal)
  },
  { immediate: true },
)
</script>
