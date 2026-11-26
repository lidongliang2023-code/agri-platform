<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate client-id="gov" :landing-path="landingPath" :required-permissions="['gov:citizen']">
      <div class="g-shell" :class="{ collapsed }">
        <aside class="g-sidebar">
          <button type="button" class="g-brand" @click="go('home')">
            <img class="g-brand-logo" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
            <div v-if="!collapsed">
              <b>丰链云</b>
              <small>FENGCHAIN · AGRI</small>
            </div>
          </button>

          <nav>
            <section v-for="group in NAV" :key="group.group">
              <button
                v-for="item in group.items"
                :key="item.page"
                type="button"
                :class="{ on: page === item.page }"
                :title="item.label"
                @click="go(item.page)"
              >
                <component :is="item.icon" />
                <span v-if="!collapsed">{{ item.label }}</span>
              </button>
            </section>
          </nav>

          <SidebarUserCard
            :name="displayName"
            :role="identity?.subjectName ?? '经营主体'"
            :collapsed="collapsed"
            switch-label="切换身份（移动执法端）"
            :switch-url="mobileUrl"
            @logout="handleLogout"
          />
        </aside>

        <div class="g-main">
          <AgriVueTopHeader
            header-class="g-header"
            right-class="g-header-right"
            :collapsed="collapsed"
            :breadcrumbs="['政府监管服务', TITLES[page]]"
            @toggle-collapse="collapsed = !collapsed"
          >
            <template #center>
              <form @submit.prevent="submitTopSearch">
                <SearchOutlined />
                <input
                  v-model="topKeyword"
                  placeholder="搜索主体信用代码（溯源码请在公众查询页核验）"
                />
              </form>
            </template>
            <template #right>
              <span title="当前登录主体">
                {{ identity ? (identity.subjectName ?? '监管档案未绑定') : '身份解析中' }}
              </span>
              <button type="button" :title="`未读消息 ${unread} 条`" @click="go('messages')">
                <BellOutlined />
                <i v-if="unread > 0">{{ unread }}</i>
              </button>
              <button type="button" class="g-user" title="退出统一登录" @click="handleLogout">
                <span>{{ displayName.slice(0, 1) }}</span>
                <div>
                  <b>{{ displayName }}</b>
                  <small>统一账号 · 政府监管</small>
                </div>
              </button>
            </template>
          </AgriVueTopHeader>

          <AgriVueWorkspaceTabs
            :active-key="page"
            :active-label="TITLES[page]"
            home-key="home"
            :home-label="TITLES.home"
            storage-key="agri-gov:workspace-tabs"
            @navigate="(path) => go(path as Page)"
          />

          <main>
            <div class="g-crumb">
              <HomeOutlined />
              <button type="button" @click="go('home')">监管服务</button>
              <span>/</span>
              <b>{{ TITLES[page] }}</b>
            </div>

            <!-- 监管服务首页 -->
            <div v-if="page === 'home'" class="g-page">
              <div v-if="!homeData" class="g-loading"><i /><i /><i /></div>
              <template v-else>
                <section class="g-home-hero">
                  <div>
                    <span class="g-kicker"><i /> 农业产业政府监管服务</span>
                    <h1>让监管更透明，让办事更简单</h1>
                    <p>主体档案、数据报送、信用修复、政策补贴、执法协同与公众查询，一站办理。</p>
                    <div>
                      <a-button type="primary" @click="go('workbench')">进入我的工作台</a-button>
                      <a-button @click="go('public')">公众查询</a-button>
                    </div>
                  </div>
                  <div class="g-home-subject">
                    <span><BankOutlined /></span>
                    <small>当前主体</small>
                    <b>{{ homeData.subject.subjectName }}</b>
                    <p>{{ homeData.subject.creditCode }}</p>
                    <em>信用 {{ homeData.stats.creditScore }} 分 · {{ homeData.subject.creditLevel }} 级</em>
                  </div>
                </section>

                <section class="g-metrics">
                  <div class="g-metric tone-green">
                    <span><CreditCardOutlined /></span>
                    <div>
                      <small>信用分</small>
                      <b>{{ homeData.stats.creditScore }}</b>
                      <em>{{ homeData.subject.creditLevel }} 级守信主体</em>
                    </div>
                  </div>
                  <div class="g-metric tone-amber">
                    <span><WarningOutlined /></span>
                    <div>
                      <small>待办事项</small>
                      <b>{{ homeData.stats.pendingTasks }}</b>
                      <em>整改、补贴与信用事项</em>
                    </div>
                  </div>
                  <div class="g-metric tone-blue">
                    <span><SafetyCertificateOutlined /></span>
                    <div>
                      <small>证照提醒</small>
                      <b>{{ homeData.stats.licenseAlerts }}</b>
                      <em>全部证照状态持续监测</em>
                    </div>
                  </div>
                  <div class="g-metric tone-purple">
                    <span><BellOutlined /></span>
                    <div>
                      <small>未读消息</small>
                      <b>{{ homeData.stats.unreadMessages }}</b>
                      <em>监管文书与政策提醒</em>
                    </div>
                  </div>
                </section>

                <div class="g-home-grid">
                  <section class="g-card">
                    <div class="g-card-head">
                      <div><small>MY TASKS</small><b>我的监管待办</b></div>
                      <a-button size="small" @click="go('workbench')">全部</a-button>
                    </div>
                    <button
                      v-for="(todo, i) in homeData.todos"
                      :key="todo.title"
                      type="button"
                      class="g-todo"
                      @click="go(todo.route as Page)"
                    >
                      <span :class="`g-dot tone-${i}`" />
                      <div><b>{{ todo.title }}</b><p>{{ todo.content }}</p></div>
                      <em>{{ todo.progress }}</em>
                    </button>
                  </section>
                  <section class="g-ai-card">
                    <span><SafetyCertificateOutlined /></span>
                    <small>AI 合规助手</small>
                    <h2>提前发现风险<br />比事后整改更重要</h2>
                    <p>基于主体资质、生产记录、信用和执法数据完成体检，结果仅主体可见。</p>
                    <a-button @click="go('self-check')">开始 AI 合规自查</a-button>
                  </section>
                </div>

                <div class="g-home-grid">
                  <section class="g-card">
                    <div class="g-card-head">
                      <div><small>POLICIES</small><b>最新政策</b></div>
                      <a-button size="small" @click="go('policies')">更多</a-button>
                    </div>
                    <button
                      v-for="policy in homeData.policies"
                      :key="policy.id"
                      type="button"
                      class="g-policy-mini"
                      @click="go('policies')"
                    >
                      <a-tag>{{ policy.level }}</a-tag>
                      <b>{{ policy.title }}</b>
                      <small>{{ policy.publishDate }}</small>
                    </button>
                  </section>
                  <section class="g-card">
                    <div class="g-card-head">
                      <div><small>PUBLIC NOTICE</small><b>抽检结果公示</b></div>
                      <a-button size="small" @click="go('public')">查看</a-button>
                    </div>
                    <div v-for="item in homeData.publicNotices" :key="item.samplingNo" class="g-notice-row">
                      <span :class="item.result === '合格' ? 'ok' : 'bad'">{{ item.result }}</span>
                      <div>
                        <b>{{ item.productName }} · {{ item.subjectName }}</b>
                        <small>{{ item.samplingNo }} · {{ item.disposition }}</small>
                      </div>
                    </div>
                  </section>
                </div>
              </template>
            </div>

            <!-- 我的监管工作台 -->
            <div v-else-if="page === 'workbench'" class="g-page">
              <div v-if="!homeData" class="g-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="g-title">
                  <div>
                    <small>SUBJECT WORKBENCH</small>
                    <h1>我的监管工作台</h1>
                    <p>{{ homeData.subject.subjectName }} · {{ homeData.subject.creditCode }} · {{ homeData.subject.subjectType }}</p>
                  </div>
                  <div><a-button type="primary" @click="go('self-check')">AI 合规体检</a-button></div>
                </div>
                <section class="g-subject-banner">
                  <span><BankOutlined /></span>
                  <div>
                    <a-tag :class="`g-status tone-${statusMeta(homeData.subject.supervisionStatus).tone}`">
                      {{ statusMeta(homeData.subject.supervisionStatus).label }}
                    </a-tag>
                    <h2>{{ homeData.subject.subjectName }}</h2>
                    <p>{{ homeData.subject.address }} · {{ homeData.subject.industry }} · {{ homeData.subject.scale }}</p>
                  </div>
                  <div><small>信用等级</small><b>{{ homeData.subject.creditLevel }}</b><em>{{ homeData.subject.creditScore }} 分</em></div>
                  <div>
                    <small>年报状态</small>
                    <b>{{ annualReportMeta(homeData.subject.annualReportStatus).label }}</b>
                    <em>更新时间 {{ homeData.subject.updatedAt }}</em>
                  </div>
                </section>
                <div class="g-two-grid">
                  <section class="g-card">
                    <div class="g-card-head"><div><small>TO-DO</small><b>事项进度</b></div></div>
                    <div v-for="todo in homeData.todos" :key="todo.title" class="g-progress-item">
                      <div><b>{{ todo.title }}</b><span>{{ todo.content }}</span></div>
                      <strong>{{ todo.progress }}</strong>
                      <a-progress :percent="Number(todo.progress.replace('%', ''))" :show-info="false" stroke-color="#159a5e" />
                    </div>
                  </section>
                  <section class="g-card">
                    <div class="g-card-head">
                      <div><small>LICENSES</small><b>电子证照</b></div>
                      <a-button size="small" @click="go('subject')">管理</a-button>
                    </div>
                    <div v-for="license in licenses.slice(0, 4)" :key="license.id" class="g-license-row">
                      <span><FileProtectOutlined /></span>
                      <div><b>{{ license.licenseName }}</b><small>{{ license.licenseNo }}</small></div>
                      <a-tag :class="`g-status tone-${statusMeta(license.status).tone}`">{{ statusMeta(license.status).label }}</a-tag>
                    </div>
                  </section>
                </div>
                <section class="g-quick-grid">
                  <button @click="go('reports')"><FileSearchOutlined /><b>数据报送</b><span>检测、台账与追溯</span></button>
                  <button @click="go('credit')"><CreditCardOutlined /><b>信用档案</b><span>评分、记录与修复</span></button>
                  <button @click="go('enforcement')"><FileProtectOutlined /><b>执法协同</b><span>检查、整改与申辩</span></button>
                  <button @click="go('policies')"><BankOutlined /><b>政策项目</b><span>匹配与补贴申报</span></button>
                </section>
              </template>
            </div>

            <!-- 主体信息与资质 -->
            <div v-else-if="page === 'subject'" class="g-page">
              <div v-if="!subjectInfo" class="g-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="g-title">
                  <div><h1>主体信息与资质</h1><p>亮照经营、电子证照与信息变更统一归集到监管档案。</p></div>
                </div>
                <div class="g-two-grid">
                  <section class="g-card g-detail-card">
                    <div class="g-card-head">
                      <div><small>SUBJECT PROFILE</small><b>主体基础信息</b></div>
                      <a-tag :class="`g-status tone-${statusMeta(subjectInfo.supervisionStatus).tone}`">{{ statusMeta(subjectInfo.supervisionStatus).label }}</a-tag>
                    </div>
                    <div class="g-info-grid">
                      <span><small>主体名称</small><b>{{ subjectInfo.subjectName }}</b></span>
                      <span><small>统一社会信用代码</small><b>{{ subjectInfo.creditCode }}</b></span>
                      <span><small>主体类型</small><b>{{ subjectInfo.subjectType }}</b></span>
                      <span><small>法定代表人</small><b>{{ subjectInfo.legalPerson }}</b></span>
                      <span><small>联系电话</small><b>{{ subjectInfo.contactPhone }}</b></span>
                      <span><small>所属行业</small><b>{{ subjectInfo.industry }}</b></span>
                      <span><small>经营规模</small><b>{{ subjectInfo.scale }}</b></span>
                      <span><small>登记地址</small><b>{{ subjectInfo.address }}</b></span>
                    </div>
                  </section>
                  <section class="g-card">
                    <div class="g-card-head"><div><small>CREDIT</small><b>主体画像</b></div></div>
                    <div class="g-score-ring"><b>{{ subjectInfo.creditScore }}</b><span>信用分</span></div>
                    <div class="g-score-meta">
                      <span><small>信用等级</small><b>{{ subjectInfo.creditLevel }}</b></span>
                      <span><small>风险等级</small><b>{{ riskLevelMeta(subjectInfo.riskLevel).label }}</b></span>
                      <span><small>年报状态</small><b>{{ annualReportMeta(subjectInfo.annualReportStatus).label }}</b></span>
                    </div>
                  </section>
                </div>
                <section class="g-card">
                  <div class="g-card-head">
                    <div><small>E-LICENSES</small><b>电子证照</b></div>
                    <span class="muted-copy">证照由监管端核发，信息变更请携材料联系平台运营</span>
                  </div>
                  <div class="g-license-grid">
                    <article v-for="license in licenses" :key="license.id">
                      <span><FileProtectOutlined /></span>
                      <div>
                        <a-tag :class="`g-status tone-${statusMeta(license.status).tone}`">{{ statusMeta(license.status).label }}</a-tag>
                        <h3>{{ license.licenseName }}</h3>
                        <p>{{ license.licenseNo }}</p>
                        <small>{{ license.authority }} · 有效期至 {{ license.expireDate }}</small>
                      </div>
                      <a-button size="small" @click="previewLicense = license">查看</a-button>
                    </article>
                  </div>
                </section>
                <a-modal :open="Boolean(previewLicense)" :title="previewLicense?.licenseName" :footer="null" @cancel="previewLicense = null">
                  <div v-if="previewLicense" class="g-info-grid">
                    <span><small>证照编号</small><b>{{ previewLicense.licenseNo }}</b></span>
                    <span><small>发证机关</small><b>{{ previewLicense.authority }}</b></span>
                    <span><small>发证日期</small><b>{{ previewLicense.issueDate }}</b></span>
                    <span><small>有效期至</small><b>{{ previewLicense.expireDate }}</b></span>
                    <span><small>状态</small><b>{{ statusMeta(previewLicense.status).label }}</b></span>
                    <span><small>附件</small><b>{{ previewLicense.attachmentName || '暂无上传附件' }}</b></span>
                  </div>
                </a-modal>
              </template>
            </div>

            <!-- 数据报送 -->
            <div v-else-if="page === 'reports'" class="g-page">
              <div class="g-title">
                <div><h1>数据报送</h1><p>检测、进销货台账与追溯数据经 AI 校验后归集入监管档案。</p></div>
                <div><a-button type="primary" @click="reportModalOpen = true">+ 新增报送</a-button></div>
              </div>
              <section class="g-card g-table-wrap">
                <table>
                  <thead><tr><th>报送编号</th><th>类型 / 标题</th><th>周期</th><th>AI 校验</th><th>状态</th><th>提交时间</th></tr></thead>
                  <tbody>
                    <tr v-for="item in reports" :key="item.id">
                      <td><b>{{ item.reportNo }}</b></td>
                      <td>{{ item.reportType }}<small>{{ item.title }}</small></td>
                      <td>{{ item.period }}</td>
                      <td><b :class="item.aiScore >= 90 ? 'green' : 'amber'">{{ item.aiScore }} 分</b></td>
                      <td><a-tag :class="`g-status tone-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</a-tag></td>
                      <td>{{ item.submittedAt }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
              <a-modal v-model:open="reportModalOpen" title="新增数据报送" ok-text="提交报送" @ok="submitReport">
                <a-form layout="vertical">
                  <a-form-item label="报送类型" required>
                    <a-select v-model:value="reportForm.reportType" :options="reportTypeOptions" />
                  </a-form-item>
                  <a-form-item label="报送标题" required><a-input v-model:value="reportForm.title" /></a-form-item>
                  <a-form-item label="所属周期"><a-input v-model:value="reportForm.period" placeholder="2026-10" /></a-form-item>
                  <a-form-item label="说明"><a-textarea v-model:value="reportForm.description" :rows="4" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- AI 合规自查 -->
            <div v-else-if="page === 'self-check'" class="g-page">
              <div v-if="!selfCheckData" class="g-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="g-title">
                  <div>
                    <small>AI COMPLIANCE</small>
                    <h1>AI 合规自查</h1>
                    <p>基于主体资质、生产记录、质量控制、追溯和信用数据生成合规体检结果。</p>
                  </div>
                  <div><a-button type="primary" :loading="selfCheckLoading" @click="runSelfCheck">重新体检</a-button></div>
                </div>
                <section class="g-self-hero">
                  <div><small>本次自查评分</small><b>{{ selfCheckData.score }}<em>分</em></b><p>{{ selfCheckData.resultText }}</p></div>
                  <div><span>{{ selfCheckData.riskCount }}</span><small>低风险提醒</small><a-button @click="selfCheckSummaryOpen = true">查看体检摘要</a-button></div>
                </section>
                <a-modal v-model:open="selfCheckSummaryOpen" title="合规体检摘要" :footer="null">
                  <div class="g-info-grid">
                    <span><small>总分</small><b>{{ selfCheckData.score }}</b></span>
                    <span><small>结论</small><b>{{ selfCheckData.resultText }}</b></span>
                    <span v-for="item in selfCheckData.dimensions" :key="item.name"><small>{{ item.name }}</small><b>{{ item.score }} · {{ item.detail }}</b></span>
                  </div>
                </a-modal>
                <section class="g-card">
                  <div class="g-card-head"><div><small>DIMENSIONS</small><b>合规维度</b></div></div>
                  <div class="g-dimension-grid">
                    <div v-for="item in selfCheckData.dimensions" :key="item.name">
                      <div><b>{{ item.name }}</b><strong>{{ item.score }}</strong></div>
                      <a-progress :percent="item.score" :show-info="false" :stroke-color="item.score < 80 ? '#d18817' : '#159a5e'" />
                      <small>{{ item.detail }}</small>
                    </div>
                  </div>
                </section>
                <section class="g-card">
                  <div class="g-card-head"><div><small>RISK ITEMS</small><b>整改建议</b></div></div>
                  <div v-for="(item, index) in selfCheckData.items" :key="item" class="g-risk-item">
                    <span>{{ index + 1 }}</span>
                    <div><b>{{ item }}</b><p>建议在 7 日内补充材料并完成记录关联，平台将自动复核。</p></div>
                    <a-button size="small" @click="go('enforcement')">查看整改通知</a-button>
                  </div>
                </section>
              </template>
            </div>

            <!-- 信用档案与修复 -->
            <div v-else-if="page === 'credit'" class="g-page">
              <div v-if="!creditData" class="g-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="g-title">
                  <div><h1>信用档案与修复</h1><p>五维动态信用评价、守信激励、失信记录和在线修复。</p></div>
                  <div><a-button type="primary" @click="repairModalOpen = true">申请信用修复</a-button></div>
                </div>
                <section class="g-credit-hero">
                  <div class="g-score-ring large"><b>{{ creditData.score }}</b><span>信用分</span></div>
                  <div>
                    <a-tag :class="`g-status tone-${statusMeta('approved').tone}`">{{ statusMeta('approved').label }}</a-tag>
                    <h2>{{ creditData.level }} 级守信主体</h2>
                    <p>风险等级：{{ riskLevelMeta(creditData.riskLevel).label }} · 档案更新：{{ creditData.updatedAt }}</p>
                  </div>
                  <div class="g-credit-dimensions">
                    <span v-for="item in creditData.dimensions" :key="item.name"><small>{{ item.name }}</small><b>{{ item.score }}</b></span>
                  </div>
                </section>
                <div class="g-two-grid">
                  <section class="g-card">
                    <div class="g-card-head"><div><small>CREDIT EVENTS</small><b>信用记录</b></div></div>
                    <div v-for="event in creditData.events" :key="event.id" class="g-event">
                      <span :class="event.scoreChange >= 0 ? 'plus' : 'minus'">{{ event.scoreChange > 0 ? '+' : '' }}{{ event.scoreChange }}</span>
                      <div><b>{{ event.title }}</b><p>{{ event.detail }}</p><small>{{ event.source }} · {{ event.eventDate }}</small></div>
                    </div>
                  </section>
                  <section class="g-card">
                    <div class="g-card-head"><div><small>REPAIRS</small><b>修复申请</b></div></div>
                    <div v-for="repair in creditData.repairs" :key="repair.id" class="g-repair">
                      <div><b>{{ repair.repairType }}</b><a-tag :class="`g-status tone-${statusMeta(repair.status).tone}`">{{ statusMeta(repair.status).label }}</a-tag></div>
                      <p>{{ repair.reason }}</p>
                      <a-progress :percent="repair.progress" :show-info="false" stroke-color="#159a5e" />
                      <small>{{ repair.repairNo }} · {{ repair.submittedAt }}</small>
                    </div>
                    <p v-if="!creditData.repairs.length" class="muted-copy">暂无修复申请</p>
                  </section>
                </div>
                <a-modal v-model:open="repairModalOpen" title="申请信用修复" ok-text="提交申请" @ok="submitRepair">
                  <a-form layout="vertical">
                    <a-form-item label="修复类型"><a-select v-model:value="repairForm.repairType" :options="repairTypeOptions" /></a-form-item>
                    <a-form-item label="修复理由" required><a-textarea v-model:value="repairForm.reason" :rows="5" /></a-form-item>
                  </a-form>
                </a-modal>
              </template>
            </div>

            <!-- 检查整改与处罚 -->
            <div v-else-if="page === 'enforcement'" class="g-page">
              <div class="g-title"><div><h1>检查整改与处罚</h1><p>双随机检查、责令整改、处罚电子送达和在线陈述申辩。</p></div></div>
              <div class="g-two-grid">
                <section class="g-card">
                  <div class="g-card-head"><div><small>INSPECTIONS</small><b>检查记录</b></div></div>
                  <div v-for="item in inspections" :key="item.id" class="g-enforcement-row">
                    <span><AuditOutlined /></span>
                    <div><b>{{ item.inspectionType }} · {{ item.inspectionNo }}</b><p>{{ item.resultText }}</p><small>{{ item.inspectors }} · {{ item.inspectionDate }}</small></div>
                    <a-tag :class="`g-status tone-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</a-tag>
                  </div>
                </section>
                <section class="g-card">
                  <div class="g-card-head"><div><small>RECTIFICATION</small><b>整改通知</b></div></div>
                  <div v-for="item in rectifications" :key="item.id" class="g-rectify">
                    <div><b>{{ item.issueText }}</b><a-tag :class="`g-status tone-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</a-tag></div>
                    <p>{{ item.requirement }}</p>
                    <small>截止：{{ item.deadline }}</small>
                    <a-progress :percent="item.progress" :show-info="false" stroke-color="#d18817" />
                    <a-button v-if="item.status !== 'closed'" size="small" @click="openEnforcementAction('feedback', item.id, '整改反馈', item.feedbackText || '')">提交反馈</a-button>
                  </div>
                </section>
              </div>
              <section class="g-card">
                <div class="g-card-head"><div><small>PENALTIES</small><b>处罚记录</b></div></div>
                <div v-for="item in penalties" :key="item.id" class="g-penalty">
                  <div>
                    <span><WarningOutlined /></span>
                    <div><b>{{ item.violationText }}</b><small>{{ item.penaltyNo }} · {{ item.documentDate }} · {{ item.legalBasis }}</small></div>
                    <b>¥{{ item.amount.toLocaleString() }}</b>
                  </div>
                  <p>{{ item.penaltyText }}</p>
                  <footer>
                    <a-tag :class="`g-status tone-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</a-tag>
                    <a-button size="small" @click="openEnforcementAction('statement', item.id, '陈述申辩', item.statementText || '')">在线陈述申辩</a-button>
                  </footer>
                </div>
              </section>
              <a-modal :open="Boolean(enforcementAction)" :title="enforcementAction?.title" ok-text="提交" @cancel="enforcementAction = null" @ok="submitEnforcementAction">
                <a-textarea v-model:value="enforcementText" :rows="6" placeholder="填写整改情况、证明材料说明或陈述申辩意见" />
              </a-modal>
            </div>

            <!-- 政策与补贴 -->
            <div v-else-if="page === 'policies'" class="g-page">
              <div class="g-title"><div><h1>政策与补贴</h1><p>政策公开、智能匹配、项目申报及遥感核查进度。</p></div></div>
              <div class="g-two-grid">
                <section class="g-card">
                  <div class="g-card-head"><div><small>POLICY LIBRARY</small><b>政策库</b></div></div>
                  <article v-for="policy in policies" :key="policy.id" class="g-policy-card">
                    <div><a-tag>{{ policy.level }}</a-tag><a-tag>{{ policy.category }}</a-tag></div>
                    <h3>{{ policy.title }}</h3>
                    <p>{{ policy.summary }}</p>
                    <footer>
                      <small>{{ policy.authority }} · {{ policy.publishDate }}</small>
                      <a-button size="small" @click="openSubsidyModal(policy)">申报项目</a-button>
                    </footer>
                  </article>
                </section>
                <section class="g-card">
                  <div class="g-card-head"><div><small>MY APPLICATIONS</small><b>我的项目申报</b></div></div>
                  <div v-for="item in subsidies" :key="item.id" class="g-subsidy">
                    <div><b>{{ item.projectName }}</b><a-tag :class="`g-status tone-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</a-tag></div>
                    <p>{{ item.applicationNo }} · {{ item.remoteCheckStatus }}</p>
                    <strong>¥{{ item.amount.toLocaleString() }}</strong>
                    <a-progress :percent="item.progress" :show-info="false" stroke-color="#159a5e" />
                    <small>{{ item.submittedAt }}</small>
                  </div>
                </section>
              </div>
              <a-modal :open="Boolean(selectedPolicy)" :title="`申报 · ${selectedPolicy?.title ?? ''}`" ok-text="提交申报" @cancel="selectedPolicy = null" @ok="submitSubsidy">
                <a-form layout="vertical">
                  <a-form-item label="项目名称" required><a-input v-model:value="subsidyForm.projectName" /></a-form-item>
                  <a-form-item label="申请金额"><a-input-number v-model:value="subsidyForm.amount" :min="0" addon-after="元" style="width: 100%" /></a-form-item>
                  <div class="g-info-note">提交后将进入材料完整性、遥感面积和主体资格核查。</div>
                </a-form>
              </a-modal>
            </div>

            <!-- 公众查询 -->
            <div v-else-if="page === 'public'" class="g-page">
              <div class="g-title"><div><h1>公众查询与公示</h1><p>免登录查询主体信用、农产品溯源、抽检结果、红黑榜和双公示信息。</p></div></div>
              <section class="g-card g-public-tabs">
                <a-tabs v-model:activeKey="publicTab">
                  <a-tab-pane key="credit" tab="企业信用查询" />
                  <a-tab-pane key="trace" tab="农产品溯源" />
                  <a-tab-pane key="sampling" tab="抽检公示" />
                  <a-tab-pane key="lists" tab="信用红黑榜" />
                  <a-tab-pane key="publicity" tab="双公示" />
                </a-tabs>

                <div v-if="publicTab === 'credit'">
                  <div class="g-search-line">
                    <a-input v-model:value="publicKeyword" placeholder="企业名称或统一社会信用代码" @pressEnter="searchPublicCredit">
                      <template #prefix><SearchOutlined /></template>
                    </a-input>
                    <a-button type="primary" @click="searchPublicCredit">查询</a-button>
                  </div>
                  <div class="g-public-list">
                    <article v-for="item in publicCredits" :key="item.id">
                      <div><b>{{ item.subjectName }}</b><p>{{ item.creditCode }} · {{ item.region }} · {{ item.industry }}</p></div>
                      <a-tag :class="`g-status tone-${statusMeta(item.supervisionStatus).tone}`">{{ statusMeta(item.supervisionStatus).label }}</a-tag>
                      <strong>{{ item.creditScore }}</strong>
                      <small>{{ item.creditLevel }} 级</small>
                    </article>
                  </div>
                </div>

                <div v-else-if="publicTab === 'trace'">
                  <div class="g-search-line">
                    <a-input v-model:value="traceCode" placeholder="输入溯源码（生产域登记的码）" @pressEnter="searchTrace" />
                    <a-button type="primary" @click="searchTrace">核验</a-button>
                  </div>
                  <div v-if="traceResult" class="g-trace-result">
                    <div class="g-trace-head">
                      <CheckCircleFilled v-if="traceResult.verified" />
                      <WarningOutlined v-else />
                      <div>
                        <b>{{ traceResult.productName || '未知产品' }} · {{ traceResult.batchNo || '无批次号' }}</b>
                        <p>{{ (traceResult.subjectName || '生产主体未登记') + ' · 码状态 ' + (traceResult.statusText || traceResult.status || '未知') + ' · ' + traceResult.chainSummary }}</p>
                      </div>
                      <a-tag :color="traceResult.verified ? 'green' : traceResult.verifiable ? 'orange' : 'red'">
                        {{ traceResult.verified ? '核验通过' : traceResult.verifiable ? '存证不完整' : '码状态 ' + (traceResult.statusText || traceResult.status || '未知') }}
                      </a-tag>
                    </div>
                    <div class="g-trace-timeline">
                      <div v-for="(event, i) in traceResult.events" :key="`${event.stageName}-${i}`">
                        <i>{{ i + 1 }}</i>
                        <div>
                          <b>{{ event.stageName }} · {{ event.eventTitle }}</b>
                          <p>{{ event.evidence }}</p>
                          <small>{{ traceEventMeta(event) }}</small>
                        </div>
                        <a-tag :color="event.onChain ? 'green' : event.attested ? 'orange' : 'default'">
                          {{ event.onChain ? '已上链' : event.attested ? '存证' + (event.chainStatus || '中') : '未上链' }}
                        </a-tag>
                      </div>
                    </div>
                  </div>
                </div>

                <div v-else-if="publicTab === 'sampling'" class="g-table-wrap">
                  <table>
                    <thead><tr><th>抽样编号</th><th>产品 / 主体</th><th>抽检项目</th><th>结果</th><th>处置</th></tr></thead>
                    <tbody>
                      <tr v-for="item in publicSamplings" :key="item.id">
                        <td>{{ item.samplingNo }}</td>
                        <td><b>{{ item.productName }}</b><small>{{ item.subjectName }} · {{ item.region }}</small></td>
                        <td>{{ item.testItems }}</td>
                        <td><a-tag :color="item.result === '合格' ? 'green' : 'red'">{{ item.result }}</a-tag></td>
                        <td>{{ item.disposition }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div v-else-if="publicTab === 'lists' && publicLists" class="g-two-grid">
                  <div class="g-list-box red">
                    <h3>红名单 · 守信激励</h3>
                    <div v-for="item in publicLists.red" :key="item.id"><b>{{ item.subjectName }}</b><span>{{ item.creditScore }} 分 · {{ item.creditLevel }} 级</span></div>
                  </div>
                  <div class="g-list-box black">
                    <h3>黑名单 · 失信惩戒</h3>
                    <div v-for="item in publicLists.black" :key="item.id"><b>{{ item.subjectName }}</b><span>{{ item.creditScore }} 分 · {{ riskLevelMeta(item.riskLevel).label }}</span></div>
                  </div>
                </div>

                <div v-else-if="publicTab === 'publicity' && publicPublicity" class="g-two-grid">
                  <section class="g-card">
                    <div class="g-card-head"><div><small>ADMIN LICENSES</small><b>行政许可公示</b></div></div>
                    <div v-for="item in publicPublicity.licenses.slice(0, 6)" :key="item.id" class="g-notice-row">
                      <span class="ok">许可</span>
                      <div><b>{{ item.licenseName }}</b><small>{{ item.licenseNo }} · {{ item.authority }}</small><small>{{ item.subjectName }} · 有效期至 {{ item.expireDate }}</small></div>
                    </div>
                  </section>
                  <section class="g-card">
                    <div class="g-card-head"><div><small>PENALTIES</small><b>行政处罚公示</b></div></div>
                    <div v-for="item in publicPublicity.penalties" :key="item.id" class="g-notice-row">
                      <span class="bad">处罚</span>
                      <div><b>{{ item.subjectName }}</b><small>{{ item.penaltyNo }} · {{ item.violationText }}</small></div>
                    </div>
                  </section>
                </div>
              </section>
            </div>

            <!-- 投诉举报与建议 -->
            <div v-else-if="page === 'interaction'" class="g-page">
              <div class="g-title">
                <div><h1>投诉举报与建议</h1><p>食品安全、价格违法和违规经营线索受理，严格保护举报人信息。</p></div>
                <div><a-button type="primary" @click="complaintModalOpen = true">我要举报</a-button></div>
              </div>
              <div class="g-four-actions">
                <button @click="complaintModalOpen = true"><WarningOutlined /><b>投诉举报</b><span>在线提交线索</span></button>
                <button @click="openSuggestComplaint"><MessageOutlined /><b>咨询建议</b><span>以「其他」类型提交，监管端同池办理</span></button>
                <button @click="message.info('依申请公开由监管运营端受理，可在「投诉举报」提交诉求或拨打 12345')"><FileSearchOutlined /><b>信息公开</b><span>依申请公开</span></button>
                <button @click="message.info('政务服务热线：12345')"><TeamOutlined /><b>政务热线</b><span>12345 多渠道受理</span></button>
              </div>
              <section class="g-card">
                <div class="g-card-head"><div><small>MY REPORTS</small><b>我的举报记录</b></div></div>
                <article v-for="item in complaints" :key="item.id" class="g-complaint">
                  <div>
                    <a-tag :color="item.priority === 'high' ? 'red' : 'blue'">{{ item.complaintType }}</a-tag>
                    <b>{{ item.title }}</b>
                    <a-tag :class="`g-status tone-${statusMeta(item.status).tone}`">{{ statusMeta(item.status).label }}</a-tag>
                  </div>
                  <p>{{ item.content }}</p>
                  <footer><span>{{ item.complaintNo }} · {{ item.createdAt }}</span><small>{{ item.handleNote || '等待监管部门受理' }}</small></footer>
                </article>
              </section>
              <a-modal v-model:open="complaintModalOpen" title="投诉举报" ok-text="提交举报" @ok="submitComplaint">
                <a-form layout="vertical">
                  <a-form-item label="举报类型"><a-select v-model:value="complaintForm.complaintType" :options="complaintTypeOptions" /></a-form-item>
                  <a-form-item label="标题" required><a-input v-model:value="complaintForm.title" /></a-form-item>
                  <a-form-item label="涉及对象"><a-input v-model:value="complaintForm.targetName" /></a-form-item>
                  <a-form-item label="详细情况" required><a-textarea v-model:value="complaintForm.content" :rows="5" /></a-form-item>
                  <a-form-item label="举报人"><a-input v-model:value="complaintForm.reporterName" /></a-form-item>
                  <a-form-item label="联系电话"><a-input v-model:value="complaintForm.reporterPhone" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 消息通知 -->
            <div v-else-if="page === 'messages'" class="g-page">
              <div class="g-title">
                <div><h1>消息通知</h1><p>监管文书、办事提醒、政策推送和系统通知统一收件箱。</p></div>
                <div><a-button :disabled="!messages.some((i) => !i.read)" @click="readAllMessages">全部已读</a-button></div>
              </div>
              <section class="g-card g-message-list">
                <button v-for="item in messages" :key="item.id" type="button" :class="{ read: item.read }" @click="openMessage = item">
                  <span><BellOutlined /></span>
                  <div>
                    <b>{{ item.title }}<i v-if="!item.read" /></b>
                    <p>{{ item.content }}</p>
                    <small>{{ item.createdAt }}{{ item.bizNo ? ` · 关联单号 ${item.bizNo}` : '' }}</small>
                  </div>
                </button>
                <p v-if="!messages.length" class="muted-copy">当前主体暂无监管消息</p>
              </section>
              <a-modal :open="Boolean(openMessage)" :title="openMessage?.title" :footer="null" @cancel="openMessage = null">
                <div v-if="openMessage" class="g-message-detail">
                  <p>{{ openMessage.content }}</p>
                  <small>{{ openMessage.createdAt }}{{ openMessage.bizType ? ` · ${openMessage.bizType}` : '' }}{{ openMessage.bizNo ? ` · ${openMessage.bizNo}` : '' }}</small>
                  <p class="muted-copy">单条已读暂未开放，可用「全部已读」清空收件箱。</p>
                </div>
              </a-modal>
            </div>

            <!-- 操作记录 -->
            <div v-else-if="page === 'logs'" class="g-page">
              <div class="g-title"><div><h1>操作记录</h1><p>主体账号关键操作全程留痕，敏感操作支持区块链存证核验。</p></div></div>
              <section class="g-card g-table-wrap">
                <table>
                  <thead><tr><th>时间</th><th>操作人 / 角色</th><th>动作</th><th>对象</th><th>说明</th><th>IP</th></tr></thead>
                  <tbody>
                    <tr v-for="item in logs" :key="item.id">
                      <td>{{ item.createdAt }}</td>
                      <td><b>{{ item.operator }}</b><small>{{ item.role }}</small></td>
                      <td><a-tag>{{ item.action }}</a-tag></td>
                      <td>{{ item.target }}</td>
                      <td>{{ item.detail }}</td>
                      <td>{{ item.ip }}</td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>
          </main>

          <footer>© 2026 农业产业互联网平台 · 政府监管服务</footer>
        </div>
      </div>
    </UnifiedSsoGate>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  AuditOutlined,
  BankOutlined,
  BellOutlined,
  CheckCircleFilled,
  CreditCardOutlined,
  FileProtectOutlined,
  FileSearchOutlined,
  HomeOutlined,
  IdcardOutlined,
  MessageOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SolutionOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import {
  ANNUAL_REPORT_META,
  govApi,
  RISK_LEVEL_META,
  SUBJECT_STATUS,
  type Complaint,
  type CreditProfile,
  type HomeData,
  type IdentityCard,
  type Inspection,
  type License,
  type Penalty,
  type Policy,
  type Rectification,
  type Report,
  type Subject,
  type Subsidy,
} from './api'
import { logoutUnified, mobileEnforcementUrl, unifiedSession } from './sso'
import UnifiedSsoGate from './UnifiedSsoGate.vue'
import SidebarUserCard from './SidebarUserCard.vue'

type Page =
  | 'home'
  | 'workbench'
  | 'subject'
  | 'reports'
  | 'self-check'
  | 'credit'
  | 'enforcement'
  | 'policies'
  | 'public'
  | 'interaction'
  | 'messages'
  | 'logs'

const PAGES: Page[] = [
  'home',
  'workbench',
  'subject',
  'reports',
  'self-check',
  'credit',
  'enforcement',
  'policies',
  'public',
  'interaction',
  'messages',
  'logs',
]

const TITLES: Record<Page, string> = {
  home: '监管服务门户',
  workbench: '我的监管工作台',
  subject: '主体信息与资质',
  reports: '数据报送',
  'self-check': 'AI 合规自查',
  credit: '信用与修复',
  enforcement: '检查整改与处罚',
  policies: '政策与补贴',
  public: '公众查询',
  interaction: '投诉举报与建议',
  messages: '消息通知',
  logs: '操作记录',
}

const NAV = [
  {
    group: '门户',
    items: [
      { page: 'home' as Page, label: '监管服务首页', icon: HomeOutlined },
      { page: 'workbench' as Page, label: '我的监管工作台', icon: AuditOutlined },
    ],
  },
  {
    group: '主体办事',
    items: [
      { page: 'subject' as Page, label: '主体信息与资质', icon: IdcardOutlined },
      { page: 'reports' as Page, label: '数据报送', icon: FileSearchOutlined },
      { page: 'self-check' as Page, label: 'AI 合规自查', icon: SafetyCertificateOutlined },
    ],
  },
  {
    group: '信用与执法',
    items: [
      { page: 'credit' as Page, label: '信用档案与修复', icon: CreditCardOutlined },
      { page: 'enforcement' as Page, label: '检查整改与处罚', icon: FileProtectOutlined },
    ],
  },
  {
    group: '政策与公开',
    items: [
      { page: 'policies' as Page, label: '政策项目与补贴', icon: BankOutlined },
      { page: 'public' as Page, label: '公众查询与公示', icon: SearchOutlined },
      { page: 'interaction' as Page, label: '投诉举报与建议', icon: MessageOutlined },
    ],
  },
  {
    group: '我的',
    items: [
      { page: 'messages' as Page, label: '消息通知', icon: BellOutlined },
      { page: 'logs' as Page, label: '操作记录', icon: SolutionOutlined },
    ],
  },
]

const theme = {
  token: {
    colorPrimary: '#2d8f4e',
    colorLink: '#2d8f4e',
    colorText: '#1a1a1a',
    colorTextSecondary: '#595959',
    colorBorder: '#e8e8e8',
    colorBgLayout: '#f5f6fa',
    borderRadius: 6,
    controlHeight: 36,
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif',
  },
}

const landingPath = window.location.port === '5181' ? '/#/home' : '/gov/#/home'
const baseUrl = import.meta.env.BASE_URL
const mobileUrl = mobileEnforcementUrl()
const displayName = computed(() => unifiedSession.user?.nickname || unifiedSession.user?.username || '平台用户')

function parsePage(): Page {
  const key = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Page
  return PAGES.includes(key) ? key : 'home'
}

function go(target: Page) {
  window.location.hash = `/${target}`
}

function statusMeta(value: string) {
  const key = value.trim()
  return SUBJECT_STATUS[key] ?? SUBJECT_STATUS[key.toLowerCase()] ?? { label: key || '—', tone: 'gray' }
}

function riskLevelMeta(value: string) {
  const key = value.trim()
  if (!key) return { label: '未评级', tone: 'gray' }
  return RISK_LEVEL_META[key] ?? RISK_LEVEL_META[key.toLowerCase()] ?? { label: key, tone: 'gray' }
}

function annualReportMeta(value: string) {
  const key = value.trim()
  if (!key) return { label: '未报送', tone: 'gray' }
  return ANNUAL_REPORT_META[key] ?? ANNUAL_REPORT_META[key.toLowerCase()] ?? { label: key, tone: 'gray' }
}

function traceEventMeta(event: { location?: string; eventTime?: string; chainHash?: string }): string {
  return [event.location, event.eventTime, event.chainHash].filter(Boolean).join(' · ')
}

const page = ref<Page>(parsePage())
const collapsed = ref(window.innerWidth < 1280)
const topKeyword = ref('')
const transferKeyword = ref('')
const identity = ref<IdentityCard | null>(null)
const unread = ref(0)

// 各业务页数据
const homeData = ref<HomeData | null>(null)
const subjectInfo = ref<Subject | null>(null)
const licenses = ref<License[]>([])
const previewLicense = ref<License | null>(null)

const reports = ref<Report[]>([])
const reportModalOpen = ref(false)
const reportForm = reactive({ reportType: '农产品检测数据', title: '', period: '', description: '' })
const reportTypeOptions = ['农产品检测数据', '进销货台账', '溯源数据', '生产记录'].map((v) => ({ value: v, label: v }))

const selfCheckData = ref<Awaited<ReturnType<typeof govApi.selfCheck>> | null>(null)
const selfCheckLoading = ref(false)
const selfCheckSummaryOpen = ref(false)

const creditData = ref<CreditProfile | null>(null)
const repairModalOpen = ref(false)
const repairForm = reactive({ repairType: '整改完成修复', reason: '' })
const repairTypeOptions = ['整改完成修复', '异议申诉修复', '到期自动修复'].map((v) => ({ value: v, label: v }))

const inspections = ref<Inspection[]>([])
const rectifications = ref<Rectification[]>([])
const penalties = ref<Penalty[]>([])
const enforcementAction = ref<{ type: 'feedback' | 'statement'; id: number; title: string } | null>(null)
const enforcementText = ref('')

const policies = ref<Policy[]>([])
const subsidies = ref<Subsidy[]>([])
const selectedPolicy = ref<Policy | null>(null)
const subsidyForm = reactive({ projectName: '', amount: 50000 })

const publicTab = ref('credit')
const publicKeyword = ref('')
const publicCredits = ref<Subject[]>([])
const traceCode = ref('')
const traceResult = ref<Awaited<ReturnType<typeof govApi.trace>> | null>(null)
const publicSamplings = ref<Awaited<ReturnType<typeof govApi.samplings>>>([])
const publicLists = ref<{ red: Subject[]; black: Subject[] } | null>(null)
const publicPublicity = ref<{ licenses: License[]; penalties: Penalty[] } | null>(null)

const complaints = ref<Complaint[]>([])
const complaintModalOpen = ref(false)
const complaintForm = reactive({
  complaintType: '食品质量安全',
  title: '',
  targetName: '',
  content: '',
  reporterName: '',
  reporterPhone: '',
})
const complaintTypeOptions = ['食品质量安全', '农资经营', '价格违法', '补贴发放', '其他'].map((v) => ({ value: v, label: v }))

const messages = ref<Awaited<ReturnType<typeof govApi.messages>>>([])
const openMessage = ref<Awaited<ReturnType<typeof govApi.messages>>[number] | null>(null)
const logs = ref<Awaited<ReturnType<typeof govApi.logs>>>([])

function handleLogout() {
  void logoutUnified('gov')
}

function submitTopSearch() {
  if (!topKeyword.value.trim()) {
    message.warning('请输入企业名称、统一社会信用代码或溯源码')
    return
  }
  transferKeyword.value = topKeyword.value.trim()
  go('public')
}

async function loadPageData(current: Page) {
  if (!unifiedSession.user) return
  govApi.identity().then((d) => { identity.value = d }).catch((e: Error) => { identity.value = { subjectError: e.message } })
  govApi.messages().then((rows) => { unread.value = rows.filter((r) => !r.read).length }).catch(() => { unread.value = 0 })

  try {
    if (current === 'home') {
      homeData.value = await govApi.home()
    } else if (current === 'workbench') {
      const [h, l] = await Promise.all([govApi.home(), govApi.licenses()])
      homeData.value = h
      licenses.value = l
    } else if (current === 'subject') {
      const [s, l] = await Promise.all([govApi.me(), govApi.licenses()])
      subjectInfo.value = s
      licenses.value = l
    } else if (current === 'reports') {
      reports.value = await govApi.reports()
    } else if (current === 'self-check') {
      selfCheckData.value = await govApi.selfCheck()
    } else if (current === 'credit') {
      creditData.value = await govApi.credit()
    } else if (current === 'enforcement') {
      const [a, b, c] = await Promise.all([govApi.inspections(), govApi.rectifications(), govApi.penalties()])
      inspections.value = a
      rectifications.value = b
      penalties.value = c
    } else if (current === 'policies') {
      const [a, b] = await Promise.all([govApi.policies(), govApi.subsidies()])
      policies.value = a
      subsidies.value = b
    } else if (current === 'public') {
      const [s, l, p] = await Promise.all([govApi.samplings(), govApi.publicLists(), govApi.publicity()])
      publicSamplings.value = s
      publicLists.value = l
      publicPublicity.value = p
      if (transferKeyword.value) {
        publicKeyword.value = transferKeyword.value
        transferKeyword.value = ''
        publicCredits.value = (await govApi.publicCredit(publicKeyword.value)).items
      }
    } else if (current === 'interaction') {
      complaints.value = await govApi.complaints()
    } else if (current === 'messages') {
      messages.value = await govApi.messages()
    } else if (current === 'logs') {
      logs.value = await govApi.logs()
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}

async function submitReport() {
  if (!reportForm.reportType || !reportForm.title.trim()) {
    message.warning('请填写报送类型与标题')
    return
  }
  try {
    await govApi.createReport({ ...reportForm })
    reportModalOpen.value = false
    reportForm.title = ''
    reportForm.period = ''
    reportForm.description = ''
    message.success('报送成功并完成 AI 质量校验')
    reports.value = await govApi.reports()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败')
  }
}

async function runSelfCheck() {
  selfCheckLoading.value = true
  try {
    await govApi.runSelfCheck()
    message.success('AI 合规自查完成')
    selfCheckData.value = await govApi.selfCheck()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '自查失败')
  } finally {
    selfCheckLoading.value = false
  }
}

async function submitRepair() {
  if (!repairForm.reason.trim()) {
    message.warning('请填写修复理由')
    return
  }
  try {
    await govApi.createRepair({ ...repairForm })
    repairModalOpen.value = false
    repairForm.reason = ''
    message.success('修复申请已提交')
    creditData.value = await govApi.credit()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败')
  }
}

function openEnforcementAction(type: 'feedback' | 'statement', id: number, title: string, initial: string) {
  enforcementAction.value = { type, id, title }
  enforcementText.value = initial
}

async function submitEnforcementAction() {
  if (!enforcementAction.value) return
  try {
    if (enforcementAction.value.type === 'feedback') {
      await govApi.feedbackRectification(enforcementAction.value.id, { feedback: enforcementText.value })
    } else {
      await govApi.submitStatement(enforcementAction.value.id, { statement: enforcementText.value })
    }
    enforcementAction.value = null
    enforcementText.value = ''
    message.success('材料已提交')
    await loadPageData('enforcement')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败')
  }
}

function openSubsidyModal(policy: Policy) {
  selectedPolicy.value = policy
  subsidyForm.projectName = ''
  subsidyForm.amount = 50000
}

async function submitSubsidy() {
  if (!selectedPolicy.value) return
  if (!subsidyForm.projectName.trim()) {
    message.warning('请填写项目名称')
    return
  }
  try {
    await govApi.createSubsidy({ policyId: selectedPolicy.value.id, ...subsidyForm })
    selectedPolicy.value = null
    message.success('项目申报已提交')
    subsidies.value = await govApi.subsidies()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '申报失败')
  }
}

async function searchPublicCredit() {
  try {
    publicCredits.value = (await govApi.publicCredit(publicKeyword.value)).items
  } catch (e) {
    message.error(e instanceof Error ? e.message : '查询失败')
  }
}

async function searchTrace() {
  if (!traceCode.value.trim()) {
    message.warning('请输入溯源码')
    return
  }
  try {
    traceResult.value = await govApi.trace(traceCode.value.trim())
  } catch (e) {
    traceResult.value = null
    message.error(e instanceof Error ? e.message : '查询失败')
  }
}

function openSuggestComplaint() {
  complaintForm.complaintType = '其他'
  complaintModalOpen.value = true
}

async function submitComplaint() {
  if (!complaintForm.title.trim() || !complaintForm.content.trim()) {
    message.warning('请填写标题与详细情况')
    return
  }
  try {
    await govApi.createComplaint({ ...complaintForm })
    complaintModalOpen.value = false
    complaintForm.title = ''
    complaintForm.targetName = ''
    complaintForm.content = ''
    message.success('举报已提交，受理进度可在线查询')
    complaints.value = await govApi.complaints()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '提交失败')
  }
}

async function readAllMessages() {
  try {
    await govApi.readAll()
    messages.value = messages.value.map((i) => ({ ...i, read: true }))
    unread.value = 0
    message.success('收件箱已全部标为已读')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

const syncLayout = () => { collapsed.value = window.innerWidth < 1280 }
const onHashChange = () => {
  page.value = parsePage()
  window.scrollTo({ top: 0 })
}

watch(
  () => [unifiedSession.user, page.value] as const,
  ([user, current]) => {
    if (user) void loadPageData(current)
  },
  { immediate: true },
)

onMounted(() => {
  window.addEventListener('resize', syncLayout)
  window.addEventListener('hashchange', onHashChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', syncLayout)
  window.removeEventListener('hashchange', onHashChange)
})
</script>
