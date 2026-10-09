/**
 * 页面名称：团队与人员
 * 路由路径：/production/members
 * 所属模块：农场数字化管理
 * PRD 序号：PRD 6.1 #9（对应 PRD 8.1 FARM-07 团队与人员管理）
 *
 * 页面用途（PRD）：人员列表、邀请、停用、岗位配置。
 * 表格使用 ProTable + request 分页；邀请 / 编辑使用 ModalForm；停用需二次确认。
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App as AntdApp, Button, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import {
  ModalForm,
  ProFormDatePicker,
  ProFormSelect,
  ProFormText,
  ProTable,
} from '@ant-design/pro-components'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  EditOutlined,
  IdcardOutlined,
  KeyOutlined,
  PlusOutlined,
  StopOutlined,
  TeamOutlined,
  UnlockOutlined,
} from '@ant-design/icons'
import useFarmStore from '@/store/farm'
import {
  fetchMembers,
  inviteMember,
  removeMember,
  updateMemberInfo,
  updateMemberStatus,
} from '@/api/production-view'
import {
  MEMBER_STATUS_OPTIONS,
  MEMBER_TYPE_META,
  MEMBER_TYPE_OPTIONS,
  ROLE_CATALOG,
  memberStatusMeta,
  memberTypeMeta,
  roleName,
} from '@/utils/production-adapter'
import type { Member } from '@/types'

/** 邀请 / 编辑成员表单值 */
interface MemberFormValue {
  /** 姓名 */
  memberName: string
  /** 手机号 */
  phone: string
  /** 成员类型 */
  memberType: string
  /** 岗位 */
  postName?: string
  /** 角色编码 */
  roleCode?: string
  /** 加入日期 */
  joinDate?: string
  /** 状态 */
  status?: number
}

/**
 * 团队与人员
 * @returns 页面内容
 */
