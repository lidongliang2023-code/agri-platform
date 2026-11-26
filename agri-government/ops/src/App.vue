<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate client-id="gov-ops" :landing-path="landingPath" :required-permissions="['gov:admin']">
      <div class="o-shell" :class="{ collapsed }">
        <aside class="o-sidebar">
          <button type="button" class="o-brand" @click="go('dashboard')">
            <img class="o-brand-logo" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
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
            role="政府监管运营"
            :collapsed="collapsed"
            switch-label="切换身份（监管用户端）"
            :switch-url="userPortalUrl"
            @logout="handleLogout"
          />
        </aside>

        <div class="o-main">
          <AgriVueTopHeader
            header-class="o-header"
            right-class="o-header-right"
            :collapsed="collapsed"
            :breadcrumbs="['政府监管', TITLES[page]]"
            @toggle-collapse="collapsed = !collapsed"
          >
            <template #center>
              <form @submit.prevent="submitTopSearch">
                <SearchOutlined />
                <input v-model="topKeyword" placeholder="按主体名称或信用代码查台账" />
              </form>
            </template>
            <template #right>
              <span>{{ todayText }}</span>
              <button type="button" :title="`待处置预警 ${pendingCount} 条`" @click="go('warnings')">
                <BellOutlined />
                <i v-if="pendingCount > 0">{{ pendingCount }}</i>
              </button>
              <a-dropdown>
                <button type="button" class="o-user-chip">
                  <a-avatar :size="30" class="o-avatar">{{ displayName.slice(0, 1) }}</a-avatar>
                  <span>
                    <b>{{ displayName }}</b>
                    <small>{{
                      identity?.operatorName
                        ? `${identity.roles?.admin ? '监管运营' : '执法人员'} · ${identity.operatorName}`
                        : '统一账号 · 监管运营'
                    }}</small>
                  </span>
                </button>
                <template #overlay>
                  <a-menu @click="handleUserMenu">
                    <a-menu-item key="users">组织与权限</a-menu-item>
                    <a-menu-item key="logs">操作审计</a-menu-item>
                    <a-menu-item key="logout">退出统一登录</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
          </AgriVueTopHeader>

          <AgriVueWorkspaceTabs
            :active-key="page"
            :active-label="TITLES[page]"
            home-key="dashboard"
            :home-label="TITLES.dashboard"
            storage-key="agri-gov-ops:workspace-tabs"
            @navigate="(path) => go(path as Page)"
          />

          <main>
            <AuthorizationNotice :page="page" />

            <!-- 监管工作台 -->
            <div v-if="page === 'dashboard'" class="o-page">
              <div v-if="!overview" class="o-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="o-title">
                  <div>
                    <span>GOVERNMENT REGULATION · OPERATIONS</span>
                    <h1>监管工作台</h1>
                    <p>辖区主体、风险预警、执法案件和质量安全的实时运营视角。</p>
                  </div>
                  <div class="o-actions">
                    <a-button @click="exportWeekly">导出周报</a-button>
                    <a-button type="primary" @click="go('warnings')">进入预警处置</a-button>
                  </div>
                </div>
                <div class="o-metrics">
                  <div class="o-metric tone-green"><span><TeamOutlined /></span><div><small>辖区监管主体</small><b>{{ overview.metrics.subjects.toLocaleString() }}</b><em>按监管档案统计</em></div></div>
                  <div class="o-metric tone-red"><span><AlertOutlined /></span><div><small>待处置预警</small><b>{{ overview.metrics.pendingWarnings }}</b><em>红警与在办核查</em></div></div>
                  <div class="o-metric tone-blue"><span><SafetyCertificateOutlined /></span><div><small>抽检合格率</small><b>{{ overview.metrics.samplingPassRate }}%</b><em>已出结果的监督抽检</em></div></div>
                  <div class="o-metric tone-amber"><span><FileProtectOutlined /></span><div><small>在办案件</small><b>{{ overview.metrics.openCases }}</b><em>立案调查与处罚</em></div></div>
                  <div class="o-metric tone-purple"><span><CheckCircleFilled /></span><div><small>AI今日辅助</small><b>{{ overview.metrics.aiAssistCount }}</b><em>预警核查与整改复核留痕</em></div></div>
                </div>
                <div class="o-dashboard-grid">
                  <section class="o-card o-trend">
                    <div class="o-card-head"><div><b>辖区运行趋势</b><small>主体、预警与检查量</small></div></div>
                    <div class="o-bars">
                      <div v-for="t in overview.trend" :key="t.date">
                        <div>
                          <span :style="{ height: `${Math.max(16, (t.warnings / maxTrendWarnings) * 100)}%` }" />
                          <i :style="{ height: `${Math.max(20, Math.min(100, (t.inspections / 40) * 100))}%` }" />
                        </div>
                        <small>{{ t.date.slice(5) }}</small>
                        <em>{{ t.warnings }} 预警</em>
                      </div>
                    </div>
                  </section>
                  <section class="o-card">
                    <div class="o-card-head"><div><b>今日待办</b><small>按紧急度排序</small></div></div>
                    <button v-for="t in overview.todos" :key="t.route" type="button" class="o-todo" @click="go(t.route as Page)">
                      <span>{{ t.count }}</span>
                      <div><b>{{ t.title }}</b><small>{{ t.description }}</small></div>
                      <em>处理 ›</em>
                    </button>
                    <p v-if="!overview.todos.length" class="muted">当前没有待办事项</p>
                  </section>
                </div>
                <div class="o-dashboard-grid">
                  <section class="o-card">
                    <div class="o-card-head"><div><b>最新风险预警</b><small>AI 与规则引擎共同识别</small></div></div>
                    <button v-for="w in overview.warnings.slice(0, 3)" :key="w.id" type="button" class="o-warning-row" @click="go('warnings')">
                      <span :class="{ high: w.level === 'red' }"><WarningOutlined /></span>
                      <div><b>{{ w.title }}</b><p>{{ w.content }}</p><small>{{ w.warningNo }} · AI 置信度 {{ w.aiConfidence }}%</small></div>
                      <a-tag :color="w.level === 'red' ? 'red' : 'orange'">{{ w.level === 'red' ? '高风险' : '关注' }}</a-tag>
                    </button>
                  </section>
                  <section class="o-ai-brief">
                    <span><SafetyCertificateOutlined /></span>
                    <small>AI 监管早报</small>
                    <h2>从阈值告警<br />升级为智能研判</h2>
                    <p v-for="item in overview.aiBrief" :key="item">• {{ item }}</p>
                  </section>
                </div>
              </template>
            </div>

            <!-- 市场主体监管 -->
            <div v-else-if="page === 'subjects'" class="o-page">
              <div class="o-title">
                <div>
                  <span>GOVERNMENT REGULATION · OPERATIONS</span>
                  <h1>市场主体监管</h1>
                  <p>辖区农业生产经营主体全量档案、风险等级与分级分类监管。</p>
                </div>
              </div>
              <AgriAntdvListTable
                :columns="subjectColumns"
                :data="subjects"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:subjects"
                @refresh="loadSubjects"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="loadSubjects" @reset="resetSubjects">
                    <div class="agri-vue-filter-field">
                      <label>风险等级</label>
                      <a-select
                        v-model:value="subjectRisk"
                        :options="riskFilterOptions"
                        @change="loadSubjects"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="subjectKeyword"
                        allow-clear
                        placeholder="主体名称 / 信用代码"
                        @press-enter="loadSubjects"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #toolbar-left>
                  <a-button @click="exportSubjects">导出台账</a-button>
                </template>
                <template #cell-subjectName="{ record }">
                  <div class="o-entity"><b>{{ record.subjectName }}</b><small>{{ record.creditCode }}</small></div>
                </template>
                <template #cell-region="{ record }">{{ record.industry }} · {{ record.region }}</template>
                <template #cell-creditScore="{ record }">
                  <b :class="Number(record.creditScore) < 75 ? 'red' : 'green'">{{ record.creditScore }}</b>
                </template>
                <template #cell-riskLevel="{ record }">
                  <a-tag :class="`o-status tone-${riskLevelMeta(String(record.riskLevel ?? '')).tone}`">{{ riskLevelMeta(String(record.riskLevel ?? '')).label }}</a-tag>
                </template>
                <template #cell-annualReportStatus="{ record }">
                  <a-tag :class="`o-status tone-${annualReportMeta(String(record.annualReportStatus ?? '')).tone}`">{{ annualReportMeta(String(record.annualReportStatus ?? '')).label }}</a-tag>
                </template>
                <template #cell-merchantId="{ record }">
                  <a-tag v-if="record.merchantId" color="green">已绑定 {{ record.merchantId }}</a-tag>
                  <a-tag v-else>未绑定</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="subjectRowActions(record as unknown as Subject)" />
                </template>
              </AgriAntdvListTable>
              <a-modal
                :open="Boolean(merchantTarget)"
                :title="`绑定平台经营主体 · ${merchantTarget?.subjectName ?? ''}`"
                ok-text="确认绑定"
                @cancel="merchantTarget = null"
                @ok="merchantTarget && applyMerchantBinding(merchantTarget, merchantIdInput.trim())"
              >
                <p class="muted">监管档案与平台经营主体是两条业务线各自的数据，绑定关系由运营显式建立：绑定后该主体下的账号才能在主体端看到自己的证照、整改、处罚与通知；不按名字猜同一家（同名不等于同一家）。</p>
                <a-input v-model:value="merchantIdInput" placeholder="平台经营主体号（例如 2001）" />
              </a-modal>
            </div>

            <!-- AI 预警处置 -->
            <div v-else-if="page === 'warnings'" class="o-page">
              <div class="o-title">
                <div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>AI 预警处置</h1><p>价格、质量、追溯、信用与舆情预警统一受理、分派和闭环。</p></div>
              </div>
              <div class="o-warning-grid">
                <section v-for="w in warnings" :key="w.id" :class="`o-card o-warning-card level-${w.level}`">
                  <div class="o-card-head">
                    <div><b>{{ w.type }}</b><small>{{ w.warningNo }} · {{ w.createdAt }}</small></div>
                    <a-tag :color="w.level === 'red' ? 'red' : 'orange'">{{ w.level === 'red' ? '高风险' : '关注' }}</a-tag>
                  </div>
                  <h3>{{ w.title }}</h3>
                  <p>{{ w.content }}</p>
                  <div class="o-ai-note"><SafetyCertificateOutlined /><span>AI 置信度 {{ w.aiConfidence }}% · {{ w.location }}</span></div>
                  <div class="o-summary"><span>承办：{{ w.assignedTo || '未分派' }}</span><span v-if="w.handleNote">{{ w.handleNote }}</span></div>
                  <footer>
                    <a-tag :class="`o-status tone-${statusMeta(w.status).tone}`">{{ statusMeta(w.status).label }}</a-tag>
                    <a-button v-if="w.status !== 'closed'" size="small" type="primary" @click="openAssignWarning(w)">分派处置</a-button>
                  </footer>
                </section>
              </div>
              <p v-if="!warnings.length" class="muted">当前没有预警记录</p>
              <a-modal :open="Boolean(warningTarget)" title="分派预警处置" ok-text="确认分派" @cancel="warningTarget = null" @ok="submitWarningAssign">
                <div class="o-summary"><b>{{ warningTarget?.title }}</b><span>{{ warningTarget?.content }}</span></div>
                <a-form layout="vertical">
                  <a-form-item label="承办执法人员" required>
                    <a-select v-model:value="warningAssignee" show-search option-filter-prop="label" placeholder="从执法人员档案里选择" :options="staffOptions" />
                  </a-form-item>
                  <a-form-item label="处置要求">
                    <a-textarea v-model:value="warningNote" :rows="4" placeholder="写清核查事项、完成时限与反馈要求" />
                  </a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 执法检查任务 -->
            <div v-else-if="page === 'tasks'" class="o-page">
              <div class="o-title">
                <div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>执法检查任务</h1><p>任务创建、分派、现场检查进度和整改跟踪。</p></div>
                <div class="o-actions"><a-button type="primary" @click="taskModalOpen = true">+ 新建任务</a-button></div>
              </div>
              <div class="o-task-grid">
                <section v-for="t in tasks" :key="t.id" class="o-card o-task-card">
                  <div class="o-card-head">
                    <div><b>{{ t.taskType }}</b><small>{{ t.taskNo }} · {{ t.deadline }}</small></div>
                    <a-tag :class="`o-status tone-${statusMeta(t.status).tone}`">{{ statusMeta(t.status).label }}</a-tag>
                  </div>
                  <h3>{{ t.subjectName }}</h3>
                  <p>{{ t.address }} · {{ t.distanceKm }}km</p>
                  <div>
                    <small>检查进度</small>
                    <a-progress :percent="t.checklistTotal ? Math.round((t.checklistDone / t.checklistTotal) * 100) : 0" :show-info="false" stroke-color="#159a5e" />
                  </div>
                  <footer><span>承办：{{ t.assignedTo || '未分派' }}</span><span>逐项 {{ t.checklistDone }}/{{ t.checklistTotal }}</span></footer>
                  <p v-if="t.result" class="muted">结论：{{ t.result }}</p>
                </section>
              </div>
              <p v-if="!tasks.length" class="muted">当前没有执法任务</p>
              <AgriAntdvListTable
                :columns="rectColumns"
                :data="rectifications"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:rectifications"
                @refresh="loadRectifications"
              >
                <template #toolbar-left>
                  <div class="o-table-caption"><b>整改复核队列</b><small>主体已反馈，待监管结案或退回</small></div>
                </template>
                <template #cell-status="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="rectRowActions(record as unknown as Rectification)" />
                </template>
              </AgriAntdvListTable>
              <a-modal
                :open="Boolean(rectReview)"
                :title="rectReview ? `整改复核 · ${rectReview.row.rectificationNo}` : ''"
                ok-text="提交复核"
                @cancel="rectReview = null"
                @ok="submitRectReview"
              >
                <div class="o-summary"><b>{{ rectReview?.row.issueText }}</b><span>主体反馈：{{ rectReview?.row.feedbackText || '（未填写）' }}</span></div>
                <a-form layout="vertical"><a-form-item label="复核意见" required><a-textarea v-model:value="rectReviewNote" :rows="4" /></a-form-item></a-form>
              </a-modal>
              <a-modal v-model:open="taskModalOpen" title="新建执法任务" ok-text="创建任务" @ok="submitCreateTask">
                <a-form layout="vertical">
                  <a-form-item label="任务类型"><a-select v-model:value="taskForm.taskType" :options="taskTypeOptions" /></a-form-item>
                  <a-form-item label="监管主体" required>
                    <a-select v-model:value="taskForm.subjectId" show-search option-filter-prop="label" placeholder="这次检查属于哪一家主体" :options="subjectSelectOptions" />
                  </a-form-item>
                  <a-form-item label="地址"><a-input v-model:value="taskForm.address" placeholder="留空则使用主体登记地址" /></a-form-item>
                  <a-form-item label="截止时间"><a-input v-model:value="taskForm.deadline" placeholder="今日 18:00" /></a-form-item>
                  <a-form-item label="承办执法人员" required>
                    <a-select v-model:value="taskForm.assigneeId" show-search option-filter-prop="label" :options="staffOptions" />
                  </a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 执法事项清单 -->
            <div v-else-if="page === 'items'" class="o-page">
              <div class="o-title">
                <div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>执法事项清单</h1><p>现场检查看勾选项来自这张模板表；停用只影响新建任务，不改写历史结论。</p></div>
              </div>
              <AgriAntdvListTable
                :columns="checkItemColumns"
                :data="filteredCheckItems"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:check-items"
                @refresh="loadCheckItems"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyCheckItemFilter" @reset="resetCheckItemFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="checkItemDraft"
                        allow-clear
                        placeholder="检查项名称 / 说明"
                        @press-enter="applyCheckItemFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>状态</label>
                      <a-select
                        v-model:value="checkItemStatus"
                        :options="checkItemStatusOptions"
                        @change="applyCheckItemFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #toolbar-left>
                  <a-button type="primary" @click="openCheckItemModal(null)">+ 新增检查项</a-button>
                </template>
                <template #cell-itemName="{ record }">
                  <div class="o-entity"><b>{{ record.itemName }}</b><small>{{ record.note || '无说明' }}</small></div>
                </template>
                <template #cell-status="{ record }">
                  <a-tag :color="record.status === 'active' ? 'green' : 'default'">{{ record.status === 'active' ? '启用' : '停用' }}</a-tag>
                </template>
                <template #cell-toggle="{ record }">
                  <a-switch :checked="record.status === 'active'" @change="(checked: unknown) => toggleCheckItem(record as unknown as CheckItem, Boolean(checked))" />
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="checkItemRowActions(record as unknown as CheckItem)" />
                </template>
              </AgriAntdvListTable>
              <a-modal v-model:open="checkItemModalOpen" :title="checkItemTarget ? '编辑检查项' : '新增检查项'" ok-text="保存" @ok="saveCheckItem">
                <a-form layout="vertical">
                  <a-form-item label="检查项名称" required><a-input v-model:value="checkItemForm.itemName" placeholder="例如：投入品仓储与使用台账" /></a-form-item>
                  <a-form-item label="检查说明"><a-textarea v-model:value="checkItemForm.note" :rows="3" placeholder="执法人员现场看什么、如何判定" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 案件管理 -->
            <div v-else-if="page === 'cases'" class="o-page">
              <div class="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>案件管理</h1><p>立案、调查取证、裁量、处罚、送达与结案归档。</p></div></div>
              <AgriAntdvListTable
                :columns="caseColumns"
                :data="filteredCases"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:cases"
                @refresh="loadCases"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyCaseFilter" @reset="resetCaseFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="caseDraft"
                        allow-clear
                        placeholder="案件编号 / 主体 / 案情摘要"
                        @press-enter="applyCaseFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>案件阶段</label>
                      <a-select
                        v-model:value="caseStatusFilter"
                        :options="caseStatusOptions"
                        @change="applyCaseFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-caseNo="{ record }">
                  <div class="o-entity"><b>{{ record.caseNo }}</b><small>{{ record.subjectName }}</small></div>
                </template>
                <template #cell-status="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                </template>
                <template #cell-progress="{ record }">
                  <a-progress :percent="Number(record.progress ?? 0)" size="small" stroke-color="#159a5e" />
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions v-if="record.status !== 'closed'" :actions="caseRowActions(record as unknown as Case)" />
                  <span v-else class="muted">已归档</span>
                </template>
              </AgriAntdvListTable>
            </div>

            <!-- 信用修复复核 -->
            <div v-else-if="page === 'repairs'" class="o-page">
              <div class="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>信用修复复核</h1><p>整改完成、异议申诉与到期修复的 AI 初审和人工复核。</p></div></div>
              <div class="o-repair-grid">
                <section v-for="r in repairs" :key="r.id" class="o-card">
                  <div class="o-card-head">
                    <div><b>{{ r.repairNo }}</b><small>{{ r.subjectName }} · {{ r.submittedAt }}</small></div>
                    <a-tag :class="`o-status tone-${statusMeta(r.status).tone}`">{{ statusMeta(r.status).label }}</a-tag>
                  </div>
                  <h3>{{ r.repairType }}</h3>
                  <p>{{ r.reason }}</p>
                  <a-progress :percent="r.progress" :show-info="false" stroke-color="#159a5e" />
                  <p v-if="r.reviewNote" class="muted">复核意见：{{ r.reviewNote }}</p>
                  <footer>
                    <span>进度 {{ r.progress }}%</span>
                    <template v-if="r.status !== 'approved' && r.status !== 'rejected'">
                      <a-button size="small" danger @click="askRepairReview(r, 'rejected')">驳回补件</a-button>
                      <a-button size="small" type="primary" @click="askRepairReview(r, 'approved')">通过修复</a-button>
                    </template>
                  </footer>
                </section>
              </div>
              <p v-if="!repairs.length" class="muted">暂无信用修复申请</p>
            </div>

            <!-- 补贴项目监管 -->
            <div v-else-if="page === 'subsidies'" class="o-page">
              <div class="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>补贴项目监管</h1><p>补贴项目申报、遥感核查、审核节点与资金兑付跟踪。</p></div></div>
              <AgriAntdvListTable
                :columns="subsidyColumns"
                :data="filteredSubsidies"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:subsidies"
                @refresh="loadSubsidies"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applySubsidyFilter" @reset="resetSubsidyFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="subsidyDraft"
                        allow-clear
                        placeholder="项目名称 / 申报编号 / 主体"
                        @press-enter="applySubsidyFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>审核状态</label>
                      <a-select
                        v-model:value="subsidyStatusFilter"
                        :options="subsidyStatusOptions"
                        @change="applySubsidyFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-projectName="{ record }">
                  <div class="o-entity"><b>{{ record.projectName }}</b><small>{{ record.applicationNo }} · {{ record.subjectName }}</small></div>
                </template>
                <template #cell-amount="{ record }">¥{{ Number(record.amount).toLocaleString() }}</template>
                <template #cell-progress="{ record }">
                  <a-progress :percent="Number(record.progress ?? 0)" size="small" stroke-color="#159a5e" />
                </template>
                <template #cell-status="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions v-if="record.status !== 'paid'" :actions="subsidyRowActions(record as unknown as Subsidy)" />
                  <span v-else class="muted">已兑付</span>
                </template>
              </AgriAntdvListTable>
            </div>

            <!-- 举报处理 -->
            <div v-else-if="page === 'complaints'" class="o-page">
              <div class="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>举报处理</h1><p>12345 / 12315 多渠道受理、智能分流与办理闭环。</p></div></div>
              <div class="o-complaint-grid">
                <section v-for="c in complaints" :key="c.id" class="o-card">
                  <div class="o-card-head">
                    <div><b>{{ c.title }}</b><small>{{ c.complaintNo }} · {{ c.createdAt }}</small></div>
                    <a-tag :color="c.priority === 'high' ? 'red' : 'blue'">{{ c.priority === 'high' ? '高优' : '普通' }}</a-tag>
                  </div>
                  <p>{{ c.content }}</p>
                  <div class="o-summary"><span>涉及主体：{{ c.targetName || '待核实' }}</span><span>举报人：{{ c.anonymous ? '匿名' : c.reporterName }}</span></div>
                  <p v-if="c.handleNote" class="muted">结论：{{ c.handleNote }}</p>
                  <footer>
                    <a-tag :class="`o-status tone-${statusMeta(c.status).tone}`">{{ statusMeta(c.status).label }}</a-tag>
                    <a-button v-if="c.status !== 'resolved'" size="small" type="primary" @click="openHandleComplaint(c)">办理</a-button>
                  </footer>
                </section>
              </div>
              <p v-if="!complaints.length" class="muted">暂无举报线索</p>
              <a-modal :open="Boolean(complaintTarget)" title="办理举报" ok-text="确认办结" @cancel="complaintTarget = null" @ok="submitHandleComplaint">
                <div class="o-summary"><b>{{ complaintTarget?.title }}</b><span>{{ complaintTarget?.content }}</span></div>
                <a-form layout="vertical">
                  <a-form-item label="处理结论" required><a-textarea v-model:value="complaintNote" :rows="4" placeholder="核查事实、处理意见与反馈方式" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 监督抽检 -->
            <div v-else-if="page === 'samplings'" class="o-page">
              <div class="o-title">
                <div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>监督抽检</h1><p>抽检计划、结果公示、不合格产品处置与风险区域分析。</p></div>
              </div>
              <AgriAntdvListTable
                :columns="samplingColumns"
                :data="filteredSamplings"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:samplings"
                @refresh="loadSamplings"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applySamplingFilter" @reset="resetSamplingFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="samplingDraft"
                        allow-clear
                        placeholder="抽样编号 / 产品 / 主体"
                        @press-enter="applySamplingFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>抽检结果</label>
                      <a-select
                        v-model:value="samplingResultFilter"
                        :options="samplingResultFilterOptions"
                        @change="applySamplingFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #toolbar-left>
                  <a-button type="primary" @click="samplingModalOpen = true">+ 新建抽样</a-button>
                </template>
                <template #cell-productName="{ record }">
                  <div class="o-entity"><b>{{ record.productName }}</b><small>{{ record.subjectName }} · {{ record.region }}</small></div>
                </template>
                <template #cell-result="{ record }">
                  <a-tag :color="record.result === '合格' ? 'green' : record.result === '不合格' ? 'red' : 'default'">{{ record.result }}</a-tag>
                </template>
              </AgriAntdvListTable>
              <a-modal v-model:open="samplingModalOpen" title="新建抽样任务" ok-text="创建" @ok="submitCreateSampling">
                <a-form layout="vertical">
                  <a-form-item label="监管主体" required>
                    <a-select v-model:value="samplingForm.subjectId" show-search option-filter-prop="label" placeholder="从监管台账选择" :options="subjectSelectOptions" />
                  </a-form-item>
                  <a-form-item label="产品名称" required><a-input v-model:value="samplingForm.productName" /></a-form-item>
                  <a-form-item label="检测项目"><a-input v-model:value="samplingForm.testItems" placeholder="农残常规检测" /></a-form-item>
                  <a-form-item label="结果"><a-select v-model:value="samplingForm.result" allow-clear :options="samplingResultOptions" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 跨部门数据共享 -->
            <div v-else-if="page === 'sharing'" class="o-page">
              <div class="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>跨部门数据共享</h1><p>数据目录、授权审批、敏感分级与共享交换记录。</p></div></div>
              <AgriAntdvListTable
                :columns="shareColumns"
                :data="filteredDataShares"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:sharing"
                @refresh="loadDataShares"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyShareFilter" @reset="resetShareFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="shareDraft"
                        allow-clear
                        placeholder="数据资源 / 提供方 / 接收方"
                        @press-enter="applyShareFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>授权状态</label>
                      <a-select
                        v-model:value="shareStatusFilter"
                        :options="shareStatusOptions"
                        @change="applyShareFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-parties="{ record }">{{ record.owner }} → {{ record.receiver }}</template>
                <template #cell-sensitiveLevel="{ record }">
                  <a-tag :color="record.sensitiveLevel === '二级' ? 'orange' : 'blue'">{{ record.sensitiveLevel }}</a-tag>
                </template>
                <template #cell-recordCount="{ record }">{{ Number(record.recordCount).toLocaleString() }}</template>
                <template #cell-status="{ record }">
                  <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions v-if="record.status === 'pending'" :actions="shareRowActions(record as unknown as DataShare)" />
                  <span v-else class="muted">已配置</span>
                </template>
              </AgriAntdvListTable>
            </div>

            <!-- 统计报表中心 -->
            <div v-else-if="page === 'statistics'" class="o-page">
              <div v-if="!statsData" class="o-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="o-title">
                  <div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>统计报表中心</h1><p>主体、预警、抽检、案件与产业运行周期报表。</p></div>
                </div>
                <div class="o-stats-grid">
                  <section class="o-card">
                    <div class="o-card-head"><div><b>预警类型分布</b><small>按预警表实时统计</small></div></div>
                    <div class="o-horizontal">
                      <div v-for="w in statsData.warningTypes" :key="w.name">
                        <span>{{ w.name }}</span>
                        <div><i :style="{ width: `${(w.value / maxWarningTypeVal) * 100}%` }" /></div>
                        <b>{{ w.value }}</b>
                      </div>
                    </div>
                  </section>
                  <section class="o-card">
                    <div class="o-card-head"><div><b>主体信用结构</b><small>按信用等级</small></div></div>
                    <div class="o-credit-chart">
                      <div v-for="item in creditLevels" :key="item.level"><b>{{ item.count }}</b><span>{{ item.level }} 级</span></div>
                    </div>
                  </section>
                </div>
                <AgriAntdvListTable
                  :columns="statsCaseColumns"
                  :data="statsData.cases"
                  row-key="id"
                  client-pagination
                  column-settings-storage-key="gov-ops:stats-cases"
                  @refresh="loadStatistics"
                >
                  <template #toolbar-left>
                    <a-button type="primary" @click="exportStatsCases">导出案件台账</a-button>
                  </template>
                  <template #cell-status="{ record }">
                    <a-tag :class="`o-status tone-${statusMeta(String(record.status ?? '')).tone}`">{{ statusMeta(String(record.status ?? '')).label }}</a-tag>
                  </template>
                </AgriAntdvListTable>
                <AgriAntdvListTable
                  :columns="statsSamplingColumns"
                  :data="statsFinishedSamplings"
                  row-key="id"
                  client-pagination
                  column-settings-storage-key="gov-ops:stats-samplings"
                  @refresh="loadStatistics"
                >
                  <template #toolbar-left>
                    <div class="o-table-caption"><b>抽检结果</b><small>已出结果的抽样</small></div>
                  </template>
                  <template #cell-result="{ record }">
                    <a-tag :color="record.result === '合格' ? 'green' : 'red'">{{ record.result }}</a-tag>
                  </template>
                </AgriAntdvListTable>
              </template>
            </div>

            <!-- 组织与权限 -->
            <div v-else-if="page === 'users'" class="o-page">
              <div class="o-title"><div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>组织与权限</h1><p>跨部门组织、监管角色、辖区网格与统一账号绑定关系。</p></div></div>
              <AgriAntdvListTable
                :columns="userColumns"
                :data="filteredStaffList"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:users"
                @refresh="loadStaffList"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="2" @search="applyStaffFilter" @reset="resetStaffFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="staffDraft"
                        allow-clear
                        placeholder="姓名 / 单位 / 网格 / 执法证号"
                        @press-enter="applyStaffFilter"
                      />
                    </div>
                    <div class="agri-vue-filter-field">
                      <label>在岗状态</label>
                      <a-select
                        v-model:value="staffStatusFilter"
                        :options="staffStatusOptions"
                        @change="applyStaffFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #cell-role="{ record }"><a-tag>{{ record.role }}</a-tag></template>
                <template #cell-grid="{ record }">{{ record.grid || '未分配' }}</template>
                <template #cell-certificateNo="{ record }">
                  <span v-if="record.certificateNo">{{ record.certificateNo }}</span>
                  <span v-else class="muted">未登记</span>
                </template>
                <template #cell-platformUserId="{ record }">
                  <a-tag v-if="record.platformUserId" color="green">已绑定 {{ record.platformUserId }}</a-tag>
                  <a-tag v-else>未绑定</a-tag>
                </template>
                <template #cell-status="{ record }">
                  <a-tag :color="record.status === 'active' ? 'green' : 'default'">{{ record.status === 'active' ? '在岗' : '停用' }}</a-tag>
                </template>
                <template #cell-action="{ record }">
                  <AgriVueRowActions :actions="staffRowActions(record as unknown as StaffRow)" />
                </template>
              </AgriAntdvListTable>
              <a-modal
                :open="Boolean(staffTarget)"
                :title="`绑定平台账号 · ${staffTarget?.name ?? ''}`"
                ok-text="确认绑定"
                @cancel="staffTarget = null"
                @ok="staffTarget && bindPlatformUser(staffTarget, staffPlatformId.trim())"
              >
                <p class="muted">移动执法端用统一账号登录后，要靠这条绑定确认"当前登录人是哪份执法档案"；没绑定的账号只会看到"未绑定执法档案"，任务与取证不会落到某个写死的人身上。权限点（gov:read / gov:write / gov:inspector / gov:admin）由平台运营端在角色权限矩阵里维护。</p>
                <a-input v-model:value="staffPlatformId" placeholder="平台用户 ID（例如 1007）" />
              </a-modal>
            </div>

            <!-- 操作审计日志 -->
            <div v-else-if="page === 'logs'" class="o-page">
              <div class="o-title">
                <div><span>GOVERNMENT REGULATION · OPERATIONS</span><h1>操作审计日志</h1><p>审核、分派、处罚、补贴与数据共享的敏感操作留痕。</p></div>
              </div>
              <AgriAntdvListTable
                :columns="logColumns"
                :data="filteredLogs"
                row-key="id"
                client-pagination
                column-settings-storage-key="gov-ops:logs"
                @refresh="loadLogs"
              >
                <template #filter>
                  <AgriVueFilterBar :field-count="1" @search="applyLogFilter" @reset="resetLogFilter">
                    <div class="agri-vue-filter-field">
                      <label>关键字</label>
                      <a-input
                        v-model:value="logDraft"
                        allow-clear
                        placeholder="操作人 / 动作 / 对象 / 说明"
                        @press-enter="applyLogFilter"
                      />
                    </div>
                  </AgriVueFilterBar>
                </template>
                <template #toolbar-left>
                  <a-button @click="exportLogs">导出日志</a-button>
                </template>
                <template #cell-operator="{ record }">
                  <div class="o-entity"><b>{{ record.operator || '系统' }}</b><small>{{ record.role }}</small></div>
                </template>
                <template #cell-actionType="{ record }"><a-tag>{{ record.action }}</a-tag></template>
              </AgriAntdvListTable>
            </div>

            <RegionRegistry v-else-if="page === 'region-registry'" />
            <PersonnelGrants v-else-if="page === 'personnel-grants'" />
            <ScopeConfig v-else-if="page === 'scopes'" />
          </main>
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
  AlertOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  CheckCircleFilled,
  CreditCardOutlined,
  DatabaseOutlined,
  FileProtectOutlined,
  FundOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  ShareAltOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import { AgriAntdvListTable } from '@agri/shared/vue/antdv'
