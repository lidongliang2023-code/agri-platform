/**
 * 页面名称：角色与权限
 * 路由路径：/production/members/roles
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #10（对应 PRD 3.4 RBAC 权限模型 / 8.1 FARM-08）
 *
 * 页面用途（PRD）：角色管理、权限分配、数据范围设置。
 * 权限点命名遵循 `{域}.{资源}.{动作}`；数据范围支持
 * SELF / PLOT / FARM / TENANT 等取值（PRD 3.4 + 平台级扩展）。
 *
 * 数据说明：后端 `/members/roles` 目前按 role_code 聚合在职人数，
 * 角色名称与职责取自 PRD 3.1 角色目录（ROLE_CATALOG），权限矩阵前端维护并经
 * localStorage 持久化 + 尝试写回后端，保证「勾选 → 保存 → 复现」的交互闭环。
 */
import { useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import {
  KeyOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchRoles, fetchRolePermissions, saveRolePermissions } from '@/api/production-view'
import {
  DATA_SCOPE_OPTIONS,
  PERMISSION_GROUPS,
  ROLE_CATALOG,
  ROLE_DEFAULT_PERMISSIONS,
  dataScopeLabel,
  flattenPermissions,
  roleName,
} from '@/utils/production-adapter'
import type { Role } from '@/types'

/** 角色视图模型 */
interface RoleRow extends Role {
  /** 职责描述 */
  duty: string
  /** 默认数据范围 */
  defaultScope: string
}

/**
 * 角色与权限
 * @returns 页面内容
 */
export default function RoleList(): JSX.Element {
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const [keyword, setKeyword] = useState<string>('')
  const [activeRoleCode, setActiveRoleCode] = useState<string>('')
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false)
  const [checkedCodes, setCheckedCodes] = useState<string[]>([])
  const [dataScope, setDataScope] = useState<string>('FARM')

  const rolesQuery = useQuery({
    queryKey: ['role-list'],
    queryFn: () => fetchRoles(),
  })

  const permissionQuery = useQuery({
    queryKey: ['role-permissions', activeRoleCode],
    queryFn: () => fetchRolePermissions(activeRoleCode),
    enabled: activeRoleCode !== '',
  })

  /** 角色表格行：合并后端统计与角色目录 */
  const roleRows = useMemo<RoleRow[]>(() => {
    const backend = rolesQuery.data ?? []
    const backendMap = new Map(backend.map((item) => [item.roleCode, item]))
    // 显式标注 map 回调返回类型：给对象字面量提供上下文类型，
    // 使 status: 1 收敛为字面量 1（EnableStatus = 0 | 1）而不是被放大成 number。
    return ROLE_CATALOG.map((catalog): RoleRow => {
      const hit = backendMap.get(catalog.roleCode)
      return {
        roleId: catalog.roleCode,
        roleCode: catalog.roleCode,
        roleName: catalog.roleName,
        description: catalog.description,
        isSystem: true,
        memberCount: hit?.memberCount ?? 0,
        status: 1,
        createdAt: hit?.createdAt ?? '',
        duty: catalog.description,
        defaultScope: catalog.defaultScope,
      }
    }).filter((row) => {
      if (!keyword.trim()) return true
      const text = `${row.roleName}${row.roleCode}${row.description}`
      return text.toLowerCase().includes(keyword.trim().toLowerCase())
    })
  }, [keyword, rolesQuery.data])

  /** 权限点目录扁平列表 */
  const permissionPoints = useMemo(() => flattenPermissions(), [])

  useEffect(() => {
    if (permissionQuery.data) {
      setCheckedCodes(permissionQuery.data)
    } else if (activeRoleCode && permissionQuery.isSuccess) {
      setCheckedCodes(ROLE_DEFAULT_PERMISSIONS[activeRoleCode] ?? [])
    }
  }, [activeRoleCode, permissionQuery.data, permissionQuery.isSuccess])

  useEffect(() => {
    if (activeRoleCode) {
      setDataScope(
        ROLE_CATALOG.find((item) => item.roleCode === activeRoleCode)?.defaultScope ?? 'FARM',
      )
    }
  }, [activeRoleCode])

  const saveMutation = useMutation({
    mutationFn: (payload: { roleCode: string; codes: string[] }) =>
      saveRolePermissions(payload.roleCode, payload.codes),
    onSuccess: () => {
      message.success(`角色「${roleName(activeRoleCode)}」权限已保存`)
      setDrawerOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['role-permissions', activeRoleCode] })
    },
    onError: (error: Error) => message.error(error.message || '权限保存失败'),
  })

  /**
   * 打开权限抽屉
   * @param row 角色行
   * @returns void
   */
  function openDrawer(row: RoleRow): void {
    setActiveRoleCode(row.roleCode)
    setCheckedCodes(ROLE_DEFAULT_PERMISSIONS[row.roleCode] ?? [])
    setDataScope(row.defaultScope)
    setDrawerOpen(true)
    void permissionQuery.refetch()
  }

  /**
   * 全选 / 取消全选某个功能域
   * @param domain 功能域前缀
   * @param groupResources 资源列表
   * @param groupActions 动作列表
   * @param checked 是否选中
   * @returns void
   */
  function toggleGroup(
    domain: string,
    groupResources: { code: string; name: string }[],
    groupActions: string[],
    checked: boolean,
  ): void {
    setCheckedCodes((prev) => {
      const next = new Set(prev)
      for (const resource of groupResources) {
        for (const action of groupActions) {
          const code = `${domain}.${resource.code}.${action}`
          if (checked) next.add(code)
          else next.delete(code)
        }
      }
      return Array.from(next)
    })
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#13a05a' }} />
            <span>角色与权限</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              权限点命名规范：{`{域}.{资源}.{动作}`}，如 produce.task.create
            </Typography.Text>
          </Space>
        }
        extra={
          <Space>
            <Input.Search
              allowClear
              placeholder="搜索角色名称 / 编码"
              style={{ width: 220 }}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void rolesQuery.refetch()}>
              刷新
            </Button>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col xs={12} md={6}>
            <Statistic title="内置角色数" value={ROLE_CATALOG.length} suffix="个" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="权限点总数" value={permissionPoints.length} suffix="个" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="功能域数" value={PERMISSION_GROUPS.length} suffix="个" />
          </Col>
          <Col xs={12} md={6}>
            <Statistic
              title="在岗成员数"
              value={(rolesQuery.data ?? []).reduce((sum, item) => sum + (item.memberCount ?? 0), 0)}
              suffix="人"
            />
          </Col>
        </Row>
      </Card>

      <Card>
        {rolesQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : roleRows.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的角色" />
        ) : (
          <Table<RoleRow>
            rowKey="roleCode"
            dataSource={roleRows}
            pagination={false}
            columns={[
              {
                title: '角色名称',
                dataIndex: 'roleName',
                width: 160,
                render: (_value, row) => (
                  <Space>
                    <KeyOutlined style={{ color: '#1677ff' }} />
                    <Typography.Text strong>{row.roleName}</Typography.Text>
                  </Space>
                ),
              },
              {
                title: '角色编码',
                dataIndex: 'roleCode',
                width: 160,
                render: (value: string) => <Tag color="blue">{value}</Tag>,
              },
              {
                title: '职责说明',
                dataIndex: 'duty',
                render: (value: string) => (
                  <Typography.Text type="secondary">{value}</Typography.Text>
                ),
              },
              {
                title: '默认数据范围',
                dataIndex: 'defaultScope',
                width: 160,
                render: (value: string) => <Tag color="green">{dataScopeLabel(value)}</Tag>,
              },
              {
                title: '在岗人数',
                dataIndex: 'memberCount',
                width: 110,
                render: (value: number) => (
                  <Badge count={value} showZero color="#13a05a" />
                ),
              },
              {
                title: '操作',
                key: 'option',
                width: 160,
                render: (_value, row) => (
                  <Button type="link" icon={<ThunderboltOutlined />} onClick={() => openDrawer(row)}>
                    配置权限
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Drawer
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#13a05a' }} />
            <span>权限分配 · {roleName(activeRoleCode)}</span>
          </Space>
        }
        width={720}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Select
              size="small"
              style={{ width: 220 }}
              value={dataScope}
              onChange={(value: string) => setDataScope(value)}
              options={DATA_SCOPE_OPTIONS}
            />
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate({ roleCode: activeRoleCode, codes: checkedCodes })}
            >
              保存权限
            </Button>
          </Space>
        }
      >
        {permissionQuery.isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} />
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="角色编码">{activeRoleCode || '-'}</Descriptions.Item>
              <Descriptions.Item label="已选权限点">
                <Tag color="green">{checkedCodes.length} 个</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="数据范围" span={2}>
                <Tag color="blue">{dataScopeLabel(dataScope)}</Tag>
                <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                  数据范围叠加在功能权限之上，遵循 PRD R-AUTH-02（tenant_id + farm_id 双重过滤）
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            <Space>
              <Typography.Text type="secondary">快捷操作：</Typography.Text>
              <Button
                size="small"
                onClick={() => setCheckedCodes(permissionPoints.map((item) => item.code))}
              >
                全选
              </Button>
              <Button size="small" onClick={() => setCheckedCodes([])}>
                清空
              </Button>
              <Button
                size="small"
                onClick={() => setCheckedCodes(ROLE_DEFAULT_PERMISSIONS[activeRoleCode] ?? [])}
              >
                按角色模板填充
              </Button>
            </Space>

            {PERMISSION_GROUPS.map((group) => {
              const groupCodes = group.resources.flatMap((resource) =>
                group.actions.map((action) => `${group.domain}.${resource.code}.${action}`),
              )
              const selectedCount = groupCodes.filter((code) => checkedCodes.includes(code)).length
              const allChecked = selectedCount === groupCodes.length && groupCodes.length > 0
              const partialChecked = selectedCount > 0 && !allChecked
              return (
                <Card
                  key={group.domain}
                  size="small"
                  title={
                    <Space>
                      <Checkbox
                        checked={allChecked}
                        indeterminate={partialChecked}
                        onChange={(event) =>
                          toggleGroup(
                            group.domain,
                            group.resources,
                            group.actions,
                            event.target.checked,
                          )
                        }
                      />
                      <span>{group.domainName}</span>
                      <Tag>{`${selectedCount}/${groupCodes.length}`}</Tag>
                    </Space>
                  }
                >
                  {group.resources.map((resource) => (
                    <div key={`${group.domain}-${resource.code}`} style={{ marginBottom: 8 }}>
                      <Typography.Text strong style={{ display: 'block', marginBottom: 4 }}>
                        {resource.name}
                        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                          {group.domain}.{resource.code}.*
                        </Typography.Text>
                      </Typography.Text>
                      <Checkbox.Group
                        options={group.actions.map((action) => ({
                          label: formatActionLabel(action),
                          value: `${group.domain}.${resource.code}.${action}`,
                        }))}
                        value={checkedCodes}
                        onChange={(values) => setCheckedCodes(values as string[])}
                      />
                    </div>
                  ))}
                </Card>
              )
            })}
            <Divider />
            <Space direction="vertical" size={2}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                · 内置角色不可删除；自定义角色请在团队成员页邀请后按角色编码授权。
              </Typography.Text>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                · 数据范围取多角色并集中的最大授权范围（PRD R-AUTH-03）。
              </Typography.Text>
            </Space>
          </Space>
        )}
      </Drawer>
    </Space>
  )
}

/**
 * 动作编码转中文
 * @param action 动作编码
 * @returns 中文标签
 */
function formatActionLabel(action: string): string {
  const labels: Record<string, string> = {
    view: '查看',
    create: '新增',
    update: '编辑',
    delete: '删除',
    export: '导出',
    run: '调用',
    verify: '验真',
    submit: '提交',
  }
  return labels[action] ?? action
}