export default function MemberList(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const currentFarm = useFarmStore((state) => state.currentFarm)
  const farmId = currentFarm?.farmId
  const actionRef = useRef<ActionType>(null)
  const [inviteOpen, setInviteOpen] = useState<boolean>(false)
  const [editing, setEditing] = useState<Member | null>(null)

  /**
   * 重载列表
   * @returns void
   */
  async function reload(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: ['member-list'] })
    actionRef.current?.reload()
  }

  const inviteMutation = useMutation({
    mutationFn: (payload: MemberFormValue) =>
      inviteMember({
        memberName: payload.memberName,
        phone: payload.phone,
        memberType: payload.memberType,
        postName: payload.postName,
        roleCode: payload.roleCode,
        farmId,
        joinDate: payload.joinDate,
        status: 2,
      }),
    onSuccess: () => {
      message.success('邀请已发出，成员待激活')
      setInviteOpen(false)
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '邀请失败'),
  })

  const editMutation = useMutation({
    mutationFn: (payload: { memberId: string; value: MemberFormValue }) =>
      updateMemberInfo(payload.memberId, {
        memberName: payload.value.memberName,
        phone: payload.value.phone,
        memberType: payload.value.memberType,
        postName: payload.value.postName,
        roleCode: payload.value.roleCode,
      }),
    onSuccess: () => {
      message.success('成员信息已更新')
      setEditing(null)
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '更新失败'),
  })

  const statusMutation = useMutation({
    mutationFn: (payload: { memberId: string; status: number }) =>
      updateMemberStatus(payload.memberId, payload.status),
    onSuccess: (_data, variables) => {
      message.success(variables.status === 1 ? '成员已启用' : '成员已停用')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '操作失败'),
  })

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: () => {
      message.success('成员已移除')
      void reload()
    },
    onError: (error: Error) => message.error(error.message || '移除失败'),
  })

  /** 角色下拉选项 */
  const roleOptions = useMemo(
    () => ROLE_CATALOG.map((item) => ({ value: item.roleCode, label: item.roleName })),
    [],
  )

  /** 表格列定义 */
  const columns = useMemo<ProColumns<Member>[]>(
    () => [
      {
        title: '姓名',
        dataIndex: 'realName',
        width: 140,
        render: (_dom, entity) => (
          <Space size={6}>
            <IdcardOutlined style={{ color: '#13a05a' }} />
            <Typography.Text strong>{entity.realName}</Typography.Text>
          </Space>
        ),
      },
      {
        title: '手机号',
        dataIndex: 'phone',
        width: 140,
        copyable: true,
      },
      {
        title: '岗位',
        dataIndex: 'position',
        width: 140,
        render: (_dom, entity) => entity.position || '-',
      },
      {
        title: '成员类型',
        dataIndex: 'memberType',
        width: 120,
        hideInSearch: true,
        render: (_dom, entity) => {
          const roleCode = entity.roleIds[0] ?? ''
          const type = MEMBER_TYPE_META[roleCode] ? roleCode : ''
          return type ? (
            <Tag color={memberTypeMeta(type).color}>{memberTypeMeta(type).label}</Tag>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          )
        },
      },
      {
        title: '角色',
        dataIndex: 'roleIds',
        width: 180,
        hideInSearch: true,
        render: (_dom, entity) =>
          entity.roleIds.length > 0 ? (
            <Space size={4} wrap>
              {entity.roleIds.map((code) => (
                <Tag key={code} color="blue">
                  {roleName(code)}
                </Tag>
              ))}
            </Space>
          ) : (
            <Typography.Text type="secondary">未分配</Typography.Text>
          ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 110,
        valueType: 'select',
        valueEnum: MEMBER_STATUS_OPTIONS.reduce<Record<string, { text: string; status: string }>>(
          (acc, item) => {
            acc[String(item.value)] = {
              text: item.label,
              status:
                item.value === 1 ? 'Success' : item.value === 2 ? 'Warning' : 'Default',
            }
            return acc
          },
          {},
        ),
        render: (_dom, entity) => {
          const meta = memberStatusMeta(entity.status)
          return <Tag color={meta.color}>{meta.label}</Tag>
        },
      },
      {
        title: '加入时间',
        dataIndex: 'joinedAt',
        width: 140,
        hideInSearch: true,
        render: (_dom, entity) => entity.joinedAt || '-',
      },
      {
        title: '操作',
        key: 'option',
        width: 220,
        fixed: 'right',
        valueType: 'option',
        render: (_dom, entity) => [
          <Button
            key="edit"
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(entity)}
          >
            编辑岗位
          </Button>,
          entity.status === 0 ? (
            <Popconfirm
              key="enable"
              title="启用成员"
              description={`确认启用「${entity.realName}」？`}
              onConfirm={() => statusMutation.mutate({ memberId: entity.memberId, status: 1 })}
            >
              <Button type="link" size="small" icon={<UnlockOutlined />}>
                启用
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              key="disable"
              title="停用成员"
              description={`确认停用「${entity.realName}」？停用后其账号不可登录，历史作业记录保留。`}
              okButtonProps={{ danger: true }}
              onConfirm={() => statusMutation.mutate({ memberId: entity.memberId, status: 0 })}
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          ),
          <Popconfirm
            key="remove"
            title="移除成员"
            description={`确认移除「${entity.realName}」？`}
            okButtonProps={{ danger: true }}
            onConfirm={() => removeMutation.mutate(entity.memberId)}
          >
            <Button type="link" size="small" danger>
              移除
            </Button>
          </Popconfirm>,
        ],
      },
    ],
    [removeMutation, statusMutation],
  )

  return (
    <>
      <ProTable<Member>
        actionRef={actionRef}
        rowKey="memberId"
        headerTitle={
          <Space>
            <TeamOutlined style={{ color: '#13a05a' }} />
            <span>团队与人员</span>
          </Space>
        }
        columns={columns}
        search={{ labelWidth: 'auto' }}
        toolBarRender={() => [
          <Button
            key="role"
            icon={<KeyOutlined />}
            onClick={() => navigate('/production/members/roles')}
          >
            角色与权限
          </Button>,
          <Button
            key="invite"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setInviteOpen(true)}
          >
            邀请成员
          </Button>,
        ]}
        request={async (params) => {
          const pageNum = params.current ?? 1
          const pageSize = params.pageSize ?? 10
          try {
            const result = await fetchMembers({
              pageNum,
              pageSize,
              keyword: params.realName as string | undefined,
              status: params.status as number | undefined,
              farmId,
            })
            return {
              data: result.list,
              success: true,
              total: result.total,
            }
          } catch (error) {
            message.error((error as Error).message || '成员列表加载失败')
            return { data: [], success: true, total: 0 }
          }
        }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        dateFormatter="string"
        scroll={{ x: 1100 }}
      />

      <ModalForm<MemberFormValue>
        key="invite"
        title={
          <Space>
            <PlusOutlined style={{ color: '#13a05a' }} />
            <span>邀请成员</span>
          </Space>
        }
        open={inviteOpen}
        width={520}
        modalProps={{ destroyOnHidden: true, confirmLoading: inviteMutation.isPending }}
        onOpenChange={setInviteOpen}
        onFinish={async (value) => {
          await inviteMutation.mutateAsync(value)
          return true
        }}
      >
        <ProFormText
          name="memberName"
          label="姓名"
          placeholder="请输入成员姓名"
          rules={[
            { required: true, message: '请输入成员姓名' },
            { min: 2, max: 20, message: '姓名长度需在 2-20 个字符之间' },
          ]}
        />
        <ProFormText
          name="phone"
          label="手机号"
          placeholder="请输入 11 位手机号"
          rules={[
            { required: true, message: '请输入手机号' },
            { pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' },
          ]}
        />
        <ProFormSelect
          name="memberType"
          label="成员类型"
          options={MEMBER_TYPE_OPTIONS}
          rules={[{ required: true, message: '请选择成员类型' }]}
        />
        <ProFormSelect
          name="roleCode"
          label="分配角色"
          options={roleOptions}
          placeholder="请选择角色"
          rules={[{ required: true, message: '请分配角色' }]}
        />
        <ProFormText name="postName" label="岗位" placeholder="如：种植技术员" />
        <ProFormDatePicker name="joinDate" label="加入日期" width="md" />
        <Typography.Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
          邀请提交后成员状态为「待激活」，成员首次登录后可自动转为「在职」。
        </Typography.Paragraph>
      </ModalForm>

      <ModalForm<MemberFormValue>
        key={`edit-${editing?.memberId ?? 'none'}`}
        title={
          <Space>
            <EditOutlined style={{ color: '#13a05a' }} />
            <span>编辑成员岗位</span>
          </Space>
        }
        open={editing !== null}
        width={520}
        initialValues={
          editing
            ? {
                memberName: editing.realName,
                phone: editing.phone,
                postName: editing.position,
                roleCode: editing.roleIds[0],
                memberType: editing.roleIds[0] ?? undefined,
              }
            : undefined
        }
        modalProps={{ destroyOnHidden: true, confirmLoading: editMutation.isPending }}
        onOpenChange={(visible) => {
          if (!visible) setEditing(null)
        }}
        onFinish={async (value) => {
          if (!editing) return false
          await editMutation.mutateAsync({ memberId: editing.memberId, value })
          return true
        }}
      >
        <ProFormText
          name="memberName"
          label="姓名"
          rules={[{ required: true, message: '请输入成员姓名' }]}
        />
        <ProFormText
          name="phone"
          label="手机号"
          rules={[{ pattern: /^1[3-9]\d{9}$/, message: '手机号格式不正确' }]}
        />
        <ProFormText name="postName" label="岗位" placeholder="如：种植技术员、巡检员" />
        <ProFormSelect name="roleCode" label="分配角色" options={roleOptions} />
        <Tooltip title="成员类型与角色保持联动，停用/启用请在列表中操作">
          <ProFormSelect name="memberType" label="成员类型" options={MEMBER_TYPE_OPTIONS} disabled />
        </Tooltip>
      </ModalForm>
    </>
  )
}