import { AgriVueFilterBar, AgriVueRowActions, type VueListColumn, type VueRowActionItem } from '@agri/shared/vue/list'
import {
  ANNUAL_REPORT_META,
  opsApi,
  RISK_LEVEL_META,
  STATUS,
  type Case,
  type CheckItem,
  type Complaint,
  type DataShare,
  type IdentityCard,
  type Overview,
  type Rectification,
  type Repair,
  type Sampling,
  type Subject,
  type Subsidy,
  type Task,
  type Warning,
} from './api'
import { logoutUnified, unifiedSession } from '../../frontend/src/sso'
import UnifiedSsoGate from '../../frontend/src/UnifiedSsoGate.vue'
import AuthorizationNotice from './AuthorizationNotice.vue'
import RegionRegistry from './RegionRegistry.vue'
import ScopeConfig from './ScopeConfig.vue'
import PersonnelGrants from './PersonnelGrants.vue'
import SidebarUserCard from './SidebarUserCard.vue'

interface StaffRow {
  id: number
  name: string
  role: string
  organization: string
  grid: string
  status: string
  certificateNo?: string
  platformUserId?: string
}

type Page =
  | 'region-registry'
  | 'personnel-grants'
  | 'scopes'
  | 'dashboard'
  | 'subjects'
  | 'warnings'
  | 'tasks'
  | 'items'
  | 'cases'
  | 'repairs'
  | 'subsidies'
  | 'complaints'
  | 'samplings'
  | 'sharing'
  | 'statistics'
  | 'users'
  | 'logs'

