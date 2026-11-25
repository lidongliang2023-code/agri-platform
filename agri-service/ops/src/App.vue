<template>
  <a-config-provider :locale="zhCN" :theme="theme">
    <UnifiedSsoGate
      client-id="service-ops"
      :landing-path="landingPath"
      :required-permissions="['service:admin', 'service:policy:desk']"
      match-any-permission
    >
      <!-- 仅政策审核员权限时只渲染政策项目页 -->
      <main v-if="!isFullAdmin" class="ops-page">
        <div class="ops-page-title">
          <div>
            <span>COMPREHENSIVE SERVICE · OPERATIONS</span>
            <h1>政策项目运营</h1>
            <p>匹配结果、主体资格、材料核验与补贴兑付进度。</p>
          </div>
        </div>
        <section class="ops-card ops-table-card">
          <a-table row-key="id" :data-source="policies" :columns="policyColumns" :pagination="tablePagination">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'applicationNo'">
                <div class="ops-table-entity"><b>{{ record.applicationNo }}</b><small>{{ record.policyTitle }}</small></div>
              </template>
              <template v-else-if="column.key === 'amountText'"><b>{{ record.amountText }}</b></template>
              <template v-else-if="column.key === 'progress'">
                <a-progress :percent="record.progress" size="small" stroke-color="#159a5e" />
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :class="`ops-status tone-${labelMeta(POLICY_STATUS, record.status).tone}`">{{ labelMeta(POLICY_STATUS, record.status).label }}</a-tag>
              </template>
              <template v-else-if="column.key === 'action'">
                <a-button v-if="record.allowedStatuses?.length" type="link" @click="openPolicyReview(record)">审核</a-button>
                <span v-else>无可用操作</span>
              </template>
            </template>
          </a-table>
        </section>
      </main>

      <!-- 完整运营工作台 -->
      <div v-else class="ops-shell" :class="{ collapsed }">
        <aside class="ops-sidebar">
          <button type="button" class="ops-brand" @click="go('dashboard')">
            <img class="ops-brand-logo" :src="`${baseUrl}fengchain.svg`" alt="丰链云" />
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
                :class="{ on: route.page === item.page }"
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
            role="综合服务运营"
            :collapsed="collapsed"
            switch-label="切换身份（服务用户端）"
            :switch-url="userPortalUrl"
            @logout="handleLogout"
          />
        </aside>

        <div class="ops-main">
          <AgriVueTopHeader
            header-class="ops-header"
            right-class="ops-header-right"
            :collapsed="collapsed"
            :breadcrumbs="['综合服务', TITLES[route.page]]"
            @toggle-collapse="collapsed = !collapsed"
          >
            <template #center>
              <form @submit.prevent="submitTopSearch">
                <SearchOutlined />
                <input v-model="topKeyword" placeholder="搜索服务商 / 订单 / 工单号" />
              </form>
            </template>
            <template #right>
              <span class="ops-date">{{ todayText }}</span>
              <button type="button" class="ops-bell" title="待办事项" @click="go('dispatch')">
                <a-badge :count="totalTodoCount" size="small"><BellOutlined /></a-badge>
              </button>
              <a-dropdown>
                <button type="button" class="ops-user">
                  <a-avatar :size="30" class="ops-avatar">{{ displayName.slice(0, 1) }}</a-avatar>
                  <span><b>{{ displayName }}</b><small>统一账号 · 运营端</small></span>
                </button>
                <template #overlay>
                  <a-menu @click="handleUserMenu">
                    <a-menu-item key="team">岗位与权限</a-menu-item>
                    <a-menu-item key="logs">操作审计</a-menu-item>
                    <a-menu-item key="logout">退出统一登录</a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
            </template>
          </AgriVueTopHeader>

          <AgriVueWorkspaceTabs
            :active-key="activeTabKey"
            :active-label="activeTabLabel"
            home-key="dashboard"
            :home-label="TITLES.dashboard"
            storage-key="agri-service-ops:workspace-tabs"
            @navigate="(path) => navigatePath(path)"
          />

          <main>
            <!-- 运营大盘 -->
            <div v-if="route.page === 'dashboard'" class="ops-page">
              <div v-if="!overview" class="ops-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="ops-page-title">
                  <div>
                    <span>COMPREHENSIVE SERVICE · OPERATIONS</span>
                    <h1>运营大盘</h1>
                    <p>服务交易、供给质量、履约风险与政策项目的实时运营视角。</p>
                  </div>
                  <div class="ops-page-actions">
                    <a-button @click="go('reports')">导出经营报表</a-button>
                    <a-button type="primary" @click="go('dispatch')">进入调度台</a-button>
                  </div>
                </div>

                <div class="ops-metrics-grid">
                  <div class="ops-metric tone-green"><span><TeamOutlined /></span><div><small>认证服务商</small><b>{{ overview.metrics.providers.toLocaleString() }}</b><em>{{ overview.metrics.pendingProviders }} 家待审核 · {{ overview.metrics.unboundProviders }} 家未绑定平台主体</em></div></div>
                  <div class="ops-metric tone-blue"><span><FundOutlined /></span><div><small>服务 GMV</small><b>¥{{ (overview.metrics.gmv / 10000).toFixed(1) }}万</b><em>平台服务费 ¥{{ overview.metrics.platformFee.toLocaleString() }}</em></div></div>
                  <div class="ops-metric tone-amber"><span><ClockCircleOutlined /></span><div><small>履约订单</small><b>{{ overview.metrics.activeOrders }}</b><em>累计 {{ overview.metrics.totalOrders }} 单</em></div></div>
                  <div class="ops-metric tone-red"><span><AlertOutlined /></span><div><small>待处理风险</small><b>{{ overview.metrics.openComplaints }}</b><em>{{ overview.metrics.pendingClaims }} 笔理赔待跟进</em></div></div>
                </div>

                <div class="ops-dashboard-main">
                  <section class="ops-card ops-trend-card">
                    <div class="ops-card-head">
                      <div><b>近 7 日服务交易趋势</b><small>订单量与 GMV 日趋势</small></div>
                      <div class="legend"><span><i class="green" />GMV</span><span><i class="blue" />订单</span></div>
                    </div>
                    <div class="ops-chart">
                      <div v-for="item in overview.trend" :key="item.date" class="ops-chart-col">
                        <div class="ops-chart-bars">
                          <span :style="{ height: `${Math.max(16, (Number(item.gmv) / maxOverviewGmv) * 100)}%` }" />
                          <i :style="{ height: `${Math.max(12, (item.orders / 260) * 100)}%` }" />
                        </div>
                        <small>{{ item.date.slice(5) }}</small>
                        <em>{{ Math.round(Number(item.gmv) / 1000) }}k</em>
                      </div>
                    </div>
                  </section>

                  <section class="ops-card ops-todo-card">
                    <div class="ops-card-head">
                      <div><b>今日待办</b><small>按业务实数聚合</small></div>
                      <a-tag color="orange">{{ overviewTodosTotal }} 项</a-tag>
                    </div>
                    <button
                      v-for="todo in overview.todos"
                      :key="`${todo.route}-${todo.title}`"
                      type="button"
                      @click="go(resolvePage(todo.route))"
                    >
                      <span>{{ todo.count }}</span>
                      <div><b>{{ todo.title }}</b><small>{{ todo.description }}</small></div>
                      <em>处理 ›</em>
                    </button>
                    <div v-if="!overview.todos.length" class="ops-empty">当前没有待办事项</div>
                  </section>
                </div>

                <div class="ops-dashboard-lower">
                  <section class="ops-card">
                    <div class="ops-card-head">
                      <div><b>风险与质量预警</b><small>AI 与规则引擎共同识别</small></div>
                      <a-button size="small" @click="go('quality')">查看全部</a-button>
                    </div>
                    <div class="ops-alert-list">
                      <button
                        v-for="alert in overview.alerts"
                        :key="alert.id"
                        type="button"
                        :class="`level-${alert.level}`"
                        @click="go('quality')"
                      >
                        <span><WarningOutlined v-if="alert.level === 'high'" /><AlertOutlined v-else /></span>
                        <div><b>{{ alert.type }} · {{ alert.providerName }}</b><p>{{ alert.content }}</p><small>{{ alert.createdAt }} · AI 风险分 {{ alert.score }}</small></div>
                        <em>{{ alert.level === 'high' ? '高优' : '跟进' }}</em>
                      </button>
                    </div>
                  </section>

                  <section class="ops-card ops-region-card">
                    <div class="ops-card-head">
                      <div><b>区域服务供给</b><small>服务商与平均评分</small></div>
                      <a-button size="small" @click="go('reports')">区域报表</a-button>
                    </div>
                    <div v-for="region in overview.regions.slice(0, 5)" :key="region.name">
                      <span>{{ region.name }}</span>
                      <div><i :style="{ width: `${Math.min(100, region.providers * 28)}%` }" /></div>
                      <b>{{ region.providers }} 家</b>
                      <em>★ {{ region.rating }}</em>
                    </div>
                  </section>
                </div>

                <section class="ops-ai-brief">
                  <span><RobotOutlined /></span>
                  <div>
                    <small>需要你处理的事实</small>
                    <p>
                      预警池共 {{ overview.alerts.length }} 条（高风险 {{ overview.alerts.filter((i) => i.level === 'high').length }} 条）；
                      未绑定平台主体的服务商 {{ overview.metrics.unboundProviders }} 家，这些档案的账号进不了工作台；
                      待办合计 {{ overviewTodosTotal }} 项。
                    </p>
                  </div>
                  <a-button @click="go('quality')">进入预警处置</a-button>
                </section>
              </template>
            </div>

            <!-- 专家账号绑定 -->
            <ExpertsPage v-else-if="route.page === 'experts'" />

            <!-- 服务商管理 -->
            <div v-else-if="route.page === 'providers'" class="ops-page ops-providers-dense">
              <div class="ops-dense-head">
                <div class="ops-dense-head-copy">
                  <h1>服务商管理</h1>
                  <span class="ops-dense-head-meta">主体资质、经营状态、信用等级与平台账号绑定统一管理</span>
                </div>
                <div class="ops-page-actions"><a-button @click="exportProvidersCsv">导出当前名录</a-button></div>
              </div>
              <section class="ops-card ops-filter">
                <div class="ops-tabs">
                  <button v-for="key in providerStatusKeys" :key="key" type="button" :class="{ on: providerStatus === key }" @click="changeProviderStatus(key)">
                    {{ key === 'all' ? '全部' : PROVIDER_STATUS[key]?.label }}
                  </button>
                </div>
                <a-input v-model:value="providerKeyword" placeholder="搜索名称、服务类型或区域" @pressEnter="loadProviders">
                  <template #prefix><SearchOutlined /></template>
                </a-input>
                <a-button type="primary" @click="loadProviders">查询</a-button>
              </section>
              <section class="ops-card ops-table-card">
                <a-table row-key="id" :loading="providersLoading" :columns="providerColumns" :data-source="providers" :scroll="{ x: 1240 }" :pagination="tablePagination">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'">
                      <button type="button" class="ops-entity ops-entity-inline" :title="`${record.name}（${record.creditCode ?? `SV${record.id}`}）`" @click="go('provider-detail', record.id)">
                        <span>{{ record.categoryIcon }}</span>
                        <b>{{ record.name }}</b>
                        <small>{{ record.creditCode ?? `SV${record.id}` }}</small>
                      </button>
                    </template>
                    <template v-else-if="column.key === 'category'"><a-tag>{{ record.category }}</a-tag></template>
                    <template v-else-if="column.key === 'region'"><span class="ops-cell-ellipsis" :title="record.region">{{ record.region || '—' }}</span></template>
                    <template v-else-if="column.key === 'merchantId'">
                      <a-tag v-if="record.merchantId" color="green">已绑定</a-tag>
                      <a-tag v-else color="red">未绑定</a-tag>
                    </template>
                    <template v-else-if="column.key === 'creditScore'">
                      <b :class="record.creditScore < 70 ? 'text-red' : record.creditScore > 90 ? 'text-green' : ''">{{ record.creditScore }}</b>
                    </template>
                    <template v-else-if="column.key === 'rating'"><span class="ops-rating">★ {{ record.rating }}</span></template>
                    <template v-else-if="column.key === 'cancelRate'"><span :class="Number(record.cancelRate) > 10 ? 'text-red' : ''">{{ record.cancelRate }}%</span></template>
                    <template v-else-if="column.key === 'status'">
                      <a-tag :class="`ops-status tone-${labelMeta(PROVIDER_STATUS, record.status).tone}`">{{ labelMeta(PROVIDER_STATUS, record.status).label }}</a-tag>
                    </template>
                    <template v-else-if="column.key === 'actions'">
                      <a-button type="link" size="small" @click="go('provider-detail', record.id)">档案</a-button>
                      <a-button type="link" size="small" @click="openProviderReview(record)">{{ record.status === 'pending' ? '审核' : '处置' }}</a-button>
                      <a-button type="link" size="small" @click="openProviderBinding(record)">主体绑定</a-button>
                    </template>
                  </template>
                </a-table>
              </section>

              <a-modal :open="Boolean(providerReviewTarget)" :title="`服务商处置 · ${providerReviewTarget?.name ?? ''}`" :confirm-loading="submitting" ok-text="确认提交" @cancel="providerReviewTarget = null" @ok="submitProviderReview">
                <a-form layout="vertical">
                  <a-form-item label="审核后状态"><a-select v-model:value="providerReviewStatus" :options="providerStatusOptions" /></a-form-item>
                  <a-form-item label="审核意见 / 处置原因" required><a-textarea v-model:value="providerReviewReason" :rows="4" placeholder="必填：写清依据，这段文字会进审计日志与服务商通知" /></a-form-item>
                </a-form>
                <div class="ops-notice warn">状态变更会写入审计留痕；存在未完结工单的服务商不能直接冻结或清退，需要先处理在途订单。</div>
              </a-modal>

              <a-modal :open="Boolean(providerBindTarget)" :title="`平台主体绑定 · ${providerBindTarget?.name ?? ''}`" :confirm-loading="submitting" ok-text="保存绑定" @cancel="providerBindTarget = null" @ok="submitProviderBinding">
                <a-form layout="vertical">
                  <a-form-item label="平台经营主体号（merchantId）">
                    <a-input v-model:value="providerBindMerchantId" placeholder="填平台侧的商户号；清空并保存即解除绑定" />
                  </a-form-item>
                </a-form>
                <div class="ops-notice">
                  当前档案：{{ providerBindTarget?.name ?? '' }}（id={{ providerBindTarget?.id }}）· 现绑定 {{ providerBindTarget?.merchantId ?? '无' }}。
                  服务商移动工作台的身份由「登录账号所属经营主体 → 这条绑定」解析；一个主体只能绑一家服务商。
                </div>
              </a-modal>
            </div>

            <!-- 服务商详情档案 -->
            <div v-else-if="route.page === 'provider-detail'" class="ops-page">
              <div v-if="!providerDetail" class="ops-loading"><i /><i /><i /></div>
              <template v-else>
                <button type="button" class="ops-back" @click="go('providers')">← 返回服务商列表</button>
                <section class="ops-provider-hero">
                  <span>{{ providerDetail.categoryIcon }}</span>
                  <div>
                    <div>
                      <a-tag :class="`ops-status tone-${labelMeta(PROVIDER_STATUS, providerDetail.status).tone}`">{{ labelMeta(PROVIDER_STATUS, providerDetail.status).label }}</a-tag>
                      <a-tag>{{ providerDetail.badge }}</a-tag>
                    </div>
                    <h1>{{ providerDetail.name }}</h1>
                    <p>{{ providerDetail.creditCode ?? '统一社会信用代码待补' }} · {{ providerDetail.region }} · {{ providerDetail.category }}</p>
                    <em>信用分 {{ providerDetail.creditScore }} · 服务 {{ providerDetail.orderCount }} 单 · ★ {{ providerDetail.rating }} · 取消率 {{ providerDetail.cancelRate }}%</em>
                  </div>
                  <div>
                    <a-button @click="go('catalog')">查看其服务商品</a-button>
                    <a-button type="primary" @click="openDetailStatusModal">调整经营状态</a-button>
                  </div>
                </section>
                <div class="ops-provider-grid">
                  <section class="ops-card">
                    <div class="ops-card-head"><div><b>经营与风险概况</b><small>近 7 日指标</small></div></div>
                    <div class="ops-kv-grid">
                      <span><small>信用等级</small><b>{{ providerDetail.creditScore >= 90 ? 'A / 优质' : providerDetail.creditScore >= 75 ? 'B / 正常' : 'C / 风险' }}</b></span>
                      <span><small>接单取消率</small><b :class="providerDetail.cancelRate > 10 ? 'text-red' : ''">{{ providerDetail.cancelRate }}%</b></span>
                      <span><small>响应时效</small><b>档案未记录</b></span>
                      <span><small>平台主体</small><b>{{ providerDetail.merchantId ?? '未绑定' }}</b></span>
                      <span><small>风险等级</small><b>{{ providerDetail.riskLevel }}</b></span>
                      <span><small>联系人</small><b>{{ providerDetail.contactName ?? '待补' }}</b></span>
                      <span><small>联系电话</small><b>{{ providerDetail.contactPhone ?? '待补' }}</b></span>
                    </div>
                  </section>
                  <section class="ops-card">
                    <div class="ops-card-head"><div><b>最近订单</b><small>履约与结算概况</small></div></div>
                    <div class="ops-mini-list">
                      <div v-for="order in providerDetail.orders || []" :key="order.id">
                        <span>{{ order.orderNo }}</span>
                        <b>{{ order.serviceName }}</b>
                        <a-tag :class="`ops-status tone-${labelMeta(ORDER_STATUS, order.status).tone}`">{{ labelMeta(ORDER_STATUS, order.status).label }}</a-tag>
                        <em>¥{{ order.totalAmount.toLocaleString() }}</em>
                      </div>
                    </div>
                  </section>
                </div>
                <section class="ops-card ops-table-card">
                  <div class="ops-card-head"><div><b>服务商品与目录</b><small>审核状态与近期选择量</small></div></div>
                  <a-table row-key="id" :pagination="false" :data-source="providerDetail.items ?? []" :columns="providerDetailItemColumns">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'price'">¥{{ record.price }} / {{ record.unit }}</template>
                      <template v-else-if="column.key === 'auditStatus'">
                        <a-tag :color="record.auditStatus === 'approved' ? 'green' : 'orange'">{{ record.auditStatus === 'approved' ? '已通过' : record.auditStatus === 'rejected' ? '已驳回' : '待审核' }}</a-tag>
                      </template>
                      <template v-else-if="column.key === 'aiScore'">{{ record.aiScore }} 分</template>
                      <template v-else-if="column.key === 'selectedCount'">{{ record.selectedCount }} 人</template>
                    </template>
                  </a-table>
                </section>
                <a-modal v-model:open="detailStatusOpen" title="调整服务商经营状态" ok-text="确认处置" @ok="submitDetailStatus">
                  <a-form layout="vertical">
                    <a-form-item label="处置状态"><a-select v-model:value="detailNextStatus" :options="providerStatusOptions" /></a-form-item>
                    <a-form-item label="原因"><a-textarea v-model:value="detailReason" :rows="4" /></a-form-item>
                  </a-form>
                </a-modal>
              </template>
            </div>

            <!-- 服务商品审核 -->
            <div v-else-if="route.page === 'catalog'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>服务商品审核</h1><p>服务内容、价格区间、资质与版权材料统一审核。</p></div>
                <div class="ops-page-actions"><a-button @click="exportCatalogCsv">导出当前清单</a-button></div>
              </div>
              <section class="ops-card ops-filter">
                <div class="ops-tabs">
                  <button v-for="t in catalogTabs" :key="t.key" type="button" :class="{ on: catalogTab === t.key }" @click="changeCatalogTab(t.key)">{{ t.label }}</button>
                </div>
                <a-button @click="loadCatalog">刷新</a-button>
              </section>
              <section class="ops-card ops-table-card">
                <a-table row-key="id" :columns="catalogColumns" :data-source="catalogItems" :scroll="{ x: 960 }" :pagination="tablePagination">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'name'"><div class="ops-table-entity"><b>{{ record.name }}</b><small>{{ record.providerName }}</small></div></template>
                    <template v-else-if="column.key === 'price'">¥{{ record.price }} / {{ record.unit }}</template>
                    <template v-else-if="column.key === 'aiScore'"><b :class="record.aiScore < 70 ? 'text-red' : 'text-green'">{{ record.aiScore }} 分</b></template>
                    <template v-else-if="column.key === 'auditStatus'">
                      <a-tag :color="record.auditStatus === 'approved' ? 'green' : record.auditStatus === 'rejected' ? 'red' : 'orange'">
                        {{ record.auditStatus === 'approved' ? '已上架' : record.auditStatus === 'rejected' ? '已驳回' : '待审核' }}
                      </a-tag>
                    </template>
                    <template v-else-if="column.key === 'action'"><a-button type="link" @click="openCatalogReview(record)">审核</a-button></template>
                  </template>
                </a-table>
              </section>
              <a-modal :open="Boolean(catalogTarget)" :title="`商品审核 · ${catalogTarget?.name ?? ''}`" ok-text="提交审核" @cancel="catalogTarget = null" @ok="submitCatalogReview">
                <div class="ops-review-summary"><span>AI 预检 {{ catalogTarget?.aiScore }} 分</span><p>{{ catalogTarget?.description }}</p></div>
                <a-form layout="vertical">
                  <a-form-item label="审核结果"><a-select v-model:value="catalogResult" :options="catalogResultOptions" /></a-form-item>
                  <a-form-item label="审核意见"><a-textarea v-model:value="catalogReason" :rows="4" /></a-form-item>
                </a-form>
                <div class="ops-notice">审核结果将同步给服务商并写入审计日志。</div>
              </a-modal>
            </div>

            <!-- 全量服务订单 -->
            <div v-else-if="route.page === 'orders'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>全量服务订单</h1><p>查看全量订单、风险订单与派单状态，并支持人工改派。</p></div>
                <div class="ops-page-actions"><a-button @click="go('dispatch')">进入调度看板</a-button></div>
              </div>
              <section class="ops-card ops-filter">
                <div class="ops-tabs">
                  <button v-for="k in orderStatusKeys" :key="k" type="button" :class="{ on: orderStatus === k }" @click="changeOrderStatus(k)">
                    {{ k === 'all' ? '全部' : ORDER_STATUS[k]?.label }}
                  </button>
                </div>
                <a-input v-model:value="orderKeyword" placeholder="订单号 / 服务商 / 服务项目" @pressEnter="loadOrders">
                  <template #prefix><SearchOutlined /></template>
                </a-input>
                <a-button @click="loadOrders">查询</a-button>
              </section>
              <section class="ops-card ops-table-card">
                <a-table row-key="id" :columns="orderColumns" :data-source="orders" :scroll="{ x: 1160 }" :pagination="tablePagination">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'orderNo'"><div class="ops-table-entity"><b>{{ record.orderNo }}</b><small>{{ record.serviceName }} · {{ record.category }}</small></div></template>
                    <template v-else-if="column.key === 'totalAmount'"><b>¥{{ Number(record.totalAmount).toLocaleString() }}</b></template>
                    <template v-else-if="column.key === 'status'"><a-tag :class="`ops-status tone-${labelMeta(ORDER_STATUS, record.status).tone}`">{{ labelMeta(ORDER_STATUS, record.status).label }}</a-tag></template>
                    <template v-else-if="column.key === 'riskFlag'">
                      <a-tag v-if="record.riskFlag" color="red">{{ record.riskFlag }}</a-tag>
                      <span v-else class="muted">正常</span>
                    </template>
                    <template v-else-if="column.key === 'action'"><a-button type="link" @click="openOrderDispatch(record)">派单 / 改派</a-button></template>
                  </template>
                </a-table>
              </section>
              <a-modal :open="Boolean(orderDispatchTarget)" :title="`派单 · ${orderDispatchTarget?.orderNo ?? ''}`" ok-text="确认派单" @cancel="orderDispatchTarget = null" @ok="submitOrderDispatch">
                <a-form layout="vertical">
                  <a-form-item label="指派服务商（必选）">
                    <a-select v-model:value="orderDispatchProviderId" show-search option-filter-prop="label" placeholder="点名一家在营服务商" :options="availableProviderOptions" />
                  </a-form-item>
                  <a-form-item label="派单说明（必填）">
                    <a-textarea v-model:value="orderDispatchNote" :rows="3" placeholder="写明改派原因与约束，会写入订单动态并通知下单主体" />
                  </a-form-item>
                </a-form>
                <div class="ops-notice warn">改派只允许派给状态为「正常经营」的服务商；目标服务商当前不可接单会被服务端拒绝。</div>
              </a-modal>
            </div>

            <!-- 调度看板 -->
            <div v-else-if="route.page === 'dispatch'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>服务调度看板</h1><p>待分配需求、可用服务能力与风险工单的实时调度。</p></div>
                <div class="ops-page-actions"><a-button type="primary" @click="loadDispatch">刷新看板</a-button></div>
              </div>
              <div class="ops-kanban-head">
                <div><span>待调度需求</span><b>{{ dispatchDemands.length }}</b></div>
                <div><span>可用服务商</span><b>{{ availableProviders.length }}</b></div>
                <div><span>履约中工单</span><b>{{ dispatchOrders.length }}</b></div>
                <div><span>平均响应</span><b>6.8<small>分钟</small></b></div>
              </div>
              <div class="ops-kanban">
                <section>
                  <header><span /><b>待分配需求</b><em>{{ dispatchDemands.length }}</em></header>
                  <article v-for="demand in dispatchDemands" :key="demand.id">
                    <div><a-tag color="orange">{{ demand.category }}</a-tag><small>{{ demand.preferredDate }}</small></div>
                    <b>{{ demand.serviceName }}</b>
                    <p>{{ demand.description }}</p>
                    <footer>
                      <span>{{ demand.location }} · {{ demand.area }}<br />¥{{ demand.budgetMin }}-{{ demand.budgetMax }}</span>
                      <a-button size="small" type="primary" @click="openAssignDemand(demand)">指派</a-button>
                    </footer>
                  </article>
                </section>
                <section>
                  <header><span /><b>可调度服务能力</b><em>{{ availableProviders.length }}</em></header>
                  <article v-for="provider in availableProviders" :key="provider.id">
                    <div><a-tag color="green">{{ provider.category }}</a-tag><small>{{ provider.region }}</small></div>
                    <b>{{ provider.name }}</b>
                    <p>★ {{ provider.rating }} · 信用 {{ provider.creditScore }} · {{ provider.cancelRate }}% 取消率</p>
                    <footer>
                      <span>¥{{ provider.price }}/{{ provider.unit.replace('元/', '') }}</span>
                      <a-button size="small" @click="go('provider-detail', provider.id)">档案</a-button>
                    </footer>
                  </article>
                </section>
                <section>
                  <header><span /><b>履约与风险工单</b><em>{{ dispatchOrders.length }}</em></header>
                  <article v-for="order in dispatchOrders" :key="order.id" :class="{ risk: Boolean(order.riskFlag) }">
                    <div><a-tag :color="order.riskFlag ? 'red' : 'blue'">{{ order.category }}</a-tag><small>{{ order.appointmentDate }}</small></div>
                    <b>{{ order.serviceName }}</b>
                    <p>{{ order.providerName }} · {{ order.location }}</p>
                    <em v-if="order.riskFlag" class="risk-flag">{{ order.riskFlag }}</em>
                    <footer><span>进度 {{ order.progress }}%</span><a-button size="small" @click="go('orders')">处理</a-button></footer>
                  </article>
                </section>
              </div>
              <a-modal :open="Boolean(demandTarget)" title="指派服务商" ok-text="确认指派" @cancel="demandTarget = null" @ok="submitAssignDemand">
                <div class="ops-review-summary"><b>{{ demandTarget?.serviceName }}</b><span>{{ demandTarget?.location }} · {{ demandTarget?.area }} · ¥{{ demandTarget?.budgetMin }}-{{ demandTarget?.budgetMax }}</span></div>
                <a-form layout="vertical">
                  <a-form-item label="服务商"><a-select v-model:value="demandProviderId" :options="dispatchProviderOptions" /></a-form-item>
                </a-form>
                <div class="ops-notice">确认后将自动生成服务工单，并通知服务商和需求方。</div>
              </a-modal>
            </div>

            <!-- 投诉与仲裁 -->
            <div v-else-if="route.page === 'disputes'" class="ops-page">
              <div class="ops-page-title"><div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>投诉与仲裁</h1><p>集中处理服务时效、作业质量、结算争议与赔付事项。</p></div></div>
              <div class="ops-dispute-grid">
                <section v-for="item in complaints" :key="item.id" class="ops-card">
                  <div class="ops-card-head">
                    <div><b>{{ item.complaintNo }}</b><small>{{ item.orderNo }} · {{ item.category }}</small></div>
                    <a-tag :color="item.status === 'resolved' ? 'green' : 'orange'">{{ item.status === 'resolved' ? '已办结' : '处理中' }}</a-tag>
                  </div>
                  <p class="ops-dispute-desc">{{ item.description }}</p>
                  <div class="ops-demand-box"><small>用户诉求</small><b>{{ item.demand || '未填写' }}</b></div>
                  <a-progress :percent="item.progress" :show-info="false" stroke-color="#159a5e" />
                  <div v-if="item.resolution" class="ops-demand-box"><small>处理结论</small><b>{{ item.resolution }}</b></div>
                  <footer>
                    <span>{{ item.handler ?? '待分配' }} · {{ item.createdAt }}</span>
                    <a-button v-if="item.status !== 'resolved'" type="primary" size="small" @click="openDisputeResolve(item)">处理工单</a-button>
                  </footer>
                </section>
                <div v-if="!complaints.length" class="ops-empty">当前没有投诉工单</div>
              </div>
              <a-modal :open="Boolean(disputeTarget)" :title="`处理投诉 · ${disputeTarget?.complaintNo ?? ''}`" :confirm-loading="submitting" ok-text="确认办结" @cancel="disputeTarget = null" @ok="submitDisputeResolve">
                <div class="ops-ai-suggestion">
                  <WarningOutlined />
                  <span><b>事实与诉求</b><p>{{ disputeTarget?.orderNo }}：{{ disputeTarget?.description }}；诉求「{{ disputeTarget?.demand || '未填写' }}」。处理结论将作为平台答复发给投诉方，并把处理人记为当前登录账号。</p></span>
                </div>
                <a-form layout="vertical">
                  <a-form-item label="处理结论" required><a-textarea v-model:value="disputeResolution" :rows="5" placeholder="例如：安排服务商补收漏作业 0.8 亩，并按合同核减作业费用 ¥48" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 质量与评价预警 -->
            <div v-else-if="route.page === 'quality'" class="ops-page">
              <div class="ops-page-title"><div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>质量与评价预警</h1><p>基于评分、取消率与投诉真实性的运营风险队列；预警条目由平台规则与人工登记产生。</p></div></div>
              <div class="ops-quality-list">
                <section v-for="item in qualityAlerts" :key="item.id" :class="`ops-quality-alert level-${item.level}`">
                  <span><WarningOutlined v-if="item.level === 'high'" /><AlertOutlined v-else /></span>
                  <div>
                    <div>
                      <a-tag :color="item.level === 'high' ? 'red' : item.level === 'medium' ? 'orange' : 'blue'">{{ item.type }}</a-tag>
                      <small>{{ item.createdAt }}</small>
                    </div>
                    <h3>{{ item.providerName }}</h3>
                    <p>{{ item.content }}</p>
                    <em>风险分 {{ item.score }}</em>
                  </div>
                  <div>
                    <a-tag :color="item.status === 'closed' ? 'green' : 'orange'">{{ item.status === 'closed' ? '已处理' : item.status === 'processing' ? '跟进中' : '待处理' }}</a-tag>
                    <template v-if="item.status !== 'closed'">
                      <a-button size="small" @click="item.providerId && go('provider-detail', item.providerId)">服务商档案</a-button>
                      <a-button size="small" type="primary" @click="openQualityResolve(item)">复核关闭</a-button>
                    </template>
                  </div>
                </section>
              </div>
              <div v-if="!qualityAlerts.length" class="ops-empty">当前没有质量预警</div>
              <a-modal :open="Boolean(qualityTarget)" :title="`复核预警 · ${qualityTarget?.providerName ?? ''}`" ok-text="确认关闭" @cancel="qualityTarget = null" @ok="submitQualityResolve">
                <div class="ops-ai-suggestion"><WarningOutlined /><span><b>{{ qualityTarget?.type }}</b><p>{{ qualityTarget?.content }}</p></span></div>
                <a-form layout="vertical">
                  <a-form-item label="复核结论" required><a-textarea v-model:value="qualityNote" :rows="4" placeholder="例如：已电话核实机手排班，取消率因天气导致，恢复观察 7 天" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 政策项目运营 -->
            <div v-else-if="route.page === 'policies'" class="ops-page">
              <div class="ops-page-title"><div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>政策项目运营</h1><p>匹配结果、主体资格、材料核验与补贴兑付进度。</p></div></div>
              <section class="ops-card ops-table-card">
                <a-table row-key="id" :data-source="policies" :columns="policyColumns" :pagination="tablePagination">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'applicationNo'">
                      <div class="ops-table-entity"><b>{{ record.applicationNo }}</b><small>{{ record.policyTitle }}</small></div>
                    </template>
                    <template v-else-if="column.key === 'amountText'"><b>{{ record.amountText }}</b></template>
                    <template v-else-if="column.key === 'progress'"><a-progress :percent="record.progress" size="small" stroke-color="#159a5e" /></template>
                    <template v-else-if="column.key === 'status'">
                      <a-tag :class="`ops-status tone-${labelMeta(POLICY_STATUS, record.status).tone}`">{{ labelMeta(POLICY_STATUS, record.status).label }}</a-tag>
                    </template>
                    <template v-else-if="column.key === 'action'">
                      <a-button v-if="record.allowedStatuses?.length" type="link" @click="openPolicyReview(record)">审核</a-button>
                      <span v-else>无可用操作</span>
                    </template>
                  </template>
                </a-table>
              </section>
            </div>

            <!-- 农险理赔运营 -->
            <div v-else-if="route.page === 'insurance'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>农险理赔运营</h1><p>跟进报案、查勘、定损、公示与赔付节点；节点推进受状态机约束，不能跳步。</p></div>
                <div class="ops-page-actions"><a-button @click="exportClaimsCsv">导出理赔清单</a-button></div>
              </div>
              <div class="ops-claim-grid">
                <section v-for="claim in claims" :key="claim.id" class="ops-card">
                  <div class="ops-card-head">
                    <div><b>{{ claim.disasterType }}</b><small>{{ claim.claimNo }} · {{ claim.policyNo }}</small></div>
                    <a-tag :color="claim.status === 'paid' ? 'green' : 'orange'">{{ claim.status === 'paid' ? '已赔付' : '处理中' }}</a-tag>
                  </div>
                  <p>{{ claim.description }}</p>
                  <div class="ops-claim-meta">
                    <span><small>受灾面积</small><b>{{ claim.lossArea }}</b></span>
                    <span><small>报案时间</small><b>{{ claim.createdAt }}</b></span>
                  </div>
                  <a-progress :percent="claim.progress" :show-info="false" stroke-color="#159a5e" />
                  <footer><a-button type="primary" size="small" @click="openClaimReview(claim)">更新理赔进度</a-button></footer>
                </section>
              </div>
              <a-modal :open="Boolean(claimTarget)" title="更新理赔进度" ok-text="保存" @cancel="claimTarget = null" @ok="submitClaimReview">
                <a-form layout="vertical">
                  <a-form-item label="案件节点"><a-select v-model:value="claimStatus" :options="claimStatusOptions" /></a-form-item>
                  <a-form-item label="处理说明"><a-textarea v-model:value="claimNote" :rows="4" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- 结算与分账 -->
            <div v-else-if="route.page === 'settlement'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>结算与分账</h1><p>按批次复核交易额与佣金；本版本只落复核结论，不执行真实资金动作。</p></div>
                <div class="ops-page-actions"><a-button @click="loadSettlements">重新拉取批次</a-button></div>
              </div>
              <section class="ops-card ops-table-card">
                <a-table row-key="id" :data-source="settlements" :columns="settlementColumns" :pagination="tablePagination">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'batchNo'"><div class="ops-table-entity"><b>{{ record.batchNo }}</b><small>{{ record.period }}</small></div></template>
                    <template v-else-if="column.key === 'orderCount'">{{ Number(record.orderCount).toLocaleString() }}</template>
                    <template v-else-if="column.key === 'amount'"><b>¥{{ Number(record.amount).toLocaleString() }}</b></template>
                    <template v-else-if="column.key === 'commission'">¥{{ Number(record.commission).toLocaleString() }}</template>
                    <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'approved' ? 'green' : 'orange'">{{ record.status === 'approved' ? '已复核' : '待复核' }}</a-tag></template>
                    <template v-else-if="column.key === 'reviewedBy'">{{ record.reviewedBy ?? '—' }}</template>
                    <template v-else-if="column.key === 'action'">
                      <a-button v-if="record.status === 'pending'" type="link" @click="openSettlementReview(record)">复核</a-button>
                      <span v-else class="muted">{{ record.reviewedAt }}</span>
                    </template>
                  </template>
                </a-table>
              </section>
              <a-modal :open="Boolean(settlementTarget)" title="结算批次复核" :confirm-loading="submitting" ok-text="复核通过" @cancel="settlementTarget = null" @ok="submitSettlementReview">
                <div class="ops-settlement-summary">
                  <div><small>批次</small><b>{{ settlementTarget?.batchNo }}</b></div>
                  <div><small>订单</small><b>{{ settlementTarget?.orderCount }}</b></div>
                  <div><small>交易额</small><b>¥{{ settlementTarget?.amount.toLocaleString() }}</b></div>
                  <div><small>佣金</small><b>¥{{ settlementTarget?.commission.toLocaleString() }}</b></div>
                </div>
                <div class="ops-notice warn">本版本只记录复核结论与复核人，不触发真实打款；同一批次不能重复复核。</div>
                <a-form layout="vertical">
                  <a-form-item label="复核说明" required><a-textarea v-model:value="settlementNote" :rows="3" placeholder="例如：抽查 20 笔已验收，差异 0，佣金按 1% 计提" /></a-form-item>
                </a-form>
              </a-modal>
            </div>

            <!-- AI 运营策略 -->
            <div v-else-if="route.page === 'ai'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>匹配与自动化策略</h1><p>撮合权重与自动派单规则的真实配置项；改动即时生效并写入审计日志。</p></div>
                <div class="ops-page-actions"><a-tag color="blue">共 {{ strategies.length }} 项参数</a-tag></div>
              </div>
              <section class="ops-ai-hero">
                <span><RobotOutlined /></span>
                <div>
                  <small>MATCHING CONFIG</small>
                  <h2>当前撮合口径</h2>
                  <p>{{ strategies.filter((i) => i.key.includes('weight')).map((i) => `${i.label} ${i.value}`).join(' · ') || '尚未配置匹配权重' }}</p>
                </div>
                <div><b>{{ strategies.find((i) => i.key === 'auto_dispatch')?.value === 'enabled' ? '已开启' : '未开启' }}</b><small>自动派单</small></div>
              </section>
              <div class="ops-strategy-grid">
                <section v-for="item in strategies" :key="item.key" class="ops-card ops-strategy">
                  <div><span><ThunderboltOutlined /></span><small>{{ item.key.includes('weight') ? '匹配权重' : '自动化规则' }}</small></div>
                  <h3>{{ item.label }}</h3>
                  <b>{{ item.value }}</b>
                  <p>{{ item.description }}</p>
                  <footer><small>更新于 {{ item.updatedAt }}</small><a-button size="small" @click="openEditStrategy(item)">调整</a-button></footer>
                </section>
              </div>
              <div v-if="!strategies.length" class="ops-empty">策略表为空，请先在服务域初始化 service_strategy 配置</div>
              <a-modal :open="Boolean(editingStrategy)" :title="`调整策略 · ${editingStrategy?.label ?? ''}`" ok-text="保存参数" @cancel="editingStrategy = null" @ok="submitEditStrategy">
                <a-form layout="vertical"><a-form-item label="参数值"><a-input v-model:value="strategyValue" /></a-form-item></a-form>
                <div class="ops-notice">保存后立刻影响需求撮合口径；本版本没有 A/B 分流，也没有调用量与命中率统计，请勿据此判断模型效果。</div>
              </a-modal>
            </div>

            <!-- 营销与优惠券 -->
            <div v-else-if="route.page === 'campaigns'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>营销与优惠券</h1><p>活动额度与领取进度按平台配置展示；本版本只支持启停，不支持在此新建活动。</p></div>
                <div class="ops-page-actions"><a-button @click="loadCampaigns">重新拉取活动</a-button></div>
              </div>
              <div class="ops-campaign-grid">
                <section v-for="item in campaigns" :key="item.id" class="ops-card ops-campaign">
                  <div class="ops-card-head">
                    <div><b>{{ item.name }}</b><small>{{ item.scope }}</small></div>
                    <a-tag :color="item.status === 'running' ? 'green' : item.status === 'government' ? 'blue' : 'orange'">
                      {{ item.status === 'running' ? '进行中' : item.status === 'government' ? '政府补贴' : item.status === 'scheduled' ? '待开始' : '已暂停' }}
                    </a-tag>
                  </div>
                  <div class="ops-campaign-figures">
                    <span><small>领取 / 发放</small><b>{{ item.claimed.toLocaleString() }} / {{ item.quota.toLocaleString() }}</b></span>
                    <span><small>预算</small><b>¥{{ item.budget.toLocaleString() }}</b></span>
                  </div>
                  <a-progress :percent="item.quota ? Math.round((item.claimed / item.quota) * 100) : 0" :show-info="false" stroke-color="#159a5e" />
                  <footer>
                    <span>{{ item.startsAt }} 至 {{ item.endsAt }}</span>
                    <a-button v-if="item.status !== 'government'" size="small" @click="toggleCampaign(item)">{{ item.status === 'running' ? '暂停' : '启用' }}</a-button>
                  </footer>
                </section>
              </div>
              <div v-if="!campaigns.length" class="ops-empty">当前没有配置活动</div>
            </div>

            <!-- 数据报表中心 -->
            <div v-else-if="route.page === 'reports'" class="ops-page">
              <div v-if="!reportData" class="ops-loading"><i /><i /><i /></div>
              <template v-else>
                <div class="ops-page-title">
                  <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>数据报表中心</h1><p>交易规模、品类结构、服务商经营与区域供给运营报表。</p></div>
                  <div class="ops-page-actions"><a-button type="primary" @click="exportReportCsv">导出经营报表</a-button></div>
                </div>
                <div class="ops-report-grid">
                  <section class="ops-card">
                    <div class="ops-card-head"><div><b>品类 GMV 结构</b><small>按订单金额</small></div></div>
                    <div class="ops-horizontal-bars">
                      <div v-for="item in reportData.categories" :key="item.category">
                        <span>{{ item.category }}</span>
                        <div><i :style="{ width: `${(Number(item.gmv) / maxCategoryGmv) * 100}%` }" /></div>
                        <b>¥{{ Number(item.gmv).toLocaleString() }}</b>
                      </div>
                    </div>
                  </section>
                  <section class="ops-card">
                    <div class="ops-card-head"><div><b>订单日趋势</b><small>近 7 日</small></div></div>
                    <div class="ops-report-trend">
                      <div v-for="item in reportData.trend" :key="item.date">
                        <i :style="{ height: `${(item.orders / 260) * 100}%` }" />
                        <span>{{ item.date.slice(5) }}</span>
                        <b>{{ item.orders }}</b>
                      </div>
                    </div>
                  </section>
                </div>
                <section class="ops-card ops-table-card">
                  <div class="ops-card-head"><div><b>服务商经营排行</b><small>评分与订单贡献</small></div></div>
                  <a-table row-key="id" :pagination="false" :data-source="reportData.providers" :columns="reportProviderColumns">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'rating'">★ {{ record.rating }}</template>
                      <template v-else-if="column.key === 'cancelRate'">{{ record.cancelRate }}%</template>
                    </template>
                  </a-table>
                </section>
              </template>
            </div>

            <!-- 角色与权限 -->
            <div v-else-if="route.page === 'team'" class="ops-page">
              <div class="ops-page-title">
                <div>
                  <span>COMPREHENSIVE SERVICE · OPERATIONS</span>
                  <h1>岗位与权限说明</h1>
                  <p>这里列出综合服务运营侧的岗位定义；真正的账号与授权在平台管理后台维护，本模块只按令牌判定。</p>
                </div>
                <div class="ops-page-actions">
                  <a-tag color="blue">
                    当前登录：{{ teamIdentity?.operatorName ?? '解析中…'
                    }}{{ teamIdentity?.operatorRole ? ` · ${teamIdentity.operatorRole}` : '' }}
                  </a-tag>
                </div>
              </div>
              <div class="ops-notice">
                运营端接口按平台 RBAC 校验（service:ops 可进运营接口，service:provider 只能进服务商工作台）。
                审核意见、派单说明、投诉结论与结算复核都是必填项，服务端会把操作人与来源 IP 写入审计日志。
              </div>
              <div class="ops-role-grid">
                <section v-for="item in teamMembers" :key="item.id" class="ops-card ops-role">
                  <div class="ops-role-head">
                    <a-avatar><template #icon><UserOutlined /></template></a-avatar>
                    <div><b>{{ item.role }}</b><span>{{ item.name }} · {{ item.scope }}</span></div>
                    <a-tag :color="item.status === 'active' ? 'green' : 'orange'">{{ item.status === 'active' ? '在编' : item.status }}</a-tag>
                  </div>
                  <div><a-tag v-for="permission in item.permissions" :key="permission">{{ permission }}</a-tag></div>
                </section>
              </div>
              <div v-if="!teamMembers.length" class="ops-empty">尚未配置运营岗位</div>
            </div>

            <!-- 操作审计日志 -->
            <div v-else-if="route.page === 'logs'" class="ops-page">
              <div class="ops-page-title">
                <div><span>COMPREHENSIVE SERVICE · OPERATIONS</span><h1>操作审计日志</h1><p>审核、派单、仲裁、政策与结算等敏感操作留痕；操作人与来源 IP 均由服务端从访问令牌和请求头解析。</p></div>
                <div class="ops-page-actions"><a-button @click="exportLogsCsv">导出当前日志</a-button></div>
              </div>
              <section class="ops-card ops-table-card">
                <a-table row-key="id" :data-source="logs" :columns="logColumns" :pagination="tablePagination">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'operator'"><div class="ops-table-entity"><b>{{ record.operator }}</b><small>{{ record.role }}</small></div></template>
                    <template v-else-if="column.key === 'action'"><a-tag>{{ record.action }}</a-tag></template>
                  </template>
                </a-table>
              </section>
            </div>
          </main>
        </div>
      </div>

      <!-- 政策审核弹窗（政策员和管理员共用） -->
      <a-modal
        :open="Boolean(policyTarget)"
        title="政策申报审核"
        ok-text="确认更新"
        :confirm-loading="policySaving"
        :ok-button-props="{ disabled: !policyReady || policySaving }"
        @cancel="!policySaving && (policyTarget = null)"
        @ok="submitPolicyReview"
      >
        <div class="ops-review-summary">
          <b>{{ policyTarget?.policyTitle }}</b>
          <span>{{ policyTarget?.applicant }} · {{ policyTarget ? POLICY_STATUS[policyTarget.status]?.label : '' }}</span>
        </div>
        <a-form layout="vertical" :disabled="policySaving">
          <a-form-item label="下一节点" required>
            <a-select v-model:value="policyStatus" placeholder="请选择审核节点" :options="policyAllowedOptions" />
          </a-form-item>
          <a-form-item label="审核意见" required>
            <a-textarea v-model:value="policyNote" :rows="3" placeholder="填写本次审核意见，将通知申报主体" />
          </a-form-item>
        </a-form>
        <div v-if="policyStatus === 'paid'" class="ops-notice warn">
          确认后将标记为已兑付，请核对兑付记录和金额 {{ policyTarget?.amountText }}。
        </div>
      </a-modal>
    </UnifiedSsoGate>
  </a-config-provider>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import {
  AlertOutlined,
  AppstoreOutlined,
  AuditOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileSearchOutlined,
  FundOutlined,
  InsuranceOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { AgriVueTopHeader, AgriVueWorkspaceTabs } from '@agri/shared/vue/workspace'
import {
  opsApi,
  ORDER_STATUS,
  POLICY_STATUS,
  PROVIDER_STATUS,
  type Campaign,
  type Complaint,
  type DispatchDemand,
  type InsuranceClaim,
  type OpLog,
  type OpsOrder,
  type OpsOverview,
  type OpsProvider,
  type PolicyApplication,
  type QualityAlert,
  type ServiceItem,
  type Settlement,
  type Strategy,
  type TeamMember,
} from './api'
import { logoutUnified, serviceSession } from './sso'
import UnifiedSsoGate from './UnifiedSsoGate.vue'
import SidebarUserCard from './SidebarUserCard.vue'
import ExpertsPage from './ExpertsPage.vue'

type Page =
  | 'dashboard'
  | 'providers'
  | 'provider-detail'
  | 'catalog'
  | 'orders'
  | 'dispatch'
  | 'disputes'
  | 'quality'
  | 'policies'
  | 'insurance'
  | 'settlement'
  | 'ai'
  | 'campaigns'
  | 'reports'
  | 'team'
  | 'logs'
  | 'experts'

interface RouteState {
  page: Page
  id?: number
}

const PAGES: Page[] = [
  'experts',
  'dashboard',
  'providers',
  'provider-detail',
  'catalog',
  'orders',
  'dispatch',
  'disputes',
  'quality',
  'policies',
  'insurance',
  'settlement',
  'ai',
  'campaigns',
  'reports',
  'team',
  'logs',
]

const TITLES: Record<Page, string> = {
  experts: '专家账号绑定',
  dashboard: '运营大盘',
  providers: '服务商管理',
  'provider-detail': '服务商详情档案',
  catalog: '服务商品审核',
  orders: '全量订单',
  dispatch: '调度派单',
  disputes: '投诉与仲裁',
  quality: '质量与评价预警',
  policies: '政策项目运营',
  insurance: '农险理赔运营',
  settlement: '结算与分账',
  ai: 'AI 运营与策略',
  campaigns: '营销与优惠券',
  reports: '数据报表中心',
  team: '角色与权限',
  logs: '操作审计日志',
}

const NAV = [
  { group: '仪表盘', items: [{ page: 'dashboard' as Page, label: '运营大盘', icon: BarChartOutlined }] },
  {
    group: '服务商管理',
    items: [
      { page: 'providers' as Page, label: '入驻审核与列表', icon: AuditOutlined },
      { page: 'quality' as Page, label: '等级与质量预警', icon: SafetyCertificateOutlined },
    ],
  },
  {
    group: '服务供给',
    items: [
      { page: 'experts' as Page, label: '专家账号绑定', icon: TeamOutlined },
      { page: 'catalog' as Page, label: '品类与商品审核', icon: AppstoreOutlined },
      { page: 'campaigns' as Page, label: '营销与优惠券', icon: ShopOutlined },
    ],
  },
  {
    group: '调度与履约',
    items: [
      { page: 'dispatch' as Page, label: '调度看板', icon: ThunderboltOutlined },
      { page: 'orders' as Page, label: '全量订单', icon: FileSearchOutlined },
      { page: 'disputes' as Page, label: '投诉与仲裁', icon: WarningOutlined },
    ],
  },
  {
    group: '质量·内容·资金',
    items: [
      { page: 'policies' as Page, label: '政策项目', icon: BookOutlined },
      { page: 'insurance' as Page, label: '农险理赔', icon: InsuranceOutlined },
      { page: 'settlement' as Page, label: '结算与分账', icon: DollarOutlined },
    ],
  },
  {
    group: 'AI·数据·系统',
    items: [
      { page: 'ai' as Page, label: 'AI 运营策略', icon: RobotOutlined },
      { page: 'reports' as Page, label: '数据报表中心', icon: FundOutlined },
      { page: 'team' as Page, label: '角色与权限', icon: TeamOutlined },
      { page: 'logs' as Page, label: '操作审计日志', icon: SettingOutlined },
    ],
  },
]

const PAGE_ALIASES: Record<string, Page> = {
  'service-provider': 'providers',
  claims: 'insurance',
}

function resolvePage(raw: string): Page {
  const normalized = PAGE_ALIASES[raw] ?? raw
  return PAGES.includes(normalized as Page) ? (normalized as Page) : 'dashboard'
}

function parseRoute(): RouteState {
  const parts = window.location.hash.replace(/^#\/?/, '').split('/')
  const page = resolvePage(parts[0] ?? '')
  const id = Number(parts[1])
  return { page, id: Number.isFinite(id) ? id : undefined }
}

function go(page: Page, id?: number): void {
  window.location.hash = `/${page}${id === undefined ? '' : `/${id}`}`
}

function navigatePath(path: string): void {
  window.location.hash = `/${path}`
}

function labelMeta(dict: Record<string, { label: string; tone: string }>, key: string) {
  return dict[key] ?? { label: key, tone: 'gray' }
}

function downloadCsv(rows: Array<Array<string | number>>, filename: string): void {
  const body = rows.map((cells) => cells.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

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
  components: {
    Table: { headerBg: '#fafafa', headerColor: '#595959', borderColor: '#f0f0f0', rowHoverBg: '#f0f9f1' },
    Card: { headerFontSize: 15 },
  },
}

const tablePagination = {
  defaultPageSize: 20,
  showSizeChanger: true,
  showQuickJumper: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total: number) => `共 ${total} 条`,
}

const landingPath = window.location.port === '5196' ? '/#/dashboard' : '/service-ops/#/dashboard'
const baseUrl = import.meta.env.BASE_URL
const userPortalUrl = `${window.location.protocol}//${window.location.hostname}:8105/`

const isFullAdmin = computed(() =>
  ['*', 'service:*', 'service:admin'].some((code) => serviceSession.permissions.includes(code)),
)
const displayName = computed(() => serviceSession.user?.nickname || serviceSession.user?.username || '平台用户')

const route = ref<RouteState>(parseRoute())
const collapsed = ref(window.innerWidth < 1280)
const topKeyword = ref('')
const submitting = ref(false)

const todayText = computed(() => {
  const now = new Date()
  const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${weekday}`
})

const activeTabKey = computed(() => (route.value.id === undefined ? route.value.page : `${route.value.page}/${route.value.id}`))
const activeTabLabel = computed(() =>
  route.value.id === undefined ? TITLES[route.value.page] : `${TITLES[route.value.page]} · ${route.value.id}`,
)

// 大盘与待办
const overview = ref<OpsOverview | null>(null)
const pendingTodos = ref<Array<{ title: string; count: number }>>([])
const totalTodoCount = computed(() => pendingTodos.value.reduce((sum, item) => sum + Number(item.count || 0), 0))
const overviewTodosTotal = computed(() => overview.value?.todos.reduce((sum, item) => sum + Number(item.count || 0), 0) ?? 0)
const maxOverviewGmv = computed(() => Math.max(...(overview.value?.trend.map((item) => Number(item.gmv)) ?? [1]), 1))

// 服务商
const providerStatusKeys = ['all', 'pending', 'available', 'restricted', 'frozen', 'removed']
const providerStatusOptions = Object.entries(PROVIDER_STATUS).map(([value, item]) => ({ value, label: item.label }))
const providers = ref<OpsProvider[]>([])
const providerStatus = ref('all')
const providerKeyword = ref('')
const providersLoading = ref(false)
const providerReviewTarget = ref<OpsProvider | null>(null)
const providerReviewStatus = ref('available')
const providerReviewReason = ref('')
const providerBindTarget = ref<OpsProvider | null>(null)
const providerBindMerchantId = ref('')
const providerColumns = [
  { title: '服务商', key: 'name', dataIndex: 'name', width: 280, ellipsis: true },
  { title: '服务类型', key: 'category', dataIndex: 'category', width: 112 },
  { title: '覆盖区域', key: 'region', dataIndex: 'region', width: 170, ellipsis: true },
  { title: '平台主体', key: 'merchantId', dataIndex: 'merchantId', width: 104 },
  { title: '信用分', key: 'creditScore', dataIndex: 'creditScore', width: 92, sorter: (a: OpsProvider, b: OpsProvider) => a.creditScore - b.creditScore },
  { title: '评分', key: 'rating', dataIndex: 'rating', width: 88 },
  { title: '取消率', key: 'cancelRate', dataIndex: 'cancelRate', width: 92 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 100 },
  { title: '操作', key: 'actions', fixed: 'right', width: 180 },
]

// 服务商详情
const providerDetail = ref<OpsProvider | null>(null)
const detailStatusOpen = ref(false)
const detailNextStatus = ref('available')
const detailReason = ref('')
const providerDetailItemColumns = [
  { title: '服务项目', key: 'name', dataIndex: 'name' },
  { title: '价格', key: 'price' },
  { title: '审核', key: 'auditStatus', dataIndex: 'auditStatus' },
  { title: 'AI 预检', key: 'aiScore', dataIndex: 'aiScore' },
  { title: '近 30 天', key: 'selectedCount', dataIndex: 'selectedCount' },
]

// 商品审核
const catalogTabs = [
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已上架' },
  { key: 'rejected', label: '已驳回' },
  { key: 'all', label: '全部' },
]
const catalogResultOptions = [
  { value: 'approved', label: '通过上架' },
  { value: 'rejected', label: '驳回或退回补件' },
]
const catalogItems = ref<ServiceItem[]>([])
const catalogTab = ref('pending')
const catalogTarget = ref<ServiceItem | null>(null)
const catalogResult = ref('approved')
const catalogReason = ref('')
const catalogColumns = [
  { title: '服务商品', key: 'name', dataIndex: 'name' },
  { title: '品类', key: 'category', dataIndex: 'category' },
  { title: '指导价格', key: 'price' },
  { title: 'AI 预检', key: 'aiScore', dataIndex: 'aiScore' },
  { title: '审核状态', key: 'auditStatus', dataIndex: 'auditStatus' },
  { title: '说明', key: 'auditReason', dataIndex: 'auditReason', ellipsis: true },
  { title: '操作', key: 'action' },
]

// 订单 & 调度
const orderStatusKeys = ['all', 'confirmed', 'in_progress', 'completed', 'cancelled']
const orders = ref<OpsOrder[]>([])
const availableProviders = ref<OpsProvider[]>([])
const orderStatus = ref('all')
const orderKeyword = ref('')
const orderDispatchTarget = ref<OpsOrder | null>(null)
const orderDispatchProviderId = ref<number | undefined>(undefined)
const orderDispatchNote = ref('')
const availableProviderOptions = computed(() =>
  availableProviders.value.map((p) => ({ value: p.id, label: `${p.name} · ${p.category} · ★${p.rating}` })),
)
const dispatchProviderOptions = computed(() =>
  availableProviders.value.map((p) => ({ value: p.id, label: `${p.name} · 信用 ${p.creditScore} · ★${p.rating}` })),
)
const orderColumns = [
  { title: '订单', key: 'orderNo', dataIndex: 'orderNo' },
  { title: '服务商', key: 'providerName', dataIndex: 'providerName' },
  { title: '服务地点', key: 'location', dataIndex: 'location', ellipsis: true },
  { title: '预约时间', key: 'appointmentDate', dataIndex: 'appointmentDate' },
  { title: '金额', key: 'totalAmount', dataIndex: 'totalAmount' },
  { title: '履约', key: 'status', dataIndex: 'status' },
  { title: '风险', key: 'riskFlag', dataIndex: 'riskFlag' },
  { title: '操作', key: 'action', fixed: 'right' },
]
const dispatchDemands = ref<DispatchDemand[]>([])
const dispatchOrders = ref<OpsOrder[]>([])
const demandTarget = ref<DispatchDemand | null>(null)
const demandProviderId = ref<number | undefined>(undefined)

// 投诉 & 质量预警
const complaints = ref<Complaint[]>([])
const disputeTarget = ref<Complaint | null>(null)
const disputeResolution = ref('')
const qualityAlerts = ref<QualityAlert[]>([])
const qualityTarget = ref<QualityAlert | null>(null)
const qualityNote = ref('')

// 政策项目
const policies = ref<PolicyApplication[]>([])
const policyTarget = ref<PolicyApplication | null>(null)
const policyStatus = ref<string | undefined>(undefined)
const policyNote = ref('')
const policySaving = ref(false)
const policyReady = computed(
  () => Boolean(policyStatus.value && policyTarget.value?.allowedStatuses?.includes(policyStatus.value) && policyNote.value.trim()),
)
const policyAllowedOptions = computed(() =>
  (policyTarget.value?.allowedStatuses ?? []).map((value) => ({ value, label: POLICY_STATUS[value]?.label ?? value })),
)
const policyColumns = [
  { title: '申报单', key: 'applicationNo', dataIndex: 'applicationNo' },
  { title: '申报主体', key: 'applicant', dataIndex: 'applicant' },
  { title: '预计金额', key: 'amountText', dataIndex: 'amountText' },
  { title: '进度', key: 'progress' },
  { title: '状态', key: 'status', dataIndex: 'status' },
  { title: '提交时间', key: 'submittedAt', dataIndex: 'submittedAt' },
  { title: '操作', key: 'action' },
]

// 农险理赔
const claims = ref<InsuranceClaim[]>([])
const claimTarget = ref<InsuranceClaim | null>(null)
const claimStatus = ref('surveying')
const claimNote = ref('')
const claimStatusOptions = [
  ['submitted', '已报案'],
  ['surveying', '查勘中'],
  ['assessing', '定损中'],
  ['publicity', '公示中'],
  ['paid', '已赔付'],
  ['rejected', '已驳回'],
].map(([value, label]) => ({ value, label }))

// 结算
const settlements = ref<Settlement[]>([])
const settlementTarget = ref<Settlement | null>(null)
const settlementNote = ref('')
const settlementColumns = [
  { title: '批次', key: 'batchNo', dataIndex: 'batchNo' },
  { title: '订单数', key: 'orderCount', dataIndex: 'orderCount' },
  { title: '交易金额', key: 'amount', dataIndex: 'amount' },
  { title: '平台佣金', key: 'commission', dataIndex: 'commission' },
  { title: '状态', key: 'status', dataIndex: 'status' },
  { title: '复核人', key: 'reviewedBy' },
  { title: '操作', key: 'action' },
]

// AI 策略、营销、报表、团队、日志
const strategies = ref<Strategy[]>([])
const editingStrategy = ref<Strategy | null>(null)
const strategyValue = ref('')
const campaigns = ref<Campaign[]>([])
const reportData = ref<Awaited<ReturnType<typeof opsApi.report>> | null>(null)
const maxCategoryGmv = computed(() => Math.max(...(reportData.value?.categories.map((i) => Number(i.gmv)) ?? [1]), 1))
const reportProviderColumns = [
  { title: '服务商', key: 'name', dataIndex: 'name' },
  { title: '品类', key: 'category', dataIndex: 'category' },
  { title: '订单数', key: 'orderCount', dataIndex: 'orderCount' },
  { title: '评分', key: 'rating', dataIndex: 'rating' },
  { title: '信用分', key: 'creditScore', dataIndex: 'creditScore' },
  { title: '取消率', key: 'cancelRate', dataIndex: 'cancelRate' },
]
const teamMembers = ref<TeamMember[]>([])
const teamIdentity = ref<{ operatorName?: string; operatorRole?: string } | null>(null)
const logs = ref<OpLog[]>([])
const logColumns = [
  { title: '时间', key: 'createdAt', dataIndex: 'createdAt' },
  { title: '操作人', key: 'operator' },
  { title: '动作', key: 'action', dataIndex: 'action' },
  { title: '对象', key: 'target', dataIndex: 'target' },
  { title: '说明', key: 'detail', dataIndex: 'detail', ellipsis: true },
  { title: '来源 IP', key: 'ip', dataIndex: 'ip' },
]

function handleLogout() {
  void logoutUnified('service-ops')
}

function handleUserMenu({ key }: { key: string | number }) {
  if (key === 'team') go('team')
  else if (key === 'logs') go('logs')
  else if (key === 'logout') handleLogout()
}

function submitTopSearch() {
  if (topKeyword.value.trim()) go('providers')
}

async function loadProviders() {
  providersLoading.value = true
  try {
    providers.value = await opsApi.providers({
      status: providerStatus.value === 'all' ? undefined : providerStatus.value,
      keyword: providerKeyword.value || undefined,
    })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    providersLoading.value = false
  }
}
function changeProviderStatus(key: string) {
  providerStatus.value = key
  void loadProviders()
}
function openProviderReview(p: OpsProvider) {
  providerReviewTarget.value = p
  providerReviewStatus.value = p.status === 'pending' ? 'available' : p.status === 'available' ? 'restricted' : 'available'
  providerReviewReason.value = ''
}
async function submitProviderReview() {
  if (!providerReviewTarget.value) return
  if (!providerReviewReason.value.trim()) {
    message.warning('请填写审核意见或处置原因')
    return
  }
  submitting.value = true
  try {
    await opsApi.reviewProvider(providerReviewTarget.value.id, { status: providerReviewStatus.value, reason: providerReviewReason.value })
    providerReviewTarget.value = null
    message.success('审核结果已保存并写入审计日志')
    await loadProviders()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '审核失败')
  } finally {
    submitting.value = false
  }
}
function openProviderBinding(p: OpsProvider) {
  providerBindTarget.value = p
  providerBindMerchantId.value = p.merchantId ?? ''
}
async function submitProviderBinding() {
  if (!providerBindTarget.value) return
  submitting.value = true
  try {
    const updated = await opsApi.bindMerchant(providerBindTarget.value.id, providerBindMerchantId.value.trim())
    providerBindTarget.value = null
    message.success(
      updated.merchantId
        ? `「${updated.name}」已绑定经营主体 ${updated.merchantId}`
        : `「${updated.name}」已解除主体绑定，其账号将无法进入服务商工作台`,
    )
    await loadProviders()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '绑定失败')
  } finally {
    submitting.value = false
  }
}
function exportProvidersCsv() {
  if (!providers.value.length) {
    message.warning('当前筛选结果为空，没有可导出的名录')
    return
  }
  downloadCsv(
    [
      ['服务商编号', '名称', '服务类型', '覆盖区域', '信用分', '评分', '取消率', '状态', '平台主体号'],
      ...providers.value.map((r) => [
        `SV${r.id}`,
        r.name,
        r.category,
        r.region,
        String(r.creditScore),
        String(r.rating),
        String(r.cancelRate),
        PROVIDER_STATUS[r.status]?.label ?? r.status,
        r.merchantId ?? '未绑定',
      ]),
    ],
    `service-providers-${todayStamp()}.csv`,
  )
  message.success(`已导出当前 ${providers.value.length} 条服务商名录`)
}

function openDetailStatusModal() {
  if (!providerDetail.value) return
  detailNextStatus.value = providerDetail.value.status === 'available' ? 'restricted' : 'available'
  detailReason.value = ''
  detailStatusOpen.value = true
}
async function submitDetailStatus() {
  if (!providerDetail.value) return
  if (!detailReason.value.trim()) {
    message.warning('请填写处置原因')
    return
  }
  try {
    await opsApi.reviewProvider(providerDetail.value.id, { status: detailNextStatus.value, reason: detailReason.value })
    detailStatusOpen.value = false
    message.success('处置已生效，操作人记为当前登录账号')
    providerDetail.value = await opsApi.provider(providerDetail.value.id)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function loadCatalog() {
  try {
    catalogItems.value = await opsApi.serviceItems({ auditStatus: catalogTab.value === 'all' ? undefined : catalogTab.value })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}
function changeCatalogTab(key: string) {
  catalogTab.value = key
  void loadCatalog()
}
function openCatalogReview(row: ServiceItem) {
  catalogTarget.value = row
  catalogResult.value = row.aiScore >= 75 ? 'approved' : 'rejected'
  catalogReason.value = ''
}
async function submitCatalogReview() {
  if (!catalogTarget.value) return
  if (!catalogReason.value.trim()) {
    message.warning('请填写审核意见，驳回时要说清缺什么')
    return
  }
  try {
    await opsApi.reviewServiceItem(catalogTarget.value.id, { auditStatus: catalogResult.value, reason: catalogReason.value })
    catalogTarget.value = null
    message.success('审核结果已保存')
    await loadCatalog()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '审核失败')
  }
}
function exportCatalogCsv() {
  if (!catalogItems.value.length) {
    message.warning('当前筛选结果为空')
    return
  }
  downloadCsv(
    [
      ['商品编号', '服务商品', '服务商', '品类', '价格', '单位', 'AI 预检分', '审核状态', '审核说明'],
      ...catalogItems.value.map((r) => [
        `ITEM${r.id}`,
        r.name,
        r.providerName,
        r.category,
        String(r.price),
        r.unit,
        String(r.aiScore),
        r.auditStatus,
        r.auditReason,
      ]),
    ],
    `service-items-${catalogTab.value}-${todayStamp()}.csv`,
  )
  message.success(`已导出当前 ${catalogItems.value.length} 条商品`)
}

async function loadOrders() {
  try {
    orders.value = await opsApi.orders({
      status: orderStatus.value === 'all' ? undefined : orderStatus.value,
      keyword: orderKeyword.value || undefined,
    })
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载订单失败')
  }
}
function changeOrderStatus(k: string) {
  orderStatus.value = k
  void loadOrders()
}
function openOrderDispatch(row: OpsOrder) {
  orderDispatchTarget.value = row
  orderDispatchProviderId.value = undefined
  orderDispatchNote.value = ''
}
async function submitOrderDispatch() {
  if (!orderDispatchTarget.value || !orderDispatchProviderId.value) {
    message.warning('请点名目标服务商')
    return
  }
  if (!orderDispatchNote.value.trim()) {
    message.warning('请填写派单说明')
    return
  }
  try {
    await opsApi.dispatchOrder(orderDispatchTarget.value.id, orderDispatchProviderId.value, orderDispatchNote.value)
    orderDispatchTarget.value = null
    message.success('订单已改派并写入审计日志')
    await loadOrders()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '派单失败')
  }
}

async function loadDispatch() {
  try {
    const [d, p, o] = await Promise.all([
      opsApi.dispatchDemands(),
      opsApi.providers({ status: 'available' }),
      opsApi.orders({ status: 'confirmed' }),
    ])
    dispatchDemands.value = d
    availableProviders.value = p
    dispatchOrders.value = o
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载调度数据失败')
  }
}
function openAssignDemand(demand: DispatchDemand) {
  demandTarget.value = demand
  demandProviderId.value = availableProviders.value[0]?.id
}
async function submitAssignDemand() {
  if (!demandTarget.value || !demandProviderId.value) {
    message.warning('请选择服务商')
    return
  }
  try {
    await opsApi.assignDemand(demandTarget.value.id, demandProviderId.value)
    demandTarget.value = null
    message.success('需求已指派并生成订单')
    await loadDispatch()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '指派失败')
  }
}

function openDisputeResolve(item: Complaint) {
  disputeTarget.value = item
  disputeResolution.value = ''
}
async function submitDisputeResolve() {
  if (!disputeTarget.value) return
  if (!disputeResolution.value.trim()) {
    message.warning('请填写处理结论，这段文字会原样通知投诉方')
    return
  }
  submitting.value = true
  try {
    await opsApi.resolveComplaint(disputeTarget.value.id, { status: 'resolved', resolution: disputeResolution.value })
    disputeTarget.value = null
    message.success('投诉已办结，处理人取当前登录账号')
    complaints.value = await opsApi.complaints()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '处理失败')
  } finally {
    submitting.value = false
  }
}

function openQualityResolve(item: QualityAlert) {
  qualityTarget.value = item
  qualityNote.value = ''
}
async function submitQualityResolve() {
  if (!qualityTarget.value) return
  if (!qualityNote.value.trim()) {
    message.warning('请填写复核结论，关闭预警要留下依据')
    return
  }
  try {
    await opsApi.resolveAlert(qualityTarget.value.id, qualityNote.value)
    qualityTarget.value = null
    message.success('预警已关闭，结论已写入审计日志')
    qualityAlerts.value = await opsApi.alerts()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '处理失败')
  }
}

function openPolicyReview(row: PolicyApplication) {
  policyTarget.value = row
  policyStatus.value = undefined
  policyNote.value = ''
}
async function submitPolicyReview() {
  if (!policyTarget.value || !policyReady.value || policySaving.value) return
  policySaving.value = true
  try {
    await opsApi.reviewPolicy(policyTarget.value.id, {
      status: policyStatus.value,
      expectedStatus: policyTarget.value.status,
      note: policyNote.value.trim(),
    })
    policyTarget.value = null
    message.success('政策审核节点已更新')
    policies.value = await opsApi.policies()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '审核失败')
    policies.value = await opsApi.policies().catch(() => policies.value)
  } finally {
    policySaving.value = false
  }
}

function openClaimReview(claim: InsuranceClaim) {
  claimTarget.value = claim
  claimStatus.value = 'assessing'
  claimNote.value = '查勘完成，进入定损核算'
}
async function submitClaimReview() {
  if (!claimTarget.value) return
  try {
    await opsApi.reviewClaim(claimTarget.value.id, { status: claimStatus.value, note: claimNote.value })
    claimTarget.value = null
    message.success('理赔节点已更新')
    claims.value = await opsApi.claims()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '更新失败')
  }
}
function exportClaimsCsv() {
  if (!claims.value.length) {
    message.warning('当前没有理赔案件')
    return
  }
  downloadCsv(
    [
      ['案件号', '保单号', '灾害类型', '受灾面积', '状态', '进度', '报案时间', '说明'],
      ...claims.value.map((r) => [r.claimNo, r.policyNo, r.disasterType, r.lossArea, r.status, `${r.progress}%`, r.createdAt, r.description]),
    ],
    `insurance-claims-${todayStamp()}.csv`,
  )
  message.success(`已导出 ${claims.value.length} 条理赔案件`)
}

async function loadSettlements() {
  try {
    settlements.value = await opsApi.settlements()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载结算失败')
  }
}
function openSettlementReview(row: Settlement) {
  settlementTarget.value = row
  settlementNote.value = ''
}
async function submitSettlementReview() {
  if (!settlementTarget.value) return
  if (!settlementNote.value.trim()) {
    message.warning('请填写复核说明，复核结论要能追溯到依据')
    return
  }
  submitting.value = true
  try {
    await opsApi.reviewSettlement(settlementTarget.value.id, { status: 'approved', note: settlementNote.value })
    settlementTarget.value = null
    message.success('批次复核已保存，复核人记为当前登录账号')
    await loadSettlements()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '复核失败')
  } finally {
    submitting.value = false
  }
}

function openEditStrategy(item: Strategy) {
  editingStrategy.value = item
  strategyValue.value = item.value
}
async function submitEditStrategy() {
  if (!editingStrategy.value) return
  try {
    strategies.value = await opsApi.updateStrategy(editingStrategy.value.key, strategyValue.value)
    editingStrategy.value = null
    message.success('策略参数已发布')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '发布失败')
  }
}

async function loadCampaigns() {
  try {
    campaigns.value = await opsApi.campaigns()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载活动失败')
  }
}
async function toggleCampaign(item: Campaign) {
  const next = item.status === 'running' ? 'paused' : 'running'
  try {
    await opsApi.updateCampaign(item.id, next)
    message.success(next === 'running' ? '活动已恢复' : '活动已暂停')
    await loadCampaigns()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '操作失败')
  }
}

function exportReportCsv() {
  if (!reportData.value) return
  downloadCsv(
    [
      ['品类', '订单数', 'GMV', '平均评分'],
      ...reportData.value.categories.map((i) => [i.category, String(i.orderCount), String(i.gmv), String(i.avgRating)]),
      ['日期', '订单', 'GMV', '服务商数', '投诉数'],
      ...reportData.value.trend.map((i) => [i.date, String(i.orders), String(i.gmv), String(i.providers), String(i.complaints)]),
    ],
    `service-report-${todayStamp()}.csv`,
  )
  message.success(`已导出 ${reportData.value.categories.length} 个品类与 ${reportData.value.trend.length} 天趋势`)
}

function exportLogsCsv() {
  if (!logs.value.length) {
    message.warning('暂无审计日志可导出')
    return
  }
  downloadCsv(
    [
      ['时间', '操作人', '角色', '动作', '对象', '说明', '来源IP'],
      ...logs.value.map((r) => [r.createdAt, r.operator, r.role, r.action, r.target, r.detail, r.ip]),
    ],
    `service-op-log-${todayStamp()}.csv`,
  )
  message.success(`已导出 ${logs.value.length} 条审计日志`)
}

async function loadCurrentPage() {
  if (!serviceSession.user) return
  if (!isFullAdmin.value) {
    policies.value = await opsApi.policies().catch(() => [])
    return
  }
  opsApi.overview().then((d) => { pendingTodos.value = d.todos }).catch(() => { pendingTodos.value = [] })

  const { page, id } = route.value
  try {
    if (page === 'dashboard') {
      overview.value = await opsApi.overview()
    } else if (page === 'providers') {
      await loadProviders()
    } else if (page === 'provider-detail' && id) {
      providerDetail.value = await opsApi.provider(id)
    } else if (page === 'catalog') {
      await loadCatalog()
    } else if (page === 'orders') {
      const [, p] = await Promise.all([loadOrders(), opsApi.providers({ status: 'available' }).catch(() => [])])
      availableProviders.value = p
    } else if (page === 'dispatch') {
      await loadDispatch()
    } else if (page === 'disputes') {
      complaints.value = await opsApi.complaints()
    } else if (page === 'quality') {
      qualityAlerts.value = await opsApi.alerts()
    } else if (page === 'policies') {
      policies.value = await opsApi.policies()
    } else if (page === 'insurance') {
      claims.value = await opsApi.claims()
    } else if (page === 'settlement') {
      await loadSettlements()
    } else if (page === 'ai') {
      strategies.value = await opsApi.strategies()
    } else if (page === 'campaigns') {
      await loadCampaigns()
    } else if (page === 'reports') {
      reportData.value = await opsApi.report()
    } else if (page === 'team') {
      const [t, idInfo] = await Promise.all([opsApi.team(), opsApi.identity().catch(() => null)])
      teamMembers.value = t
      teamIdentity.value = idInfo
    } else if (page === 'logs') {
      logs.value = await opsApi.logs()
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载失败')
  }
}

const syncLayout = () => { collapsed.value = window.innerWidth < 1280 }
const onHashChange = () => {
  route.value = parseRoute()
  window.scrollTo({ top: 0 })
}

watch(
  () => [serviceSession.user, route.value.page, route.value.id] as const,
  ([user]) => {
    if (user) void loadCurrentPage()
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
