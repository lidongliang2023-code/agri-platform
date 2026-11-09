

export interface CertificationRecord { status: string; reviewRemark?: string | null; submitTime?: string | null }
export interface CertificationMerchant {
  merchantId: string; merchantName: string | null; memberType: string | null;
  verifyStatus: string | null; verifyRemark?: string | null; roleInMerchant: string;
  certification: CertificationRecord | null
}
export interface CertificationSummary {
  realName: CertificationRecord | null; activeMerchantId: string | null; merchants: CertificationMerchant[]
}
export const certificationStatus = (value?: string | null): { label: string; tone: string } => {
  if (value === 'approved' || value === 'verified') return { label: '已认证', tone: 'success' }
  if (value === 'pending') return { label: '审核中', tone: 'pending' }
  if (value === 'rejected') return { label: '已驳回', tone: 'danger' }
  if (value === 'draft') return { label: '草稿待完善', tone: 'neutral' }
  if (!value || value === 'unverified') return { label: '未认证', tone: 'neutral' }
  return { label: '状态待确认', tone: 'neutral' }
}
export class CertificationLoginRequired extends Error {}
export async function loadCertificationSummary(signal: AbortSignal): Promise<CertificationSummary> {
  const response = await fetch('/api/v1/sso/account/summary', { credentials: 'include', signal })
  if (response.status === 401) throw new CertificationLoginRequired('请登录统一账号后查看')
  if (!response.ok) throw new Error(`认证状态暂时无法读取（HTTP ${response.status}）`)
  let body: { code?: number; message?: string; data?: CertificationSummary }
  try { body = await response.json() as typeof body }
  catch { throw new Error('认证服务返回异常，请稍后重试或前往账号中心查看') }
  if (body.code === 401) throw new CertificationLoginRequired('请重新登录查看认证状态')
  if (body.code !== 0 || !body.data || !Array.isArray(body.data.merchants)) throw new Error(body.message || '认证状态返回异常，请稍后重试')
  return body.data
}

export const certificationGuides = {
  personal: {
    title: '个人实名认证', badge: 'PERSONAL VERIFICATION', target: '#/account/realname', action: '进入个人实名办理',
    description: '以自然人身份办理实名核验，资料与核验结果统一由账号中心管理。',
    audience: '适用于自然人采购者、农产品经纪人及以个人身份参与平台业务的用户。合作社、公司等经营主体需另行办理企业认证。',
    materials: ['本人真实姓名与有效身份证件', '身份证正反面清晰照片及证件有效期', '本人联系手机号与必要联系资料', '本人配合人脸活体与身份信息核验'],
    steps: ['登录统一账号，进入个人实名', '填写资料并上传本人有效证件', '按页面要求完成人脸活体与身份比对', '提交审核，查看结果并按意见补充'],
    notes: ['本人核验不能由他人替代；不在公开页面展示身份证号或证件照片。', '草稿不等于提交审核；具体可提交条件以账号中心实时校验为准。', '身份认证仅说明主体身份核验状态，具体交易、金融服务仍须满足各业务要求。'],
  },
  enterprise: {
    title: '企业与经营主体认证', badge: 'BUSINESS VERIFICATION', target: '#/account/enterprise', action: '进入经营主体管理',
    description: '面向公司、合作社等经营主体，统一维护资质资料、审核状态与主体成员关系。',
    audience: '适用于公司、农民专业合作社及其他依法登记的经营主体。已加入企业的员工应先确认主体及办理权限，避免重复创建企业。',
    materials: ['企业全称、统一社会信用代码及有效营业执照', '法定代表人信息及页面要求的身份证明材料', '企业联系人和联系方式', '按实际核验要求准备对公账户信息及核验凭证', '经授权的主体管理员账号及补充资质说明'],
    steps: ['登录后创建或加入已有经营主体', '选择对应主体，核对成员身份与操作权限', '补全企业材料及页面要求的核验凭证', '提交认证审核，按审核意见补正并跟踪结果'],
    notes: ['多个经营主体分别认证；个人实名通过不代表企业认证通过。', '企业敏感材料和对公信息仅在登录后的受控页面提交。不要通过公开链接传播。', '平台主体认证不替代行业许可、食品安全许可、绿色认证或金融机构授信。'],
  },
} as const