const PAGES: Page[] = [
  'region-registry',
  'personnel-grants',
  'scopes',
  'dashboard',
  'subjects',
  'warnings',
  'tasks',
  'items',
  'cases',
  'repairs',
  'subsidies',
  'complaints',
  'samplings',
  'sharing',
  'statistics',
  'users',
  'logs',
]

const TITLES: Record<Page, string> = {
  'region-registry': '业务辖区登记',
  'personnel-grants': '监管人员授权',
  scopes: '监管范围配置',
  dashboard: '监管工作台',
  subjects: '市场主体监管',
  warnings: 'AI 预警处置',
  tasks: '执法检查任务',
  items: '执法事项清单',
  cases: '案件管理',
  repairs: '信用修复复核',
  subsidies: '补贴项目监管',
  complaints: '举报处理',
  samplings: '监督抽检',
  sharing: '跨部门数据共享',
  statistics: '统计报表中心',
  users: '组织与权限',
  logs: '操作审计日志',
}

const NAV = [
  {
    group: '监管指挥',
    items: [
      { page: 'dashboard' as Page, label: '监管工作台', icon: HomeOutlined },
      { page: 'statistics' as Page, label: '统计报表中心', icon: BarChartOutlined },
    ],
  },
  {
    group: '运行监测',
    items: [
      { page: 'warnings' as Page, label: 'AI 预警处置', icon: AlertOutlined },
      { page: 'tasks' as Page, label: '执法检查任务', icon: AuditOutlined },
      { page: 'items' as Page, label: '执法事项清单', icon: CheckCircleFilled },
      { page: 'cases' as Page, label: '案件管理', icon: FileProtectOutlined },
    ],
  },
  {
    group: '信用与主体',
    items: [
      { page: 'subjects' as Page, label: '市场主体监管', icon: TeamOutlined },
      { page: 'repairs' as Page, label: '信用修复复核', icon: CreditCardOutlined },
    ],
  },
  {
    group: '质量与政策',
    items: [
      { page: 'samplings' as Page, label: '监督抽检', icon: SafetyCertificateOutlined },
      { page: 'subsidies' as Page, label: '补贴项目监管', icon: FundOutlined },
      { page: 'complaints' as Page, label: '举报处理', icon: WarningOutlined },
    ],
  },
  {
    group: '数据与系统',
    items: [
      { page: 'region-registry' as Page, label: '业务辖区登记', icon: DatabaseOutlined },
      { page: 'personnel-grants' as Page, label: '监管人员授权', icon: TeamOutlined },
      { page: 'scopes' as Page, label: '监管范围配置', icon: SafetyCertificateOutlined },
      { page: 'sharing' as Page, label: '跨部门数据共享', icon: ShareAltOutlined },
      { page: 'users' as Page, label: '组织与权限', icon: TeamOutlined },
      { page: 'logs' as Page, label: '操作审计日志', icon: DatabaseOutlined },
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
    fontFamily: '-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif',
  },
}

const landingPath = window.location.port === '5183' ? '/#/dashboard' : '/gov-ops/#/dashboard'
const baseUrl = import.meta.env.BASE_URL
const userPortalUrl = `${window.location.protocol}//${window.location.hostname}:8108/`
const todayText = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
const displayName = computed(() => unifiedSession.user?.nickname || unifiedSession.user?.username || '平台用户')

function parse(): Page {
  const p = window.location.hash.replace(/^#\/?/, '').split('?')[0] as Page
  return PAGES.includes(p) ? p : 'dashboard'
}

function go(p: Page) {
  const nextHash = `#/${p}`
  if (window.location.hash !== nextHash) {
    window.location.hash = `/${p}`
  }
  if (page.value !== p) {
    page.value = p
    window.scrollTo({ top: 0 })
  }
}

function statusMeta(value: string) {
  const key = value.trim()
  return STATUS[key] ?? STATUS[key.toLowerCase()] ?? { label: key || '—', tone: 'gray' }
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

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) throw new Error('当前没有可导出的数据')
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const page = ref<Page>(parse())
const collapsed = ref(window.innerWidth < 1280)
const topKeyword = ref('')
const transferKeyword = ref('')
const overview = ref<Overview | null>(null)
const identity = ref<IdentityCard | null>(null)
const pendingCount = computed(() => overview.value?.metrics.pendingWarnings ?? 0)
const maxTrendWarnings = computed(() => Math.max(...(overview.value?.trend.map((t) => t.warnings) ?? [1]), 1))

// 市场主体
const riskFilterOptions = [
  { value: 'all', label: '全部风险等级' },
  { value: 'low', label: '低风险' },
  { value: 'medium', label: '中风险' },
  { value: 'high', label: '高风险' },
]
const subjects = ref<Subject[]>([])
const subjectRisk = ref('all')
const subjectKeyword = ref('')
const merchantTarget = ref<Subject | null>(null)
const merchantIdInput = ref('')
const subjectColumns: VueListColumn[] = [
  { label: '主体', key: 'subjectName', prop: 'subjectName', width: 220, locked: true },
  { label: '类型', key: 'subjectType', prop: 'subjectType', width: 120 },
  { label: '行业 / 区域', key: 'region', width: 180 },
  { label: '信用分', key: 'creditScore', prop: 'creditScore', width: 100, sorter: (a: Subject, b: Subject) => a.creditScore - b.creditScore },
  { label: '等级', key: 'creditLevel', prop: 'creditLevel', width: 90 },
  { label: '风险', key: 'riskLevel', prop: 'riskLevel', width: 100 },
  { label: '年报', key: 'annualReportStatus', prop: 'annualReportStatus', width: 100 },
  { label: '平台经营主体', key: 'merchantId', prop: 'merchantId', width: 150 },
  { label: '操作', key: 'action', width: 160, fixed: 'right' },
]
function subjectRowActions(row: Subject): VueRowActionItem[] {
  const actions: VueRowActionItem[] = [
    { key: 'bind', label: row.merchantId ? '变更绑定' : '绑定经营主体', onClick: () => openBindMerchant(row) },
  ]
  if (row.merchantId) {
    actions.push({ key: 'unbind', label: '解除', danger: true, onClick: () => void applyMerchantBinding(row, '') })
  }
  return actions
}

// 预警与人员
const warnings = ref<Warning[]>([])
const warningTarget = ref<Warning | null>(null)
const warningNote = ref('')
const warningAssignee = ref<number | undefined>(undefined)
const staffList = ref<StaffRow[]>([])
const staffDraft = ref('')
const staffKeyword = ref('')
const staffStatusFilter = ref('all')
const staffStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '在岗' },
  { value: 'inactive', label: '停用' },
]
const filteredStaffList = computed(() => {
  const q = staffKeyword.value.trim().toLowerCase()
  return staffList.value.filter((u) => {
    if (staffStatusFilter.value !== 'all' && u.status !== staffStatusFilter.value) return false
    if (!q) return true
    return `${u.name} ${u.organization} ${u.grid || ''} ${u.certificateNo || ''} ${u.role}`.toLowerCase().includes(q)
  })
})
const activeStaff = computed(() => staffList.value.filter((r) => r.status === 'active'))
const staffOptions = computed(() =>
  activeStaff.value.map((v) => ({ value: v.id, label: `${v.name} · ${v.role} · ${v.grid || '未分配网格'}` })),
)
const subjectSelectOptions = computed(() =>
  subjects.value.map((s) => ({ value: s.id, label: `${s.subjectName}（${s.region}）` })),
)

// 任务与整改
const tasks = ref<Task[]>([])
const rectifications = ref<Rectification[]>([])
const rectReview = ref<{ row: Rectification; status: 'closed' | 'pending' } | null>(null)
const rectReviewNote = ref('')
const taskModalOpen = ref(false)
const taskForm = reactive<{ taskType: string; subjectId?: number; address: string; deadline: string; assigneeId?: number }>({
  taskType: '双随机一公开',
  subjectId: undefined,
  address: '',
  deadline: '',
  assigneeId: undefined,
})
const taskTypeOptions = ['双随机一公开', '日常巡查', '专项检查', '抽样任务'].map((v) => ({ value: v, label: v }))
const rectColumns: VueListColumn[] = [
  { label: '整改单', key: 'rectificationNo', prop: 'rectificationNo', width: 150, locked: true },
  { label: '问题', key: 'issueText', prop: 'issueText', width: 200 },
  { label: '整改要求', key: 'requirement', prop: 'requirement', width: 200 },
  { label: '主体反馈', key: 'feedbackText', prop: 'feedbackText', width: 220, ellipsis: true },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '操作', key: 'action', width: 130, fixed: 'right' },
]
function rectRowActions(row: Rectification): VueRowActionItem[] {
  return [
    { key: 'close', label: '结案', onClick: () => openRectReview(row, 'closed') },
    { key: 'reject', label: '退回', danger: true, onClick: () => openRectReview(row, 'pending') },
  ]
}

// 执法事项清单
const checkItems = ref<CheckItem[]>([])
const checkItemDraft = ref('')
const checkItemKeyword = ref('')
const checkItemStatus = ref('all')
const checkItemStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '启用' },
  { value: 'disabled', label: '停用' },
]
const filteredCheckItems = computed(() => {
  const q = checkItemKeyword.value.trim().toLowerCase()
  return checkItems.value.filter((item) => {
    if (checkItemStatus.value !== 'all' && (checkItemStatus.value === 'active' ? item.status !== 'active' : item.status === 'active')) return false
    if (!q) return true
    return `${item.itemName} ${item.note || ''}`.toLowerCase().includes(q)
  })
})
const checkItemTarget = ref<CheckItem | null>(null)
const checkItemModalOpen = ref(false)
const checkItemForm = reactive({ itemName: '', note: '' })
const checkItemColumns: VueListColumn[] = [
  { label: '顺序', key: 'sortOrder', prop: 'sortOrder', width: 80 },
  { label: '检查项', key: 'itemName', prop: 'itemName', width: 320, locked: true },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '启停', key: 'toggle', width: 100 },
  { label: '操作', key: 'action', width: 100, fixed: 'right' },
]
function checkItemRowActions(row: CheckItem): VueRowActionItem[] {
  return [{ key: 'edit', label: '编辑', onClick: () => openCheckItemModal(row) }]
}

// 案件、修复、补贴、举报、抽检、共享、统计、人员绑定、日志
const cases = ref<Case[]>([])
const caseDraft = ref('')
const caseKeyword = ref('')
const caseStatusFilter = ref('all')
const caseStatusOptions = [
  { value: 'all', label: '全部阶段' },
  { value: 'filing', label: '立案' },
  { value: 'investigating', label: '调查取证' },
  { value: 'evidence', label: '证据复核' },
  { value: 'decision', label: '处罚决定' },
  { value: 'closed', label: '已归档' },
]
const filteredCases = computed(() => {
  const q = caseKeyword.value.trim().toLowerCase()
  return cases.value.filter((c) => {
    if (caseStatusFilter.value !== 'all' && c.status !== caseStatusFilter.value) return false
    if (!q) return true
    return `${c.caseNo} ${c.subjectName} ${c.summary} ${c.handler}`.toLowerCase().includes(q)
  })
})
const caseColumns: VueListColumn[] = [
  { label: '案件', key: 'caseNo', prop: 'caseNo', width: 200, locked: true },
  { label: '类型', key: 'caseType', prop: 'caseType', width: 120 },
  { label: '案情摘要', key: 'summary', prop: 'summary', width: 220, ellipsis: true },
  { label: '法律依据', key: 'legalBasis', prop: 'legalBasis', width: 180, ellipsis: true },
  { label: '阶段', key: 'status', prop: 'status', width: 110 },
  { label: '进度', key: 'progress', width: 130 },
  { label: '承办', key: 'handler', prop: 'handler', width: 110 },
  { label: '操作', key: 'action', width: 150, fixed: 'right' },
]
function caseRowActions(row: Case): VueRowActionItem[] {
  return [{ key: 'advance', label: `推进到${statusMeta(nextCaseStage(row)).label}`, onClick: () => void advanceCase(row) }]
}

const repairs = ref<Repair[]>([])
const subsidies = ref<Subsidy[]>([])
const subsidyDraft = ref('')
const subsidyKeyword = ref('')
const subsidyStatusFilter = ref('all')
const subsidyStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'county_review', label: '县级复核' },
  { value: 'paid', label: '已兑付' },
]
const filteredSubsidies = computed(() => {
  const q = subsidyKeyword.value.trim().toLowerCase()
  return subsidies.value.filter((s) => {
    if (subsidyStatusFilter.value !== 'all' && s.status !== subsidyStatusFilter.value) return false
    if (!q) return true
    return `${s.projectName} ${s.applicationNo} ${s.subjectName}`.toLowerCase().includes(q)
  })
})
const subsidyColumns: VueListColumn[] = [
  { label: '项目', key: 'projectName', prop: 'projectName', width: 240, locked: true },
  { label: '金额', key: 'amount', prop: 'amount', width: 130 },
  { label: '遥感核查', key: 'remoteCheckStatus', prop: 'remoteCheckStatus', width: 130 },
  { label: '进度', key: 'progress', width: 140 },
  { label: '状态', key: 'status', prop: 'status', width: 110 },
  { label: '操作', key: 'action', width: 160, fixed: 'right' },
]
function subsidyRowActions(row: Subsidy): VueRowActionItem[] {
  return [
    { key: 'review', label: '通过复核', onClick: () => void reviewSubsidy(row, 'county_review') },
    { key: 'paid', label: '标记兑付', onClick: () => void reviewSubsidy(row, 'paid') },
  ]
}

const complaints = ref<Complaint[]>([])
const complaintTarget = ref<Complaint | null>(null)
const complaintNote = ref('')

const samplings = ref<Sampling[]>([])
const samplingDraft = ref('')
const samplingKeyword = ref('')
const samplingResultFilter = ref('all')
const samplingResultFilterOptions = [
  { value: 'all', label: '全部结果' },
  { value: '待检', label: '待检' },
  { value: '合格', label: '合格' },
  { value: '不合格', label: '不合格' },
]
const filteredSamplings = computed(() => {
  const q = samplingKeyword.value.trim().toLowerCase()
  return samplings.value.filter((s) => {
    if (samplingResultFilter.value !== 'all' && s.result !== samplingResultFilter.value) return false
    if (!q) return true
    return `${s.samplingNo} ${s.productName} ${s.subjectName} ${s.testItems}`.toLowerCase().includes(q)
  })
})
const samplingModalOpen = ref(false)
const samplingForm = reactive<{ subjectId?: number; productName: string; testItems: string; result?: string }>({
  subjectId: undefined,
  productName: '',
  testItems: '',
  result: undefined,
})
const samplingResultOptions = ['待检', '合格', '不合格'].map((v) => ({ value: v, label: v }))
const samplingColumns: VueListColumn[] = [
  { label: '抽样编号', key: 'samplingNo', prop: 'samplingNo', width: 150, locked: true },
  { label: '产品 / 主体', key: 'productName', prop: 'productName', width: 220 },
  { label: '检测项目', key: 'testItems', prop: 'testItems', width: 180 },
  { label: '结果', key: 'result', prop: 'result', width: 100 },
  { label: '处置', key: 'disposition', prop: 'disposition', width: 150 },
  { label: '抽样日期', key: 'sampleDate', prop: 'sampleDate', width: 140 },
]

const dataShares = ref<DataShare[]>([])
const shareDraft = ref('')
const shareKeyword = ref('')
const shareStatusFilter = ref('all')
const shareStatusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待审批' },
  { value: 'approved', label: '已授权' },
  { value: 'rejected', label: '已驳回' },
]
const filteredDataShares = computed(() => {
  const q = shareKeyword.value.trim().toLowerCase()
  return dataShares.value.filter((d) => {
    if (shareStatusFilter.value !== 'all' && d.status !== shareStatusFilter.value) return false
    if (!q) return true
    return `${d.resourceName} ${d.owner} ${d.receiver} ${d.shareType}`.toLowerCase().includes(q)
  })
})
const shareColumns: VueListColumn[] = [
  { label: '数据资源', key: 'resourceName', prop: 'resourceName', width: 200, locked: true },
  { label: '提供 / 接收方', key: 'parties', width: 210 },
  { label: '共享方式', key: 'shareType', prop: 'shareType', width: 120 },
  { label: '敏感等级', key: 'sensitiveLevel', prop: 'sensitiveLevel', width: 100 },
  { label: '记录数', key: 'recordCount', prop: 'recordCount', width: 110 },
  { label: '状态', key: 'status', prop: 'status', width: 100 },
  { label: '更新时间', key: 'updatedAt', prop: 'updatedAt', width: 160 },
  { label: '操作', key: 'action', width: 130, fixed: 'right' },
]
function shareRowActions(row: DataShare): VueRowActionItem[] {
  return [
    { key: 'approve', label: '授权', onClick: () => void reviewDataShare(row, 'approved') },
    { key: 'reject', label: '驳回', danger: true, onClick: () => void reviewDataShare(row, 'rejected') },
  ]
}

const statsData = ref<Awaited<ReturnType<typeof opsApi.statistics>> | null>(null)
const statsFinishedSamplings = computed(() => statsData.value?.samplings.filter((s) => s.result !== '待检') ?? [])
const maxWarningTypeVal = computed(() => Math.max(...(statsData.value?.warningTypes.map((w) => w.value) ?? [1]), 1))
const creditLevels = computed(() => {
  if (!statsData.value) return []
  const uniq = [...new Set(statsData.value.subjects.map((s) => s.creditLevel))]
  return uniq.map((level) => ({ level, count: statsData.value!.subjects.filter((s) => s.creditLevel === level).length }))
})
const statsCaseColumns: VueListColumn[] = [
  { label: '案件编号', key: 'caseNo', prop: 'caseNo', width: 160, locked: true },
  { label: '主体', key: 'subjectName', prop: 'subjectName', width: 200 },
  { label: '类型', key: 'caseType', prop: 'caseType', width: 130 },
  { label: '状态', key: 'status', prop: 'status', width: 110 },
  { label: '承办人', key: 'handler', prop: 'handler', width: 120 },
  { label: '立案时间', key: 'filedAt', prop: 'filedAt', width: 160 },
]
const statsSamplingColumns: VueListColumn[] = [
  { label: '抽样编号', key: 'samplingNo', prop: 'samplingNo', width: 160, locked: true },
  { label: '产品', key: 'productName', prop: 'productName', width: 180 },
  { label: '主体', key: 'subjectName', prop: 'subjectName', width: 200 },
  { label: '结果', key: 'result', prop: 'result', width: 100 },
  { label: '处置', key: 'disposition', prop: 'disposition', width: 180 },
]

const staffTarget = ref<StaffRow | null>(null)
const staffPlatformId = ref('')
const userColumns: VueListColumn[] = [
  { label: '姓名', key: 'name', prop: 'name', width: 120, locked: true },
  { label: '角色', key: 'role', prop: 'role', width: 120 },
  { label: '单位', key: 'organization', prop: 'organization', width: 180 },
  { label: '网格', key: 'grid', prop: 'grid', width: 140 },
  { label: '执法证号', key: 'certificateNo', prop: 'certificateNo', width: 150 },
  { label: '平台账号', key: 'platformUserId', prop: 'platformUserId', width: 140 },
  { label: '在岗', key: 'status', prop: 'status', width: 90 },
  { label: '操作', key: 'action', width: 160, fixed: 'right' },
]
function staffRowActions(row: StaffRow): VueRowActionItem[] {
  const actions: VueRowActionItem[] = [
    { key: 'bind', label: row.platformUserId ? '变更绑定' : '绑定平台账号', onClick: () => openBindPlatformUser(row) },
  ]
  if (row.platformUserId) {
    actions.push({ key: 'unbind', label: '解除', danger: true, onClick: () => void bindPlatformUser(row, '') })
  }
  return actions
}

const logs = ref<Awaited<ReturnType<typeof opsApi.logs>>>([])
const logDraft = ref('')
const logKeyword = ref('')
const filteredLogs = computed(() => {
  const q = logKeyword.value.trim().toLowerCase()
  if (!q) return logs.value
  return logs.value.filter((item) =>
    `${item.operator || ''} ${item.role || ''} ${item.action || ''} ${item.target || ''} ${item.detail || ''} ${item.ip || ''}`
      .toLowerCase()
      .includes(q),
  )
})
const logColumns: VueListColumn[] = [
  { label: '时间', key: 'createdAt', prop: 'createdAt', width: 170, locked: true },
  { label: '操作人', key: 'operator', width: 150 },
  { label: '动作', key: 'actionType', prop: 'action', width: 140 },
  { label: '对象', key: 'target', prop: 'target', width: 180 },
  { label: '说明', key: 'detail', prop: 'detail', width: 260, ellipsis: true },
  { label: 'IP', key: 'ip', prop: 'ip', width: 140 },
]

function handleLogout() {
  void logoutUnified('gov-ops')
}

function handleUserMenu({ key }: { key: string | number }) {
  if (key === 'users') go('users')
  else if (key === 'logs') go('logs')
  else if (key === 'logout') handleLogout()
}

function submitTopSearch() {
  if (!topKeyword.value.trim()) return
  transferKeyword.value = topKeyword.value.trim()
  go('subjects')
}

function exportWeekly() {
  if (!overview.value) return
  try {
    downloadCsv(
      '监管周报.csv',
      overview.value.trend.map((t) => ({
        日期: t.date,
        监管主体: t.subjects,
        预警: t.warnings,
        检查量: t.inspections,
        抽检合格率: t.samplingRate,
        案件: t.cases,
      })),
    )
    message.success('监管周报已下载')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导出失败')
  }
}

async function loadSubjects() {
  try {
    subjects.value = await opsApi.subjects(subjectKeyword.value, subjectRisk.value)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载主体失败')
  }
}

function resetSubjects() {
  subjectRisk.value = 'all'
  subjectKeyword.value = ''
  void loadSubjects()
}

async function loadRectifications() {
  try {
    rectifications.value = await opsApi.rectifications('feedback')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载整改队列失败')
  }
}

async function loadCheckItems() {
  try {
    checkItems.value = await opsApi.checkItems()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载执法事项失败')
  }
}
function applyCheckItemFilter() {
  checkItemKeyword.value = checkItemDraft.value.trim()
}
function resetCheckItemFilter() {
  checkItemDraft.value = ''
  checkItemKeyword.value = ''
  checkItemStatus.value = 'all'
}

async function loadCases() {
  try {
    cases.value = await opsApi.cases()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载案件失败')
  }
}
function applyCaseFilter() {
  caseKeyword.value = caseDraft.value.trim()
}
function resetCaseFilter() {
  caseDraft.value = ''
  caseKeyword.value = ''
  caseStatusFilter.value = 'all'
}

async function loadSubsidies() {
  try {
    subsidies.value = await opsApi.subsidies()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载补贴项目失败')
  }
}
function applySubsidyFilter() {
  subsidyKeyword.value = subsidyDraft.value.trim()
}
function resetSubsidyFilter() {
  subsidyDraft.value = ''
  subsidyKeyword.value = ''
  subsidyStatusFilter.value = 'all'
}

async function loadSamplings() {
  try {
    samplings.value = await opsApi.samplings()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载抽检台账失败')
  }
}
function applySamplingFilter() {
  samplingKeyword.value = samplingDraft.value.trim()
}
function resetSamplingFilter() {
  samplingDraft.value = ''
  samplingKeyword.value = ''
  samplingResultFilter.value = 'all'
}

async function loadDataShares() {
  try {
    dataShares.value = await opsApi.dataShares()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载共享台账失败')
  }
}
function applyShareFilter() {
  shareKeyword.value = shareDraft.value.trim()
}
function resetShareFilter() {
  shareDraft.value = ''
  shareKeyword.value = ''
  shareStatusFilter.value = 'all'
}

async function loadStatistics() {
  try {
    statsData.value = await opsApi.statistics()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载统计数据失败')
  }
}

async function loadStaffList() {
  try {
    staffList.value = await opsApi.users()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载组织人员失败')
  }
}
function applyStaffFilter() {
  staffKeyword.value = staffDraft.value.trim()
}
function resetStaffFilter() {
  staffDraft.value = ''
  staffKeyword.value = ''
  staffStatusFilter.value = 'all'
}

async function loadLogs() {
  try {
    logs.value = await opsApi.logs()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载审计日志失败')
  }
}
function applyLogFilter() {
  logKeyword.value = logDraft.value.trim()
}
function resetLogFilter() {
  logDraft.value = ''
  logKeyword.value = ''
}

function openBindMerchant(s: Subject) {
  merchantTarget.value = s
  merchantIdInput.value = s.merchantId ?? ''
}

async function applyMerchantBinding(s: Subject, value: string) {
  try {
    await opsApi.bindSubjectMerchant(s.id, value)
    message.success(
      value
        ? '已绑定平台经营主体：该主体账号现在能在主体端看到自己的证照、整改与通知'
        : '已解除绑定：主体端会明确提示档案未登记该经营主体',
    )
    merchantTarget.value = null
    await loadSubjects()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '绑定失败')
  }
}

function exportSubjects() {
  try {
    downloadCsv('市场主体台账.csv', subjects.value as unknown as Array<Record<string, unknown>>)
    message.success('已导出当前筛选结果')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导出失败')
  }
}

function openAssignWarning(w: Warning) {
  warningTarget.value = w
  warningNote.value = ''
  warningAssignee.value = undefined
}

async function submitWarningAssign() {
  if (!warningTarget.value) return
  try {
    await opsApi.handleWarning(warningTarget.value.id, {
      status: 'processing',
      assigneeId: warningAssignee.value,
      note: warningNote.value,
    })
    warningTarget.value = null
    message.success('预警已分派，承办人在移动执法端可看到')
    warnings.value = await opsApi.warnings()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

function openRectReview(row: Rectification, status: 'closed' | 'pending') {
  rectReview.value = { row, status }
  rectReviewNote.value = status === 'closed' ? '材料齐全，同意结案' : '材料不足，请补充后重新反馈'
}

async function submitRectReview() {
  if (!rectReview.value) return
  try {
    await opsApi.reviewRectification(rectReview.value.row.id, {
      status: rectReview.value.status,
      note: rectReviewNote.value,
    })
    message.success(rectReview.value.status === 'closed' ? '整改已结案，主体端同步收到结论' : '已退回主体重新反馈')
    rectReview.value = null
    rectReviewNote.value = ''
    rectifications.value = await opsApi.rectifications('feedback')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '复核失败')
  }
}

async function submitCreateTask() {
  if (!taskForm.subjectId) {
    message.warning('请从监管台账里选择主体')
    return
  }
  if (!taskForm.assigneeId) {
    message.warning('必须点名承办人')
    return
  }
  try {
    await opsApi.createTask({ ...taskForm })
    taskModalOpen.value = false
    taskForm.subjectId = undefined
    taskForm.address = ''
    taskForm.deadline = ''
    taskForm.assigneeId = undefined
    message.success('执法任务已创建并按清单模板展开检查项')
    tasks.value = await opsApi.tasks()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败')
  }
}

function openCheckItemModal(item: CheckItem | null) {
  checkItemTarget.value = item
  checkItemForm.itemName = item?.itemName ?? ''
  checkItemForm.note = item?.note ?? ''
  checkItemModalOpen.value = true
}

async function saveCheckItem() {
  if (!checkItemForm.itemName.trim()) {
    message.warning('请填写检查项名称')
    return
  }
  try {
    if (checkItemTarget.value) {
      await opsApi.updateCheckItem(checkItemTarget.value.id, { ...checkItemForm })
    } else {
      await opsApi.createCheckItem({ ...checkItemForm })
    }
    message.success(checkItemTarget.value ? '检查项已更新，历史任务结论不受影响' : '检查项已加入清单模板')
    checkItemModalOpen.value = false
    checkItems.value = await opsApi.checkItems()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function toggleCheckItem(item: CheckItem, active: boolean) {
  try {
    await opsApi.toggleCheckItem(item.id, active)
    message.success(active ? '已启用，新建任务会带上这一项' : '已停用，仅影响新建任务')
    checkItems.value = await opsApi.checkItems()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

function nextCaseStage(c: Case): string {
  return c.status === 'filing'
    ? 'investigating'
    : c.status === 'investigating'
      ? 'evidence'
      : c.status === 'evidence'
        ? 'decision'
        : 'closed'
}

async function advanceCase(c: Case) {
  try {
    await opsApi.advanceCase(c.id, { status: nextCaseStage(c), handler: c.handler })
    message.success('案件阶段已推进')
    cases.value = await opsApi.cases()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function askRepairReview(r: Repair, status: 'approved' | 'rejected') {
  const note = window.prompt(
    status === 'approved' ? '同意修复的复核意见（主体端可见）' : '驳回理由（主体端会原样看到）',
    status === 'approved' ? '整改材料完整，同意修复' : '材料不足，请补充证明材料',
  )
  if (note === null || !note.trim()) return
  try {
    await opsApi.reviewRepair(r.id, { status, note: note.trim() })
    message.success(status === 'approved' ? '修复已通过，主体端可见进度' : '已驳回补件，主体端可见理由')
    repairs.value = await opsApi.repairs()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function reviewSubsidy(s: Subsidy, status: string) {
  try {
    await opsApi.reviewSubsidy(s.id, { status, note: '遥感与材料核验通过', remoteCheckStatus: '遥感核查通过' })
    message.success('项目审核状态已更新，主体端同步收到')
    subsidies.value = await opsApi.subsidies()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

function openHandleComplaint(c: Complaint) {
  complaintTarget.value = c
  complaintNote.value = ''
}

async function submitHandleComplaint() {
  if (!complaintTarget.value) return
  if (!complaintNote.value.trim()) {
    message.warning('请填写处理结论')
    return
  }
  try {
    await opsApi.handleComplaint(complaintTarget.value.id, {
      status: 'resolved',
      note: complaintNote.value,
      assignedOrg: complaintTarget.value.assignedOrg || '县级农业农村局',
    })
    complaintTarget.value = null
    message.success('举报已办结，处理结论已通知被举报主体')
    complaints.value = await opsApi.complaints()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function submitCreateSampling() {
  if (!samplingForm.subjectId || !samplingForm.productName.trim()) {
    message.warning('请选择监管主体并填写产品名称')
    return
  }
  try {
    await opsApi.createSampling({ ...samplingForm })
    samplingModalOpen.value = false
    samplingForm.subjectId = undefined
    samplingForm.productName = ''
    samplingForm.testItems = ''
    samplingForm.result = undefined
    message.success('抽样任务已创建，主体端已收到抽检通知')
    samplings.value = await opsApi.samplings()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '创建失败')
  }
}

async function reviewDataShare(d: DataShare, status: 'approved' | 'rejected') {
  try {
    await opsApi.reviewDataShare(d.id, { status, note: '数据分级与共享范围已核验' })
    message.success(status === 'approved' ? '共享授权已通过' : '已驳回该共享申请')
    dataShares.value = await opsApi.dataShares()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

function exportStatsCases() {
  if (!statsData.value) return
  try {
    downloadCsv('案件台账.csv', statsData.value.cases as unknown as Array<Record<string, unknown>>)
    message.success('案件台账已下载')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导出失败')
  }
}

function openBindPlatformUser(u: StaffRow) {
  staffTarget.value = u
  staffPlatformId.value = u.platformUserId ?? ''
}

async function bindPlatformUser(u: StaffRow, value: string) {
  try {
    await opsApi.bindUserPlatform(u.id, value)
    message.success(
      value
        ? '已绑定平台账号：该执法人员可用统一账号登录移动执法端'
        : '已解除绑定：移动执法端将无法确认"我是谁"',
    )
    staffTarget.value = null
    staffList.value = await opsApi.users()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '绑定失败')
  }
}

function exportLogs() {
  try {
    downloadCsv('操作审计日志.csv', logs.value as unknown as Array<Record<string, unknown>>)
    message.success('审计日志已下载')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '导出失败')
  }
}

async function loadPageData(current: Page) {
  if (!unifiedSession.user) return
  opsApi.overview().then((d) => { overview.value = d }).catch(() => { overview.value = null })
  opsApi.identity().then((d) => { identity.value = d }).catch(() => { identity.value = null })

  try {
    if (current === 'subjects') {
      if (transferKeyword.value) {
        subjectKeyword.value = transferKeyword.value
        transferKeyword.value = ''
      }
      await loadSubjects()
    } else if (current === 'warnings') {
      const [w, u] = await Promise.all([opsApi.warnings(), opsApi.users().catch(() => [])])
      warnings.value = w
      staffList.value = u
    } else if (current === 'tasks') {
      const [t, r, u, s] = await Promise.all([
        opsApi.tasks(),
        opsApi.rectifications('feedback').catch(() => []),
        opsApi.users().catch(() => []),
        opsApi.subjects().catch(() => []),
      ])
      tasks.value = t
      rectifications.value = r
      staffList.value = u
      subjects.value = s
    } else if (current === 'items') {
      checkItems.value = await opsApi.checkItems()
    } else if (current === 'cases') {
      cases.value = await opsApi.cases()
    } else if (current === 'repairs') {
      repairs.value = await opsApi.repairs()
    } else if (current === 'subsidies') {
      subsidies.value = await opsApi.subsidies()
    } else if (current === 'complaints') {
      complaints.value = await opsApi.complaints()
    } else if (current === 'samplings') {
      const [sp, sb] = await Promise.all([opsApi.samplings(), opsApi.subjects().catch(() => [])])
      samplings.value = sp
      subjects.value = sb
    } else if (current === 'sharing') {
      dataShares.value = await opsApi.dataShares()
    } else if (current === 'statistics') {
      statsData.value = await opsApi.statistics()
    } else if (current === 'users') {
      staffList.value = await opsApi.users()
    } else if (current === 'logs') {
      logs.value = await opsApi.logs()
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}

const syncLayout = () => { collapsed.value = window.innerWidth < 1280 }
const onHashChange = () => {
  page.value = parse()
  window.scrollTo({ top: 0 })
}

watch(
  () => unifiedSession.user,
  (user) => {
    if (!user) return
    const latest = parse()
    if (page.value !== latest) page.value = latest
  },
)

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
