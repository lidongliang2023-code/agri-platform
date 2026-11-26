import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
import { Icon } from '../components/Icon';
import { AccountOverview } from './account/AccountOverview';
import { Authorizations } from './account/Authorizations';
import { Certificates } from './account/Certificates';
import { CrossModule } from './account/CrossModule';
import { Feedback } from './account/Feedback';
import { HelpCenter } from './account/HelpCenter';
import { IdentityApply } from './account/IdentityApply';
import { LoginDevices } from './account/LoginDevices';
import { Messages } from './account/Messages';
import { Mfa } from './account/Mfa';
import { NotificationSettings } from './account/NotificationSettings';
import { OperationLogs } from './account/OperationLogs';
import { Orders } from './account/Orders';
import { PersonalRealname } from './account/PersonalRealname';
import { PrivacyData } from './account/PrivacyData';
import { ThirdPartyBindings } from './account/ThirdPartyBindings';
import { NAV_GROUPS, findNavItem, navProgress } from './account/navModel';
import { childrenOf, displayCityName, loadRegionCatalog, type RegionCatalog } from '@/utils/addressRegion';
import { RolesPermissions } from './account/RolesPermissions';
import { TeamMembers } from './account/TeamMembers';
import './account-center.css';
interface MerchantRow {
  bindingId: string;
  merchantId: string;
  merchantName: string | null;
  merchantCode: string | null;
  memberType: string | null;
  industry: string | null;
  companySize: string | null;
  businessType: string | null;
  creditCode: string | null;
  creditCodeMasked: string | null;
  contactName: string | null;
  contactPhone: string | null;
  address: string | null;
  status: number | null;
  verifyStatus: string | null;
  verifyTime: string | null;
  verifyRemark: string | null;
  roleInMerchant: string;
  certification: {
    id: string;
    certNo: string;
    companyName: string;
    creditCode: string;
    legalPerson: string | null;
    licenseNo: string | null;
    contactName: string;
    contactPhone: string;
    attachNote: string | null;
    businessLicenseUrl: string | null;
    legalPersonIdFrontUrl: string | null;
    legalPersonIdBackUrl: string | null;
    legalPersonFaceUrl: string | null;
    legalPersonFaceStatus: string | null;
    corporateBankName: string | null;
    corporateBankAccount: string | null;
    corporateTransferAmount: string | null;
    corporateTransferReference: string | null;
    corporateTransferProofUrl: string | null;
    corporateTransferStatus: string | null;
    registeredCapital: string | null;
    verificationChannel: string | null;
    status: string;
    submitTime: string;
    reviewer: string | null;
    reviewTime: string | null;
    reviewRemark: string | null;
  } | null;
}
interface AddressRow {
  id: string;
  receiverName: string;
  contactPhone: string;
  province: string;
  city: string;
  district: string | null;
  detailAddress: string;
  postalCode: string | null;
  isDefault: number;
}
interface JoinRow {
  id: string;
  merchantId: string;
  merchantName: string | null;
  applicantName: string;
  requestedRole: string;
  message: string | null;
  status: string;
  createdAt: string;
  reviewRemark: string | null;
}
interface Summary {
  userId: string;
  username: string;
  nickname: string;
  phone: string;
  email: string | null;
  status: number;
  createdAt: string;
  realName: {
    identityNo: string;
    realName: string;
    idNoMasked: string;
    validStart: string | null;
    validEnd: string | null;
    contactPhone: string | null;
    address: string | null;
    businessType: string | null;
    email: string | null;
    policeVerified: boolean;
    livenessVerified: boolean;
    verificationChannel: string | null;
    policeVerifiedAt: string | null;
    livenessVerifiedAt: string | null;
    status: string;
    submitTime: string;
    reviewRemark: string | null;
  } | null;
  activeMerchantId: string | null;
  merchants: MerchantRow[];
  addresses: AddressRow[];
  sentJoinRequests: JoinRow[];
  reviewInbox: JoinRow[];
}
interface BusinessResult {
  merchantId: string;
  name: string;
  type: string;
  memberType: string | null;
  industry: string | null;
  verifyStatus: string | null;
  creditCodeMasked: string | null;
  alreadyJoined: boolean;
}
type Tab = 'overview' | 'messages' | 'devices' | 'bindings' | 'notification' | 'logs' | 'certificates' | 'realname' | 'feedback' | 'privacy' | 'crossModule' | 'orders' | 'help' | 'authorizations' | 'mfa' | 'profile' | 'security' | 'addresses' | 'enterprise' | 'org' | 'team' | 'roles';
type SecurityPage = 'password' | 'phone';

/**
 * 视图元数据（标题/描述用）。
 *
 * <p>注意：**侧栏菜单不从这里生成** —— 侧栏按原型 IA 走 {@link NAV_GROUPS}
 * （7 个分组 23 个条目，见 `pages/account/navModel.ts`）。这里只保留
 * 内容区标题需要的文案，两者不是一回事。</p>
 */
const TABS: {
  key: Tab;
  label: string;
  icon: string;
  description: string;
}[] = [{
  key: 'overview',
  label: '账号总览',
  icon: 'home',
  description: '账号、实名、身份、待办与安全状况一览'
}, {
  key: 'messages',
  label: '消息中心',
  icon: 'bell',
  description: '站内通知：加入申请、审核结果等'
}, {
  key: 'devices',
  label: '登录设备',
  icon: 'cpu',
  description: '查看并下线当前账号的登录会话'
}, {
  key: 'bindings',
  label: '第三方绑定',
  icon: 'globe',
  description: '登记微信 / 支付宝 / 钉钉账号标识'
}, {
  key: 'notification',
  label: '通知设置',
  icon: 'settings',
  description: '配置通知类型、免打扰时段与推送频率'
}, {
  key: 'logs',
  label: '操作日志',
  icon: 'clipboard',
  description: '查看本人最近的操作记录'
}, {
  key: 'certificates',
  label: '资质证照',
  icon: 'file',
  description: '维护主体资质证照与到期预警'
}, {
  key: 'realname',
  label: '个人实名',
  icon: 'user',
  description: '身份证资料、人脸活体与公安二要素核验'
}, {
  key: 'feedback',
  label: '意见反馈',
  icon: 'clipboard',
  description: '提交建议或问题，查看平台回复'
}, {
  key: 'privacy',
  label: '隐私与数据',
  icon: 'file',
  description: '数据导出、账号注销申请与第三方授权撤回'
}, {
  key: 'crossModule',
  label: '跨模块入口',
  icon: 'globe',
  description: '各子系统入口与前置条件一览'
}, {
  key: 'orders',
  label: '订单聚合',
  icon: 'cart',
  description: '跨域订单统一视图（当前接入交易域）'
}, {
  key: 'help',
  label: '帮助中心',
  icon: 'alert',
  description: '常见问题与可查阅的资料'
}, {
  key: 'authorizations',
  label: '授权管理',
  icon: 'layers',
  description: '谁在代表我访问平台：渠道、会话、身份、主体'
}, {
  key: 'mfa',
  label: '二次验证',
  icon: 'check',
  description: '用手机验证器作为密码之外的第二道验证'
}, {
  key: 'profile',
  label: '账号资料',
  icon: 'user',
  description: '维护昵称、邮箱与账号概况'
}, {
  key: 'security',
  label: '账号安全',
  icon: 'shield',
  description: '修改密码与绑定手机号'
}, {
  key: 'addresses',
  label: '地址管理',
  icon: 'location',
  description: '维护收货地址与默认地址'
}, {
  key: 'enterprise',
  label: '企业实名',
  icon: 'award',
  description: '主体认证状态、材料与提交审核'
}, {
  key: 'org',
  label: '我的组织',
  icon: 'factory',
  description: '经营主体、主体切换与加入申请'
}, {
  key: 'team',
  label: '成员管理',
  icon: 'users',
  description: '管理当前主体的团队成员'
}, {
  key: 'roles',
  label: '我的角色与权限',
  icon: 'shield',
  description: '配置当前主体的角色与权限'
}];
const ACCOUNT_TAB_KEYS: Tab[] = ['overview', 'messages', 'devices', 'bindings', 'notification', 'logs', 'certificates', 'realname', 'feedback', 'privacy', 'crossModule', 'orders', 'help', 'authorizations', 'mfa', 'profile', 'security', 'addresses', 'enterprise', 'org', 'team', 'roles'];
function normalizeAccountTab(value: string | null | undefined): Tab {
  // 旧的「身份与认证」页已拆成企业实名 + 我的组织，老链接回落到我的组织；
  // 「身份申请」已并入我的组织，旧链接同样回落
  if (value === 'business' || value === 'identityApply') return 'org';
  return ACCOUNT_TAB_KEYS.includes(value as Tab) ? value as Tab : 'overview';
}
function normalizeSecurityPage(value: string | null | undefined): SecurityPage {
  return value === 'security/phone' ? 'phone' : 'password';
}
const INDUSTRIES = ['粮油产业', '果蔬产业', '畜禽产业', '茶药产业', '饲料农资', '水产产业', '流通贸易', '加工制造', '其他'];
const COMPANY_SIZES = ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）'];
const BUSINESS_TYPES = ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他'];
const emptyAddress = {
  receiverName: '',
  contactPhone: '',
  province: '',
  city: '',
  district: '',
  detailAddress: '',
  postalCode: '',
  isDefault: false
};
async function api<T>(path: string, init?: RequestInit): Promise<{
  code: number;
  message?: string;
  data?: T;
}> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
  return (await response.json()) as {
    code: number;
    message?: string;
    data?: T;
  };
}
function statusText(value: string | null | undefined): string {
  return ({
    approved: '已认证',
    verified: '已认证',
    pending: '审核中',
    rejected: '已驳回',
    unverified: '未认证',
    draft: '草稿'
  } as Record<string, string>)[value ?? ''] ?? '未开通';
}
function tone(value: string | null | undefined): string {
  if (value === 'approved' || value === 'verified') return 'green';
  if (value === 'pending') return 'amber';
  if (value === 'rejected') return 'red';
  return 'ghost';
}
export const AccountCenter = defineComponent({
  name: "AccountCenter",
  props: {
    initialTab: null as unknown as PropType<{
      initialTab?: string | null;
    }["initialTab"]>
  },
  setup(__props: {
    initialTab?: string | null;
  }, {
    slots: __slots
  }) {
    const initialProfileEdit = computed(() => __props.initialTab === 'profile/edit');
    const initialSecurityPage = computed(() => normalizeSecurityPage(__props.initialTab));
    const tab = ref<Tab>((() => normalizeAccountTab(__props.initialTab))());
    const setTab = (next: typeof tab.value | ((previous: typeof tab.value) => typeof tab.value)) => {
      tab.value = typeof next === 'function' ? (next as (previous: typeof tab.value) => typeof tab.value)(tab.value) : next;
    };
    const profileEditing = ref(initialProfileEdit.value);
    const setProfileEditing = (next: typeof profileEditing.value | ((previous: typeof profileEditing.value) => typeof profileEditing.value)) => {
      profileEditing.value = typeof next === 'function' ? (next as (previous: typeof profileEditing.value) => typeof profileEditing.value)(profileEditing.value) : next;
    };
    const securityPage = ref<SecurityPage>(initialSecurityPage.value);
    /**
     * 当前点开的"待接入"菜单项。
     * 侧栏共 23 个条目，后端只支持其中一部分；点未接入的项时用它切到说明面板，
     * 而不是留在上一个 tab 让用户以为点错了。
     */
    const setSecurityPage = (next: typeof securityPage.value | ((previous: typeof securityPage.value) => typeof securityPage.value)) => {
      securityPage.value = typeof next === 'function' ? (next as (previous: typeof securityPage.value) => typeof securityPage.value)(securityPage.value) : next;
    };
    const pendingKey = ref<string | null>(null);
    /**
     * 安全子页（修改密码 / 变更手机号）的展开态。
     * 侧栏改成原型 IA 后不再需要它控制展开，但 openTab/openSecurity 仍在用它复位，
     * 所以保留 setter、丢掉未使用的读取值。
     */
    const setPendingKey = (next: typeof pendingKey.value | ((previous: typeof pendingKey.value) => typeof pendingKey.value)) => {
      pendingKey.value = typeof next === 'function' ? (next as (previous: typeof pendingKey.value) => typeof pendingKey.value)(pendingKey.value) : next;
    };
    const _unusedState = ref(Boolean(__props.initialTab?.startsWith('security')));
    const setSecurityMenuOpen = (next: typeof _unusedState.value | ((previous: typeof _unusedState.value) => typeof _unusedState.value)) => {
      _unusedState.value = typeof next === 'function' ? (next as (previous: typeof _unusedState.value) => typeof _unusedState.value)(_unusedState.value) : next;
    };
    const summary = ref<Summary | null>(null);
    const setSummary = (next: typeof summary.value | ((previous: typeof summary.value) => typeof summary.value)) => {
      summary.value = typeof next === 'function' ? (next as (previous: typeof summary.value) => typeof summary.value)(summary.value) : next;
    };
    const realnameFormSignal = ref(0);
    const setRealnameFormSignal = (next: typeof realnameFormSignal.value | ((previous: typeof realnameFormSignal.value) => typeof realnameFormSignal.value)) => {
      realnameFormSignal.value = typeof next === 'function' ? (next as (previous: typeof realnameFormSignal.value) => typeof realnameFormSignal.value)(realnameFormSignal.value) : next;
    };
    const loading = ref(true);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const error = ref('');
    const setError = (next: typeof error.value | ((previous: typeof error.value) => typeof error.value)) => {
      error.value = typeof next === 'function' ? (next as (previous: typeof error.value) => typeof error.value)(error.value) : next;
    };
    const notice = ref('');
    const setNotice = (next: typeof notice.value | ((previous: typeof notice.value) => typeof notice.value)) => {
      notice.value = typeof next === 'function' ? (next as (previous: typeof notice.value) => typeof notice.value)(notice.value) : next;
    };
    const profile = ref({
      nickname: '',
      email: ''
    });
    const setProfile = (next: typeof profile.value | ((previous: typeof profile.value) => typeof profile.value)) => {
      profile.value = typeof next === 'function' ? (next as (previous: typeof profile.value) => typeof profile.value)(profile.value) : next;
    };
    const passwords = ref({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    const setPasswords = (next: typeof passwords.value | ((previous: typeof passwords.value) => typeof passwords.value)) => {
      passwords.value = typeof next === 'function' ? (next as (previous: typeof passwords.value) => typeof passwords.value)(passwords.value) : next;
    };
    const phoneForm = ref({
      phone: '',
      code: ''
    });
    const setPhoneForm = (next: typeof phoneForm.value | ((previous: typeof phoneForm.value) => typeof phoneForm.value)) => {
      phoneForm.value = typeof next === 'function' ? (next as (previous: typeof phoneForm.value) => typeof phoneForm.value)(phoneForm.value) : next;
    };
    const codeLeft = ref(0);
    /** 已经发过码的号码：只有它和当前输入的号码一致时才允许提交，避免"填了码但那条码根本没发给这个号" */
    const setCodeLeft = (next: typeof codeLeft.value | ((previous: typeof codeLeft.value) => typeof codeLeft.value)) => {
      codeLeft.value = typeof next === 'function' ? (next as (previous: typeof codeLeft.value) => typeof codeLeft.value)(codeLeft.value) : next;
    };
    const codeSentFor = ref('');
    const setCodeSentFor = (next: typeof codeSentFor.value | ((previous: typeof codeSentFor.value) => typeof codeSentFor.value)) => {
      codeSentFor.value = typeof next === 'function' ? (next as (previous: typeof codeSentFor.value) => typeof codeSentFor.value)(codeSentFor.value) : next;
    };
    const addresses = ref<AddressRow[]>([]);
    const setAddresses = (next: typeof addresses.value | ((previous: typeof addresses.value) => typeof addresses.value)) => {
      addresses.value = typeof next === 'function' ? (next as (previous: typeof addresses.value) => typeof addresses.value)(addresses.value) : next;
    };
    const addressEditing = ref<string | null>(null);
    const setAddressEditing = (next: typeof addressEditing.value | ((previous: typeof addressEditing.value) => typeof addressEditing.value)) => {
      addressEditing.value = typeof next === 'function' ? (next as (previous: typeof addressEditing.value) => typeof addressEditing.value)(addressEditing.value) : next;
    };
    const addressForm = ref({
      ...emptyAddress
    });
    const setAddressForm = (next: typeof addressForm.value | ((previous: typeof addressForm.value) => typeof addressForm.value)) => {
      addressForm.value = typeof next === 'function' ? (next as (previous: typeof addressForm.value) => typeof addressForm.value)(addressForm.value) : next;
    };
    const businessKeyword = ref('');
    const setBusinessKeyword = (next: typeof businessKeyword.value | ((previous: typeof businessKeyword.value) => typeof businessKeyword.value)) => {
      businessKeyword.value = typeof next === 'function' ? (next as (previous: typeof businessKeyword.value) => typeof businessKeyword.value)(businessKeyword.value) : next;
    };
    const businessResults = ref<BusinessResult[]>([]);
    const setBusinessResults = (next: typeof businessResults.value | ((previous: typeof businessResults.value) => typeof businessResults.value)) => {
      businessResults.value = typeof next === 'function' ? (next as (previous: typeof businessResults.value) => typeof businessResults.value)(businessResults.value) : next;
    };
    const joinRole = ref('buyer');
    const setJoinRole = (next: typeof joinRole.value | ((previous: typeof joinRole.value) => typeof joinRole.value)) => {
      joinRole.value = typeof next === 'function' ? (next as (previous: typeof joinRole.value) => typeof joinRole.value)(joinRole.value) : next;
    };
    const joinMessage = ref('');
    const setJoinMessage = (next: typeof joinMessage.value | ((previous: typeof joinMessage.value) => typeof joinMessage.value)) => {
      joinMessage.value = typeof next === 'function' ? (next as (previous: typeof joinMessage.value) => typeof joinMessage.value)(joinMessage.value) : next;
    };
    const createBusinessOpen = ref(false);
    const setCreateBusinessOpen = (next: typeof createBusinessOpen.value | ((previous: typeof createBusinessOpen.value) => typeof createBusinessOpen.value)) => {
      createBusinessOpen.value = typeof next === 'function' ? (next as (previous: typeof createBusinessOpen.value) => typeof createBusinessOpen.value)(createBusinessOpen.value) : next;
    };
    const certificationTarget = ref<MerchantRow | null>(null);
    const setCertificationTarget = (next: typeof certificationTarget.value | ((previous: typeof certificationTarget.value) => typeof certificationTarget.value)) => {
      certificationTarget.value = typeof next === 'function' ? (next as (previous: typeof certificationTarget.value) => typeof certificationTarget.value)(certificationTarget.value) : next;
    };
    const certificationForm = ref({
      companyName: '',
      creditCode: '',
      legalPerson: '',
      licenseNo: '',
      contactName: '',
      contactPhone: '',
      attachNote: '',
      businessLicenseUrl: '',
      legalPersonIdFrontUrl: '',
      legalPersonIdBackUrl: '',
      legalPersonFaceUrl: '',
      corporateBankName: '',
      corporateBankAccount: '',
      corporateTransferAmount: '',
      corporateTransferReference: '',
      corporateTransferProofUrl: '',
      registeredCapital: ''
    });
    const setCertificationForm = (next: typeof certificationForm.value | ((previous: typeof certificationForm.value) => typeof certificationForm.value)) => {
      certificationForm.value = typeof next === 'function' ? (next as (previous: typeof certificationForm.value) => typeof certificationForm.value)(certificationForm.value) : next;
    };
    const certificationUploading = ref<string | null>(null);
    const setCertificationUploading = (next: typeof certificationUploading.value | ((previous: typeof certificationUploading.value) => typeof certificationUploading.value)) => {
      certificationUploading.value = typeof next === 'function' ? (next as (previous: typeof certificationUploading.value) => typeof certificationUploading.value)(certificationUploading.value) : next;
    };
    const createIdentity = ref<'enterprise' | 'personal'>('enterprise');
    const setCreateIdentity = (next: typeof createIdentity.value | ((previous: typeof createIdentity.value) => typeof createIdentity.value)) => {
      createIdentity.value = typeof next === 'function' ? (next as (previous: typeof createIdentity.value) => typeof createIdentity.value)(createIdentity.value) : next;
    };
    const createBusinessForm = ref({
      companyName: '',
      creditCode: '',
      industry: INDUSTRIES[0],
      companySize: COMPANY_SIZES[0],
      realName: '',
      idCard: '',
      businessType: BUSINESS_TYPES[0],
      contactName: ''
    });
    // 注册地址：省/市/区来自主数据行政区划，详细地址手工填；提交时拼成后端接收的一个 address 字符串
    const setCreateBusinessForm = (next: typeof createBusinessForm.value | ((previous: typeof createBusinessForm.value) => typeof createBusinessForm.value)) => {
      createBusinessForm.value = typeof next === 'function' ? (next as (previous: typeof createBusinessForm.value) => typeof createBusinessForm.value)(createBusinessForm.value) : next;
    };
    const addressRegion = ref({
      province: '',
      city: '',
      district: '',
      detail: ''
    });
    const setAddressRegion = (next: typeof addressRegion.value | ((previous: typeof addressRegion.value) => typeof addressRegion.value)) => {
      addressRegion.value = typeof next === 'function' ? (next as (previous: typeof addressRegion.value) => typeof addressRegion.value)(addressRegion.value) : next;
    };
    const regionCatalog = ref<RegionCatalog | null>(null);
    const setRegionCatalog = (next: typeof regionCatalog.value | ((previous: typeof regionCatalog.value) => typeof regionCatalog.value)) => {
      regionCatalog.value = typeof next === 'function' ? (next as (previous: typeof regionCatalog.value) => typeof regionCatalog.value)(regionCatalog.value) : next;
    };
    const regionLoading = ref(false);
    const setRegionLoading = (next: typeof regionLoading.value | ((previous: typeof regionLoading.value) => typeof regionLoading.value)) => {
      regionLoading.value = typeof next === 'function' ? (next as (previous: typeof regionLoading.value) => typeof regionLoading.value)(regionLoading.value) : next;
    };
    const regionError = ref('');
    const setRegionError = (next: typeof regionError.value | ((previous: typeof regionError.value) => typeof regionError.value)) => {
      regionError.value = typeof next === 'function' ? (next as (previous: typeof regionError.value) => typeof regionError.value)(regionError.value) : next;
    };
    const busy = ref(false);
    const setBusy = (next: typeof busy.value | ((previous: typeof busy.value) => typeof busy.value)) => {
      busy.value = typeof next === 'function' ? (next as (previous: typeof busy.value) => typeof busy.value)(busy.value) : next;
    };
    const switchingMerchantId = ref<string | null>(null);
    const setSwitchingMerchantId = (next: typeof switchingMerchantId.value | ((previous: typeof switchingMerchantId.value) => typeof switchingMerchantId.value)) => {
      switchingMerchantId.value = typeof next === 'function' ? (next as (previous: typeof switchingMerchantId.value) => typeof switchingMerchantId.value)(switchingMerchantId.value) : next;
    };
    const load = async (): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const result = await api<Summary>('/api/v1/sso/account/summary');
        if (result.code !== 0 || !result.data) {
          setError(result.message ?? '请先登录后访问个人中心');
          setSummary(null);
          return;
        }
        const data = result.data;
        setSummary(data);
        setProfile({
          nickname: data.nickname ?? '',
          email: data.email ?? ''
        });
        setAddresses(data.addresses ?? []);
      } catch {
        setError('无法连接账号服务');
      } finally {
        setLoading(false);
      }
    };
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          void load();
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [__props.initialTab], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (__props.initialTab?.startsWith('security')) {
            setTab('security');
            setSecurityPage(normalizeSecurityPage(__props.initialTab));
            setSecurityMenuOpen(true);
            setProfileEditing(false);
            return;
          }
          if (__props.initialTab === 'profile/edit') {
            setTab('profile');
            setProfileEditing(true);
            return;
          }
          setTab(normalizeAccountTab(__props.initialTab));
          setProfileEditing(false);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    (() => {
      let dispose: void | (() => void);
      onMounted(() => {
        dispose = (() => {
          const canonical = initialProfileEdit.value ? '#/account/profile/edit' : __props.initialTab?.startsWith('security') ? `#/account/security/${normalizeSecurityPage(__props.initialTab)}` : `#/account/${normalizeAccountTab(__props.initialTab)}`;
          if (window.location.hash !== canonical) {
            window.history.replaceState(null, '', canonical);
          }
        })();
      });
      onBeforeUnmount(() => {
        if (typeof dispose === 'function') dispose();
      });
    })();
    onMounted(() => {
      watch(() => [codeLeft.value], (_next, _previous, onCleanup) => {
        const dispose = (() => {
          if (codeLeft.value <= 0) return undefined;
          const timer = window.setTimeout(() => setCodeLeft(codeLeft.value - 1), 1000);
          return () => window.clearTimeout(timer);
        })();
        if (typeof dispose === 'function') onCleanup(dispose);
      }, {
        immediate: true,
        flush: 'post'
      });
    });
    const flash = (message: string): void => {
      setNotice(message);
      window.setTimeout(() => setNotice(''), 3500);
    };
    const openTab = (next: Tab): void => {
      if (next === 'security') {
        openSecurity(securityPage.value);
        return;
      }
      setProfileEditing(false);
      setSecurityMenuOpen(false);
      setTab(next);
      const target = `#/account/${next}`;
      if (window.location.hash !== target) {
        window.location.hash = target;
      }
    };
    const openSecurity = (next: SecurityPage): void => {
      setTab('security');
      setSecurityPage(next);
      setSecurityMenuOpen(true);
      setProfileEditing(false);
      const target = `#/account/security/${next}`;
      if (window.location.hash !== target) window.location.hash = target;
    };
    const openProfileEdit = (): void => {
      setTab('profile');
      setProfileEditing(true);
      const target = '#/account/profile/edit';
      if (window.location.hash !== target) window.location.hash = target;
    };
    const saveProfile = async (event: Event): Promise<void> => {
      event.preventDefault();
      setBusy(true);
      try {
        const result = await api('/api/v1/sso/account/profile', {
          method: 'PUT',
          body: JSON.stringify(profile.value)
        });
        if (result.code !== 0) return setError(result.message ?? '资料保存失败');
        flash('账号资料已保存');
        await load();
        openTab('profile');
      } finally {
        setBusy(false);
      }
    };
    const changePassword = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (passwords.value.newPassword !== passwords.value.confirmPassword) {
        return setError('两次输入的新密码不一致');
      }
      setBusy(true);
      try {
        const result = await api('/api/v1/sso/account/password', {
          method: 'POST',
          body: JSON.stringify(passwords.value)
        });
        if (result.code !== 0) return setError(result.message ?? '密码修改失败');
        setPasswords({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        flash('密码修改成功');
      } finally {
        setBusy(false);
      }
    };

    /** 换绑手机的三条门槛：合法号、不等于当前号、验证码位数够。页面与后端同一口径，谁先说都不算骗人。 */
    const phoneValid = computed(() => /^1[3-9]\d{9}$/.test(phoneForm.value.phone));
    const phoneSameAsCurrent = computed(() => Boolean(summary.value?.phone) && phoneForm.value.phone === summary.value?.phone);
    const phoneCodeReady = computed(() => codeSentFor.value === phoneForm.value.phone && /^\d{6}$/.test(phoneForm.value.code));
    const sendPhoneCode = async (): Promise<void> => {
      setError('');
      if (!phoneValid.value) return setError('请输入正确的 11 位手机号');
      if (phoneSameAsCurrent.value) return setError('新手机号与当前绑定的手机号相同，无需变更');
      const result = await api<{
        hint?: string;
        devMode?: boolean;
      }>('/api/v1/sso/account/phone/code', {
        method: 'POST',
        body: JSON.stringify({
          phone: phoneForm.value.phone
        })
      });
      if (result.code !== 0) return setError(result.message ?? '验证码发送失败');
      setCodeSentFor(phoneForm.value.phone);
      setCodeLeft(60);
      flash(result.data?.hint ?? '验证码已发送');
    };
    const changePhone = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (!phoneValid.value) return setError('请输入正确的 11 位手机号');
      if (!phoneCodeReady.value) return setError(codeSentFor.value !== phoneForm.value.phone ? '请先给这个号码获取验证码（换过号码要重新获取）' : '验证码是 6 位数字');
      setBusy(true);
      try {
        const result = await api<{
          loginNameChanged?: boolean;
        }>('/api/v1/sso/account/phone', {
          method: 'POST',
          body: JSON.stringify(phoneForm.value)
        });
        if (result.code !== 0) return setError(result.message ?? '手机号变更失败');
        setPhoneForm({
          phone: '',
          code: ''
        });
        setCodeSentFor('');
        // 登录名可能就是旧手机号：换号后登录名一起变，不写清楚用户会拿旧号登录不上还以为账号丢了
        flash(result.data?.loginNameChanged ? '手机号已变更，登录名同步改为新手机号' : '手机号已变更');
        await load();
      } finally {
        setBusy(false);
      }
    };
    const editAddress = (row?: AddressRow): void => {
      if (!row) {
        setAddressEditing('new');
        setAddressForm({
          ...emptyAddress,
          receiverName: summary.value?.nickname ?? '',
          contactPhone: summary.value?.phone ?? ''
        });
        return;
      }
      setAddressEditing(row.id);
      setAddressForm({
        receiverName: row.receiverName,
        contactPhone: row.contactPhone,
        province: row.province,
        city: row.city,
        district: row.district ?? '',
        detailAddress: row.detailAddress,
        postalCode: row.postalCode ?? '',
        isDefault: row.isDefault === 1
      });
    };
    const saveAddress = async (event: Event): Promise<void> => {
      event.preventDefault();
      setBusy(true);
      try {
        const isNew = addressEditing.value === 'new';
        const path = isNew ? '/api/v1/sso/account/addresses' : `/api/v1/sso/account/addresses/${addressEditing.value}`;
        const result = await api(path, {
          method: isNew ? 'POST' : 'PUT',
          body: JSON.stringify({
            ...addressForm.value,
            isDefault: Boolean(addressForm.value.isDefault)
          })
        });
        if (result.code !== 0) return setError(result.message ?? '地址保存失败');
        setAddressEditing(null);
        flash(isNew ? '地址已添加' : '地址已更新');
        await load();
      } finally {
        setBusy(false);
      }
    };
    const setDefault = async (id: string): Promise<void> => {
      const result = await api(`/api/v1/sso/account/addresses/${id}/default`, {
        method: 'POST'
      });
      if (result.code !== 0) return setError(result.message ?? '设置失败');
      flash('已设为默认地址');
      await load();
    };
    const deleteAddress = async (id: string): Promise<void> => {
      if (!window.confirm('确认删除该地址？')) return;
      const result = await api(`/api/v1/sso/account/addresses/${id}`, {
        method: 'DELETE'
      });
      if (result.code !== 0) return setError(result.message ?? '删除失败');
      flash('地址已删除');
      await load();
    };
    const searchBusiness = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (businessKeyword.value.trim().length < 2) return setError('请输入至少 2 个字符');
      const result = await api<BusinessResult[]>(`/api/v1/sso/account/businesses/search?keyword=${encodeURIComponent(businessKeyword.value.trim())}`);
      if (result.code !== 0) return setError(result.message ?? '搜索失败');
      setBusinessResults(result.data ?? []);
    };
    const requestJoin = async (business: BusinessResult): Promise<void> => {
      const result = await api('/api/v1/sso/account/businesses/join-requests', {
        method: 'POST',
        body: JSON.stringify({
          merchantId: business.merchantId,
          roleInMerchant: joinRole.value,
          message: joinMessage.value
        })
      });
      if (result.code !== 0) return setError(result.message ?? '申请提交失败');
      flash(`已提交加入「${business.name}」的申请`);
      setBusinessResults(rows => rows.map(row => row.merchantId === business.merchantId ? {
        ...row,
        alreadyJoined: true
      } : row));
      await load();
    };

    /** 行政区划只在需要时拉一次；失败可重试，不阻塞个人主体创建 */
    const ensureRegionCatalog = async (): Promise<void> => {
      if (regionCatalog.value || regionLoading.value) return;
      setRegionLoading(true);
      setRegionError('');
      try {
        setRegionCatalog(await loadRegionCatalog());
      } catch (e) {
        setRegionError((e as Error).message || '行政区划加载失败');
      } finally {
        setRegionLoading(false);
      }
    };
    const openCreateBusiness = (identity: 'enterprise' | 'personal'): void => {
      setCreateIdentity(identity);
      setCreateBusinessForm(current => ({
        ...current,
        contactName: current.contactName || summary.value?.nickname || ''
      }));
      if (identity === 'enterprise') {
        setAddressRegion({
          province: '',
          city: '',
          district: '',
          detail: ''
        });
        void ensureRegionCatalog();
      }
      setCreateBusinessOpen(true);
    };
    const currentComposedAddress = computed(() => {
      const province = regionCatalog.value?.provinces.find(item => item.code === addressRegion.value.province);
      const city = childrenOf(regionCatalog.value?.cities ?? [], addressRegion.value.province).find(item => item.code === addressRegion.value.city);
      const district = childrenOf(regionCatalog.value?.districts ?? [], addressRegion.value.city).find(item => item.code === addressRegion.value.district);
      return [province?.name ?? '', displayCityName(city, province), district?.name ?? '', addressRegion.value.detail.trim()].filter(Boolean).join(' ');
    });
    const createBusiness = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (createIdentity.value === 'enterprise') {
        if (!createBusinessForm.value.companyName.trim()) return setError('请填写企业名称');
        if (!/^[0-9A-Za-z]{15,18}$/.test(createBusinessForm.value.creditCode.trim())) {
          return setError('请填写 15-18 位统一社会信用代码');
        }
      } else {
        if (!createBusinessForm.value.realName.trim()) return setError('请填写真实姓名');
        if (!/^\d{17}[\dXx]$/.test(createBusinessForm.value.idCard.trim())) {
          return setError('身份证号应为 18 位（末位可为 X）');
        }
      }
      if (!createBusinessForm.value.contactName.trim()) return setError('请填写联系人姓名');
      if (createIdentity.value === 'enterprise') {
        if (!addressRegion.value.province) return setError('请选择注册地址所在省份');
        if (!addressRegion.value.city) return setError('请选择注册地址所在城市');
        if (childrenOf(regionCatalog.value?.districts ?? [], addressRegion.value.city).length > 0 && !addressRegion.value.district) return setError('请选择注册地址所在区县');
        if (!addressRegion.value.detail.trim()) return setError('请填写详细地址（街道、门牌号）');
      }
      setBusy(true);
      try {
        const result = await api('/api/v1/sso/account/businesses', {
          method: 'POST',
          body: JSON.stringify({
            ...createBusinessForm.value,
            address: currentComposedAddress.value || null,
            identity: createIdentity.value
          })
        });
        if (result.code !== 0) return setError(result.message ?? '主体创建失败');
        setCreateBusinessOpen(false);
        flash(createIdentity.value === 'enterprise' ? '企业主体已创建' : '个人主体已创建');
        await load();
      } finally {
        setBusy(false);
      }
    };
    const activateMerchant = async (merchant: MerchantRow): Promise<void> => {
      if (merchant.merchantId === summary.value?.activeMerchantId) return;
      setSwitchingMerchantId(merchant.merchantId);
      setError('');
      try {
        const result = await api<{
          activeMerchantId: string;
          merchantName: string;
        }>(`/api/v1/sso/account/businesses/${merchant.merchantId}/activate`, {
          method: 'POST'
        });
        if (result.code !== 0) return setError(result.message ?? '主体切换失败');
        flash(`已切换为「${result.data?.merchantName || merchant.merchantName || '当前主体'}」`);
        await load();
      } finally {
        setSwitchingMerchantId(null);
      }
    };
    const startCertification = (merchant: MerchantRow): void => {
      if (merchant.memberType === 'personal') {
        // 个人主体的实名就是账号级个人实名：直接切到「个人实名」菜单并展开资料表单
        setRealnameFormSignal(value => value + 1);
        setTab('realname');
        return;
      }
      const cert = merchant.certification;
      setTab('enterprise');
      setCertificationTarget(merchant);
      setCertificationForm({
        companyName: cert?.companyName || merchant.merchantName || '',
        creditCode: cert?.creditCode || merchant.creditCode || '',
        legalPerson: cert?.legalPerson || '',
        licenseNo: cert?.licenseNo || '',
        contactName: cert?.contactName || merchant.contactName || '',
        contactPhone: cert?.contactPhone || merchant.contactPhone || '',
        attachNote: cert?.attachNote || '',
        businessLicenseUrl: cert?.businessLicenseUrl || '',
        legalPersonIdFrontUrl: cert?.legalPersonIdFrontUrl || '',
        legalPersonIdBackUrl: cert?.legalPersonIdBackUrl || '',
        legalPersonFaceUrl: cert?.legalPersonFaceUrl || '',
        corporateBankName: cert?.corporateBankName || '',
        corporateBankAccount: '',
        corporateTransferAmount: cert?.corporateTransferAmount || '',
        corporateTransferReference: cert?.corporateTransferReference || '',
        corporateTransferProofUrl: cert?.corporateTransferProofUrl || '',
        registeredCapital: cert?.registeredCapital || ''
      });
    };
    const uploadCertificationDocument = async (kind: string, file: File): Promise<void> => {
      if (!certificationTarget.value) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setError('仅支持 JPG、PNG、WEBP 图片');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('单张图片不能超过 5MB');
        return;
      }
      setCertificationUploading(kind);
      setError('');
      try {
        const body = new FormData();
        body.append('file', file);
        const response = await fetch(`/api/v1/sso/account/businesses/${certificationTarget.value.merchantId}/certification-files?kind=${encodeURIComponent(kind)}`, {
          method: 'POST',
          credentials: 'include',
          body
        });
        const result = (await response.json()) as {
          code: number;
          message?: string;
          data?: {
            url: string;
          };
        };
        if (!response.ok || result.code !== 0 || !result.data?.url) {
          setError(result.message ?? '图片上传失败，请重试');
          return;
        }
        const field = {
          business_license: 'businessLicenseUrl',
          legal_person_id_front: 'legalPersonIdFrontUrl',
          legal_person_id_back: 'legalPersonIdBackUrl',
          legal_person_face: 'legalPersonFaceUrl',
          corporate_transfer_proof: 'corporateTransferProofUrl'
        }[kind] as 'businessLicenseUrl' | 'legalPersonIdFrontUrl' | 'legalPersonIdBackUrl' | 'legalPersonFaceUrl' | 'corporateTransferProofUrl' | undefined;
        if (field) setCertificationForm(current => ({
          ...current,
          [field]: result.data!.url
        }));
      } catch {
        setError('图片上传失败，请检查网络后重试');
      } finally {
        setCertificationUploading(null);
      }
    };
    const submitEnterpriseCertification = async (event: Event): Promise<void> => {
      event.preventDefault();
      if (!certificationTarget.value) return;
      if (!certificationForm.value.companyName.trim()) return setError('请填写企业名称');
      if (!/^[0-9A-Za-z]{15,18}$/.test(certificationForm.value.creditCode.trim())) {
        return setError('统一社会信用代码应为 15-18 位字母数字');
      }
      if (!certificationForm.value.legalPerson.trim()) return setError('请填写法定代表人');
      if (!certificationForm.value.contactName.trim()) return setError('请填写联系人姓名');
      if (!/^1[3-9]\d{9}$/.test(certificationForm.value.contactPhone.trim())) {
        return setError('请填写正确的 11 位联系电话');
      }
      if (!certificationForm.value.businessLicenseUrl) return setError('请上传营业执照照片');
      if (!certificationForm.value.legalPersonFaceUrl) return setError('请完成法定代表人扫脸采集');
      if (!certificationForm.value.corporateBankName.trim()) return setError('请填写对公账户户名');
      if (!/^\d{8,32}$/.test(certificationForm.value.corporateBankAccount.replace(/\s/g, ''))) {
        return setError('请填写有效的对公账户账号');
      }
      if (!/^\d{1,3}(\.\d{1,2})?$/.test(certificationForm.value.corporateTransferAmount)) {
        return setError('请填写正确的对公打款金额');
      }
      if (certificationForm.value.corporateTransferReference.trim().length < 6) {
        return setError('请填写对公打款流水号');
      }
      if (!certificationForm.value.corporateTransferProofUrl) return setError('请上传对公打款凭证');
      setBusy(true);
      try {
        const result = await api(`/api/v1/sso/account/businesses/${certificationTarget.value.merchantId}/submit-certification`, {
          method: 'POST',
          body: JSON.stringify(certificationForm.value)
        });
        if (result.code !== 0) return setError(result.message ?? '认证提交失败');
        setCertificationTarget(null);
        flash('企业认证已提交平台审核');
        await load();
      } finally {
        setBusy(false);
      }
    };
    const reviewJoin = async (id: string, approved: boolean): Promise<void> => {
      const result = await api(`/api/v1/sso/account/businesses/join-requests/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({
          approved,
          remark: approved ? '负责人已同意' : '负责人已拒绝'
        })
      });
      if (result.code !== 0) return setError(result.message ?? '审批失败');
      flash(approved ? '已同意加入申请' : '已拒绝加入申请');
      await load();
    };
    const cancelJoin = async (id: string): Promise<void> => {
      const result = await api(`/api/v1/sso/account/businesses/join-requests/${id}`, {
        method: 'DELETE'
      });
      if (result.code !== 0) return setError(result.message ?? '撤回申请失败');
      flash('加入申请已撤回');
      await load();
    };
    return () => {
      const view_loading = loading.value;
      const view_summary = summary.value;
      const view_error = error.value;
      const view_regionCatalog = regionCatalog.value;
      const view_addressRegion = addressRegion.value;
      const view_tab = tab.value;
      const view_pendingKey = pendingKey.value;
      const view_securityPage = securityPage.value;
      const view_profileEditing = profileEditing.value;
      const view_notice = notice.value;
      const view_addresses = addresses.value;
      const view_profile = profile.value;
      const view_busy = busy.value;
      const view_passwords = passwords.value;
      const view_phoneForm = phoneForm.value;
      const view_phoneSameAsCurrent = phoneSameAsCurrent.value;
      const view_codeLeft = codeLeft.value;
      const view_phoneValid = phoneValid.value;
      const view_codeSentFor = codeSentFor.value;
      const view_phoneCodeReady = phoneCodeReady.value;
      const view_addressEditing = addressEditing.value;
      const view_addressForm = addressForm.value;
      const view_realnameFormSignal = realnameFormSignal.value;
      const view_certificationTarget = certificationTarget.value;
      const view_certificationForm = certificationForm.value;
      const view_certificationUploading = certificationUploading.value;
      const view_switchingMerchantId = switchingMerchantId.value;
      const view_businessKeyword = businessKeyword.value;
      const view_joinRole = joinRole.value;
      const view_joinMessage = joinMessage.value;
      const view_businessResults = businessResults.value;
      const view_createBusinessOpen = createBusinessOpen.value;
      const view_createIdentity = createIdentity.value;
      const view_createBusinessForm = createBusinessForm.value;
      const view_regionLoading = regionLoading.value;
      const view_regionError = regionError.value;
      if (view_loading) {
        return <section class="section account-page"><div class="card empty">正在加载个人中心…</div></section>;
      }
      if (!view_summary) {
        return <section class="section account-page">
        <div class="card account-login-required">
          <Icon name="user" size={36} />
          <h2>请先登录</h2>
          <p>{view_error || '登录后可维护账号资料、安全设置、地址和经营主体。'}</p>
          <a class="btn btn-primary" href="http://localhost:8090/login">前往登录</a>
        </div>
      </section>;
      }
      const activeMerchant = view_summary.merchants.find(merchant => merchant.merchantId === view_summary.activeMerchantId) ?? null;

      /* ---------- 注册地址级联 ---------- */
      const provinceOption = view_regionCatalog?.provinces.find(item => item.code === view_addressRegion.province);
      const cityOptions = childrenOf(view_regionCatalog?.cities ?? [], view_addressRegion.province);
      const cityOption = cityOptions.find(item => item.code === view_addressRegion.city);
      const districtOptions = childrenOf(view_regionCatalog?.districts ?? [], view_addressRegion.city);
      const districtOption = districtOptions.find(item => item.code === view_addressRegion.district);
      const composedAddress = [provinceOption?.name ?? '', displayCityName(cityOption, provinceOption), districtOption?.name ?? '', view_addressRegion.detail.trim()].filter(Boolean).join(' ');
      const activeTabMeta = TABS.find(item => item.key === view_tab) ?? TABS[0];
      const navStats = navProgress();
      const pendingItem = view_pendingKey ? findNavItem(view_pendingKey) : undefined;
      const securityTitle = view_securityPage === 'password' ? '修改密码' : '变更手机号';
      const securityDescription = view_securityPage === 'password' ? '设置新的登录密码' : '先验证新号码收得到短信，再换绑（登录名是手机号时会同步变更）';
      const pageTitle = pendingItem ? pendingItem.label : view_tab === 'profile' && view_profileEditing ? '编辑账号资料' : view_tab === 'security' ? securityTitle : activeTabMeta.label;
      const pageDescription = pendingItem ? '该功能尚未接入后端，下面是具体缺口' : view_tab === 'profile' && view_profileEditing ? '修改昵称与邮箱，登录账号和手机号请在账号安全中维护' : view_tab === 'security' ? securityDescription : activeTabMeta.description;
      return <section class="section account-page">
      <div class="account-hero">
        <div class="account-avatar">{(view_summary.nickname || view_summary.username || view_summary.phone).slice(0, 1)}</div>
        <div>
          <span class="tag tag-tech">个人中心</span>
          <h1>{view_summary.nickname || view_summary.username}</h1>
          <p>{view_summary.username} · {view_summary.phone || '未绑定手机'} · 注册于 {String(view_summary.createdAt).slice(0, 10)}</p>
        </div>
        <div class="account-hero-status">
          <span class={`account-status ${tone(view_summary.realName?.status)}`}>{statusText(view_summary.realName?.status)}</span>
          <small>
            {activeMerchant ? `当前主体：${activeMerchant.merchantName}` : '当前无登录主体'}
            {' · '}共 {view_summary.merchants.length} 个
          </small>
        </div>
      </div>

      <div class="account-shell">
        <aside class="account-sidebar">
          <div class="account-sidebar-head">
            <span>用户中心</span>
            <strong>账号 · 身份 · 认证 · 安全</strong>
          </div>
          {/*
            侧栏按原型 IA 渲染（8 组 / 20 项），而不是按"代码里现有哪些 tab"。
            每项带状态：
              ready    → 点进去有真实功能
              external → 跳认证中心或独立认证页
              pending  → 点开说明"缺哪个接口"，不给空白页也不给假数据
            进度条让"原型 20 项、已实现 7 项"这件事在界面上就看得见，不用翻文档。
           */}
          <div class="uc-nav-progress" title="原型条目已实现进度">
            <div class="uc-nav-progress-bar">
              <span style={{
                  width: `${Math.round((navStats.ready + navStats.external) / navStats.total * 100)}%`
                }} />
            </div>
            <small>
              已实现 {navStats.ready + navStats.external} / {navStats.total} 项
              {navStats.pending > 0 ? ` · 待接入 ${navStats.pending}` : ''}
            </small>
          </div>
          <nav class="account-menu" aria-label="用户中心菜单">
            {NAV_GROUPS.map(group => <div class="uc-nav-group" key={group.key}>
                <div class="uc-nav-group-title">
                  <Icon name={group.icon} size={13} />
                  <span>{group.label}</span>
                </div>
                {group.items.map(item => {
                  const isActive = item.status === 'ready' && item.view === view_tab && !view_pendingKey;
                  return <button type="button" key={item.key} class={`account-menu-top uc-nav-item ${isActive ? 'on' : ''} ${item.status === 'pending' ? 'is-pending' : ''}`} onClick={() => {
                    if (item.status === 'external' && item.href) {
                      window.location.href = item.href;
                      return;
                    }
                    if (item.status === 'pending') {
                      setPendingKey(item.key);
                      return;
                    }
                    if (item.view) {
                      setPendingKey(null);
                      openTab(item.view);
                    }
                  }}>
                      <span class="account-menu-icon"><Icon name={item.icon} size={16} /></span>
                      <span>{item.label}</span>
                      {item.status === 'pending' && <i class="uc-nav-tag">待接入</i>}
                      {item.status === 'external' && <i class="uc-nav-tag ext">跳转</i>}
                      {item.status === 'ready' && <i>›</i>}
                    </button>;
                })}
              </div>)}
          </nav>
          <div class="account-sidebar-subject">
            <span>当前登录身份</span>
            <strong>{activeMerchant?.merchantName || '暂未选择'}</strong>
            <small>{activeMerchant ? `${activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'} · ${activeMerchant.roleInMerchant}` : '请先创建经营主体'}</small>
          </div>
        </aside>

        <main class="account-content">
          <div class="account-content-head">
            <div>
              <span>
                用户中心 / {pendingItem ? pendingItem.label : activeTabMeta.label}
                {view_profileEditing ? ' / 编辑' : view_tab === 'security' && !pendingItem ? ` / ${securityTitle}` : ''}
              </span>
              <h2>{pageTitle}</h2>
            </div>
            <p>{pageDescription}</p>
          </div>
          {view_notice && <div class="account-notice">{view_notice}</div>}
          {view_error && <div class="account-error">{view_error}</div>}

      {pendingItem && <div class="card uc-pending">
          <div class="uc-pending-head">
            <span class="uc-pending-icon"><Icon name="alert" size={22} /></span>
            <div>
              <h3>{pendingItem.label} · 暂未接入</h3>
              <p>原型规划了这个页面，但后端目前没有对应能力。这里如实说明缺口，不展示示例数据。</p>
            </div>
          </div>
          <dl class="uc-kv">
            <dt>缺失能力</dt>
            <dd>{pendingItem.gap ?? '待补充说明'}</dd>
          </dl>
          <p class="uc-pending-foot">
            补齐后端接口后，本页可直接接上，无需改导航结构。
          </p>
        </div>}

      {!pendingItem && view_tab === 'overview' && <AccountOverview summary={{
              userId: view_summary.userId,
              username: view_summary.username,
              nickname: view_summary.nickname,
              phone: view_summary.phone,
              email: view_summary.email,
              status: view_summary.status,
              createdAt: view_summary.createdAt,
              realName: view_summary.realName ? {
                realName: view_summary.realName.realName,
                status: view_summary.realName.status,
                policeVerified: view_summary.realName.policeVerified,
                livenessVerified: view_summary.realName.livenessVerified,
                verificationChannel: view_summary.realName.verificationChannel
              } : null,
              activeMerchantId: view_summary.activeMerchantId,
              merchants: view_summary.merchants.map(item => ({
                merchantId: item.merchantId,
                merchantName: item.merchantName ?? '未命名主体',
                memberType: item.memberType,
                roleInMerchant: item.roleInMerchant,
                verifyStatus: item.verifyStatus
              })),
              reviewInbox: view_summary.reviewInbox.map(item => ({
                id: item.id
              })),
              sentJoinRequests: view_summary.sentJoinRequests.map(item => ({
                id: item.id,
                status: item.status
              }))
            }} onNavigate={view => {
              setPendingKey(null);
              openTab(view);
            }} />}

      {!pendingItem && view_tab === 'messages' && <Messages />}

      {!pendingItem && view_tab === 'devices' && <LoginDevices />}

      {!pendingItem && view_tab === 'bindings' && <ThirdPartyBindings />}

      {!pendingItem && view_tab === 'notification' && <NotificationSettings />}

      {!pendingItem && view_tab === 'logs' && <OperationLogs />}

      {!pendingItem && view_tab === 'certificates' && <Certificates />}


      {!pendingItem && view_tab === 'feedback' && <Feedback />}

      {!pendingItem && view_tab === 'privacy' && <PrivacyData />}

      {!pendingItem && view_tab === 'crossModule' && <CrossModule />}

      {!pendingItem && view_tab === 'orders' && <Orders />}

      {!pendingItem && view_tab === 'help' && <HelpCenter />}

      {!pendingItem && view_tab === 'authorizations' && <Authorizations />}

      {!pendingItem && view_tab === 'mfa' && <Mfa />}

      {view_tab === 'profile' && !view_profileEditing && <div class="account-profile-overview">
          <div class="card account-card">
            <div class="account-card-head">
              <div><h2>账号概况</h2><small>登录账号与基础资料</small></div>
              <button class="btn btn-outline" onClick={openProfileEdit}>编辑账号资料</button>
            </div>
            <div class="account-profile-primary">
              <div class="account-profile-avatar">{(view_summary.nickname || view_summary.username || view_summary.phone).slice(0, 1)}</div>
              <div>
                <strong>{view_summary.nickname || '未设置昵称'}</strong>
                <span>{view_summary.username} · {view_summary.phone || '未绑定手机'}</span>
              </div>
              <span class="account-profile-state">
                <i class={view_summary.status === 1 ? 'online' : ''} />
                {view_summary.status === 1 ? '账号正常' : '账号停用'}
              </span>
            </div>
            <div class="account-profile-detail-grid">
              <div><span>登录账号</span><strong>{view_summary.username}</strong></div>
              <div><span>绑定手机</span><strong>{view_summary.phone || '未绑定'}</strong></div>
              <div><span>联系邮箱</span><strong>{view_summary.email || '未绑定'}</strong></div>
              <div><span>注册时间</span><strong>{String(view_summary.createdAt).slice(0, 10)}</strong></div>
            </div>
          </div>

          <div class="card account-card">
            <div class="account-card-head">
              <div><h2>账号关联概况</h2><small>实名、主体与地址使用情况</small></div>
            </div>
            <div class="account-profile-related-grid">
              <div>
                <span class={`account-status ${tone(view_summary.realName?.status)}`}>{statusText(view_summary.realName?.status)}</span>
                <strong>个人实名认证</strong>
                <small>{view_summary.realName?.realName || '尚未提交实名信息'}</small>
              </div>
              <div>
                <span class="account-profile-related-icon"><Icon name="factory" size={17} /></span>
                <strong>当前登录主体</strong>
                <small>{activeMerchant?.merchantName || '暂未选择经营主体'}</small>
              </div>
              <div>
                <span class="account-profile-related-icon"><Icon name="layers" size={17} /></span>
                <strong>经营主体</strong>
                <small>共 {view_summary.merchants.length} 个，可在主体资料中切换</small>
              </div>
              <div>
                <span class="account-profile-related-icon"><Icon name="location" size={17} /></span>
                <strong>收货地址</strong>
                <small>已维护 {view_addresses.length} 个收货地址</small>
              </div>
            </div>
          </div>
        </div>}

      {view_tab === 'profile' && view_profileEditing && <div class="account-profile-edit-layout">
          <form class="card account-card account-profile-edit" onSubmit={event => void saveProfile(event)}>
            <div class="account-card-head">
              <div><h2>编辑账号资料</h2><small>修改后点击保存立即生效</small></div>
            </div>
            <section class="account-profile-form-section">
              <div class="account-profile-form-title">
                <h3>基本资料</h3>
                <p>昵称会显示在门户和会员中心；邮箱用于接收平台通知。</p>
              </div>
              <div class="account-form-grid">
                <label>
                  <span class="account-form-label-row">昵称<span class="account-required">*</span></span>
                  <input class="input" value={view_profile.nickname} maxlength={64} onInput={event => setProfile({
                        ...view_profile,
                        nickname: (event.target as HTMLInputElement).value
                      })} />
                </label>
                <label>联系邮箱<input class="input" type="email" value={view_profile.email} onInput={event => setProfile({
                        ...view_profile,
                        email: (event.target as HTMLInputElement).value
                      })} /></label>
              </div>
            </section>
            <div class="account-form-actions account-profile-form-actions">
              <button class="btn btn-primary" disabled={view_busy}>{view_busy ? '保存中…' : '保存资料'}</button>
              <button type="button" class="btn btn-ghost" onClick={() => openTab('profile')}>取消</button>
            </div>
          </form>

          <div class="card account-card account-profile-readonly">
            <div class="account-card-head">
              <div><h2>账号与绑定信息</h2><small>以下信息不可在此页面修改</small></div>
            </div>
            <div class="account-info-list">
              <div><span>登录账号</span><strong>{view_summary.username}</strong></div>
              <div><span>绑定手机</span><strong>{view_summary.phone || '未绑定'}</strong></div>
            </div>
            <div class="account-profile-security-entry">
              <div>
                <strong>需要修改登录信息？</strong>
                <p>密码和手机号统一在账号安全中维护。</p>
              </div>
              <div class="account-form-actions">
                <button type="button" class="btn btn-outline btn-sm" onClick={() => openSecurity('password')}>修改密码</button>
                <button type="button" class="btn btn-outline btn-sm" onClick={() => openSecurity('phone')}>变更手机号</button>
              </div>
            </div>
          </div>
        </div>}

      {view_tab === 'security' && view_securityPage === 'password' && <form class="card account-card account-security-page" onSubmit={event => void changePassword(event)}>
            <div class="account-card-head"><h2>修改密码</h2><span>8-20 位，包含字母和数字</span></div>
            <label>当前密码<input class="input" type="password" value={view_passwords.currentPassword} onInput={event => setPasswords({
                  ...view_passwords,
                  currentPassword: (event.target as HTMLInputElement).value
                })} /></label>
            <label>新密码<input class="input" type="password" value={view_passwords.newPassword} onInput={event => setPasswords({
                  ...view_passwords,
                  newPassword: (event.target as HTMLInputElement).value
                })} /></label>
            <label>确认新密码<input class="input" type="password" value={view_passwords.confirmPassword} onInput={event => setPasswords({
                  ...view_passwords,
                  confirmPassword: (event.target as HTMLInputElement).value
                })} /></label>
            <button class="btn btn-primary" disabled={view_busy}>{view_busy ? '提交中…' : '修改密码'}</button>
        </form>}

      {view_tab === 'security' && view_securityPage === 'phone' && <form class="card account-card account-security-page account-phone-form" onSubmit={event => void changePhone(event)}>
            <div class="account-card-head">
              <h2>变更手机号</h2>
              <span>当前绑定：{view_summary?.phone || '未绑定'}</span>
            </div>
            <label>新手机号<input class="input" value={view_phoneForm.phone} maxlength={11} placeholder="11 位大陆手机号" onInput={event => setPhoneForm({
                  ...view_phoneForm,
                  phone: (event.target as HTMLInputElement).value.replace(/\D/g, '')
                })} /></label>
            {view_phoneSameAsCurrent && <p class="account-field-warning">这个号码就是当前绑定的号码，换绑请填新号码。</p>}
            <label>短信验证码
              <div class="account-code-row">
                <input class="input" value={view_phoneForm.code} maxlength={6} placeholder="6 位数字" onInput={event => setPhoneForm({
                    ...view_phoneForm,
                    code: (event.target as HTMLInputElement).value.replace(/\D/g, '')
                  })} />
                <button type="button" class="btn btn-outline" disabled={view_busy || view_codeLeft > 0 || !view_phoneValid || view_phoneSameAsCurrent} onClick={() => void sendPhoneCode()}>
                  {view_codeLeft > 0 ? `${view_codeLeft}s` : '获取验证码'}
                </button>
              </div>
            </label>
            <p class="account-field-hint">
              {view_codeSentFor && view_codeSentFor !== view_phoneForm.phone ? '验证码是上一条号码的：换了号码要重新获取。' : '验证码 5 分钟内有效、只用一次；同一号码 60 秒内不重发，当日有发送上限（由运营端参数配置决定）。'}
            </p>
            {view_summary?.username === view_summary?.phone && <p class="account-field-warning">
                这个账号的登录名就是当前手机号，换绑后<b>登录名会一起变成新号码</b>，以后请用新号码登录。
              </p>}
            <button class="btn btn-primary" disabled={view_busy || !view_phoneCodeReady}>{view_busy ? '提交中…' : '确认变更'}</button>
        </form>}

      {view_tab === 'addresses' && <div class="card account-card account-address-card">
          <div class="account-card-head">
            <h2>收货地址</h2>
            <button class="btn btn-primary" onClick={() => editAddress()}>新增地址</button>
          </div>
          <div class="account-address-list">
            {view_addresses.length === 0 && <div class="empty">暂无收货地址</div>}
            {view_addresses.map(row => <div class={`account-address ${row.isDefault === 1 ? 'default' : ''}`} key={row.id}>
                <div>
                  <strong>{row.receiverName}</strong><span>{row.contactPhone}</span>
                  {row.isDefault === 1 && <span class="tag tag-tech">默认</span>}
                  <p>{[row.province, row.city, row.district, row.detailAddress].filter(Boolean).join(' ')}</p>
                </div>
                <div class="account-address-actions">
                  {row.isDefault !== 1 && <button type="button" onClick={() => void setDefault(row.id)}>设为默认</button>}
                  <button type="button" onClick={() => editAddress(row)}>编辑</button>
                  <button type="button" class="danger" onClick={() => void deleteAddress(row.id)}>删除</button>
                </div>
              </div>)}
          </div>
          {view_addressEditing && <form class="account-address-form" onSubmit={event => void saveAddress(event)}>
              <h3>{view_addressEditing === 'new' ? '新增地址' : '编辑地址'}</h3>
              <div class="account-form-grid">
                <label>收货人<input class="input" value={view_addressForm.receiverName} onInput={event => setAddressForm({
                      ...view_addressForm,
                      receiverName: (event.target as HTMLInputElement).value
                    })} /></label>
                <label>联系电话<input class="input" value={view_addressForm.contactPhone} onInput={event => setAddressForm({
                      ...view_addressForm,
                      contactPhone: (event.target as HTMLInputElement).value
                    })} /></label>
                <label>省份<input class="input" value={view_addressForm.province} onInput={event => setAddressForm({
                      ...view_addressForm,
                      province: (event.target as HTMLInputElement).value
                    })} /></label>
                <label>城市<input class="input" value={view_addressForm.city} onInput={event => setAddressForm({
                      ...view_addressForm,
                      city: (event.target as HTMLInputElement).value
                    })} /></label>
                <label>区县<input class="input" value={view_addressForm.district} onInput={event => setAddressForm({
                      ...view_addressForm,
                      district: (event.target as HTMLInputElement).value
                    })} /></label>
                <label>邮编<input class="input" value={view_addressForm.postalCode} onInput={event => setAddressForm({
                      ...view_addressForm,
                      postalCode: (event.target as HTMLInputElement).value
                    })} /></label>
              </div>
              <label>详细地址<input class="input" value={view_addressForm.detailAddress} onInput={event => setAddressForm({
                    ...view_addressForm,
                    detailAddress: (event.target as HTMLInputElement).value
                  })} /></label>
              <label class="account-check"><input type="checkbox" checked={view_addressForm.isDefault} onInput={event => setAddressForm({
                    ...view_addressForm,
                    isDefault: (event.target as HTMLInputElement).checked
                  })} />设为默认地址</label>
              <div class="account-form-actions">
                <button type="submit" class="btn btn-primary" disabled={view_busy}>保存地址</button>
                <button type="button" class="btn btn-ghost" onClick={() => setAddressEditing(null)}>取消</button>
              </div>
            </form>}
        </div>}

      {view_tab === 'realname' && <PersonalRealname record={view_summary.realName} onRefresh={load} openFormSignal={view_realnameFormSignal} />}

      {view_tab === 'enterprise' && <div class="account-business-layout">
          <div class="card account-card uc-verify-hero">
            <div class="account-card-head">
              <h2>企业实名认证</h2>
              <span>{activeMerchant ? `当前主体：${activeMerchant.merchantName}` : '当前账号还没有经营主体'}</span>
            </div>
            {activeMerchant ? <>
                <div class="uc-verify-status">
                  <span class={`account-status ${tone(activeMerchant.verifyStatus)}`}>{statusText(activeMerchant.verifyStatus)}</span>
                  <p>{activeMerchant.memberType === 'personal' ? '个人主体不需要企业认证：账号完成「个人实名」后即可作为个人主体的身份依据。' : activeMerchant.verifyStatus === 'approved' ? '企业实名已通过，当前主体可开展交易、签约与金融申请。' : activeMerchant.verifyStatus === 'pending' ? '认证资料已提交平台审核，审核期间不可重复提交。' : activeMerchant.verifyStatus === 'rejected' ? '上次认证被驳回，请按审核意见修改资料后重新提交。' : '尚未提交企业认证。补齐营业执照、法人与对公账户信息后提交审核。'}</p>
                </div>
                <div class="account-info-list">
                  <div><span>主体名称</span><strong>{activeMerchant.merchantName}</strong></div>
                  <div><span>主体类型</span><strong>{activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'}</strong></div>
                  <div><span>主体编码</span><strong>{activeMerchant.merchantCode || '—'}</strong></div>
                  <div><span>统一社会信用代码</span><strong>{activeMerchant.creditCodeMasked || '—'}</strong></div>
                  <div><span>法定代表人 / 联系人</span><strong>{activeMerchant.certification?.legalPerson || activeMerchant.contactName || '—'}</strong></div>
                  <div><span>审核意见</span><strong>{activeMerchant.verifyRemark || '—'}</strong></div>
                </div>
                {activeMerchant.certification ? <div class="certification-track">
                    <span>认证单号</span><b>{activeMerchant.certification.certNo}</b>
                    <span>提交时间</span><b>{String(activeMerchant.certification.submitTime).replace('T', ' ').slice(0, 16)}</b>
                    {activeMerchant.certification.reviewTime && <><span>审核时间</span><b>{String(activeMerchant.certification.reviewTime).replace('T', ' ').slice(0, 16)}</b></>}
                  </div> : <p class="uc-muted">还没有认证单。提交认证后会生成认证单号，审核进度以此为准。</p>}
                <div class="account-form-actions">
                  {activeMerchant.memberType === 'personal' ? <button class="btn btn-outline" onClick={() => setTab('realname')}>去个人实名</button> : activeMerchant.verifyStatus === 'approved' ? <button class="btn btn-ghost" onClick={() => setTab('certificates')}>查看主体资质证照</button> : activeMerchant.verifyStatus === 'pending' ? <button class="btn btn-ghost" disabled>等待平台审核</button> : <button class="btn btn-primary" disabled={view_busy} onClick={() => void startCertification(activeMerchant)}>
                      {activeMerchant.verifyStatus === 'rejected' ? '重新提交认证' : '开始企业认证'}
                    </button>}
                </div>
              </> : <div class="account-business-empty">
                <p>认证挂在经营主体上。先到「我的组织」创建或加入一个企业主体，再回到本页提交认证。</p>
                <button class="btn btn-primary" onClick={() => setTab('org')}>去我的组织</button>
              </div>}
          </div>

          <div class="card account-card">
            <div class="account-card-head">
              <h2>其他主体认证状态</h2>
              <span>{view_summary.merchants.length} 个主体</span>
            </div>
            {view_summary.merchants.length === 0 ? <div class="empty">暂无经营主体</div> : <div class="uc-verify-list">
                {view_summary.merchants.map(merchant => <div class={`uc-verify-row ${merchant.merchantId === view_summary.activeMerchantId ? 'active' : ''}`} key={merchant.bindingId}>
                    <div class="uc-verify-row-main">
                      <strong>{merchant.merchantName}</strong>
                      <span>{merchant.memberType === 'personal' ? '个人主体' : '企业主体'} · {merchant.roleInMerchant}
                        {merchant.merchantId === view_summary.activeMerchantId ? ' · 当前主体' : ''}
                      </span>
                      {merchant.verifyRemark && <small>审核意见：{merchant.verifyRemark}</small>}
                    </div>
                    <div class="uc-verify-row-actions">
                      <span class={`account-status ${tone(merchant.verifyStatus)}`}>{statusText(merchant.verifyStatus)}</span>
                      {merchant.memberType === 'personal' ? <button class="btn btn-ghost btn-sm" onClick={() => setTab('realname')}>去个人实名</button> : merchant.verifyStatus === 'approved' || merchant.verifyStatus === 'pending' ? <button class="btn btn-ghost btn-sm" disabled>{merchant.verifyStatus === 'approved' ? '已认证' : '审核中'}</button> : <button class="btn btn-primary btn-sm" disabled={view_busy} onClick={() => void startCertification(merchant)}>
                          {merchant.verifyStatus === 'rejected' ? '重新认证' : '去认证'}
                        </button>}
                    </div>
                  </div>)}
              </div>}
          </div>

          <div class="card account-card">
            <div class="account-card-head"><h2>认证需要准备什么</h2><span>提交后 1-2 个工作日出结果</span></div>
            <ol class="uc-verify-flow">
              <li><b>营业执照</b><span>完整、清晰、在有效期内，四角无遮挡</span></li>
              <li><b>法定代表人扫脸</b><span>由法定代表人本人完成活体采集</span></li>
              <li><b>对公账户与打款凭证</b><span>户名须与企业名称一致，上传银行回单核对账户归属</span></li>
              <li><b>平台审核</b><span>审核通过后企业实名生效，可开展交易、签约与金融申请</span></li>
            </ol>
            <p class="uc-field-hint">
              认证信息仅用于身份核验与合规留痕；对公账号等敏感字段只保存掩码，前台与运营端都不展示明文。
            </p>
          </div>
          {view_certificationTarget && <div class="account-modal-mask" onClick={() => setCertificationTarget(null)}>
              <form class="account-modal" onClick={event => event.stopPropagation()} onSubmit={event => void submitEnterpriseCertification(event)}>
                <div class="account-card-head">
                  <h2>企业主体认证</h2>
                  <button type="button" class="account-modal-close" onClick={() => setCertificationTarget(null)}>×</button>
                </div>
                {view_certificationTarget.verifyStatus === 'rejected' && <div class="account-error">上次认证被驳回，请根据审核意见修改后重新提交。</div>}
                <div class="account-form-grid">
                  <label>企业名称<span class="account-required">*</span><input class="input" value={view_certificationForm.companyName} onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        companyName: (event.target as HTMLInputElement).value
                      })} /></label>
                  <label>统一社会信用代码<span class="account-required">*</span><input class="input" maxlength={18} value={view_certificationForm.creditCode} onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        creditCode: (event.target as HTMLInputElement).value.replace(/\s/g, '').toUpperCase()
                      })} /></label>
                  <label>法定代表人<span class="account-required">*</span><input class="input" value={view_certificationForm.legalPerson} placeholder="请输入法定代表人或经营者姓名" onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        legalPerson: (event.target as HTMLInputElement).value
                      })} /></label>
                  <label>营业执照号<input class="input" value={view_certificationForm.licenseNo} placeholder="如与统一社会信用代码相同可留空" onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        licenseNo: (event.target as HTMLInputElement).value
                      })} /></label>
                  <label>注册资本<input class="input" value={view_certificationForm.registeredCapital} placeholder="如：5000 万元" onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        registeredCapital: (event.target as HTMLInputElement).value
                      })} /></label>
                  <label>联系人姓名<span class="account-required">*</span><input class="input" value={view_certificationForm.contactName} onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        contactName: (event.target as HTMLInputElement).value
                      })} /></label>
                  <label>联系电话<span class="account-required">*</span><input class="input" maxlength={11} value={view_certificationForm.contactPhone} onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        contactPhone: (event.target as HTMLInputElement).value.replace(/\D/g, '')
                      })} /></label>
                  <label>对公账户户名<span class="account-required">*</span><input class="input" value={view_certificationForm.corporateBankName} onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        corporateBankName: (event.target as HTMLInputElement).value
                      })} /></label>
                  <label>对公账户账号<span class="account-required">*</span><input class="input" value={view_certificationForm.corporateBankAccount} placeholder="仅保存账户掩码" onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        corporateBankAccount: (event.target as HTMLInputElement).value.replace(/[^\d\s]/g, '')
                      })} /></label>
                  <label>对公打款金额<span class="account-required">*</span><input class="input" value={view_certificationForm.corporateTransferAmount} placeholder="如：0.37" onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        corporateTransferAmount: (event.target as HTMLInputElement).value.replace(/[^\d.]/g, '')
                      })} /></label>
                  <label>对公打款流水号<span class="account-required">*</span><input class="input" value={view_certificationForm.corporateTransferReference} onInput={event => setCertificationForm({
                        ...view_certificationForm,
                        corporateTransferReference: (event.target as HTMLInputElement).value
                      })} /></label>
                </div>
                  <div class="certification-documents">
                    {[{
                      kind: 'business_license',
                      title: '营业执照照片',
                      hint: '请上传完整、清晰且在有效期内的营业执照',
                      url: view_certificationForm.businessLicenseUrl,
                      field: 'businessLicenseUrl' as const
                    }, {
                      kind: 'legal_person_face',
                      title: '法定代表人扫脸',
                      hint: '调用摄像头采集，用于法人实名核验',
                      url: view_certificationForm.legalPersonFaceUrl,
                      field: 'legalPersonFaceUrl' as const
                    }, {
                      kind: 'corporate_transfer_proof',
                      title: '对公打款凭证',
                      hint: '上传银行回单，平台财务复核账户归属',
                      url: view_certificationForm.corporateTransferProofUrl,
                      field: 'corporateTransferProofUrl' as const
                    }].map(document => <div class="certification-document" key={document.kind}>
                        <div class="certification-document-head">
                          <strong>{document.title}<span class="account-required">*</span></strong>
                          <small>{document.hint}</small>
                        </div>
                        {document.url ? <div class="certification-document-preview">
                            <img src={document.url} alt={document.title} />
                            <div>
                              <span>已上传</span>
                              <label class="certification-replace">
                                {view_certificationUploading === document.kind ? '上传中…' : '重新上传'}
                                <input type="file" accept="image/jpeg,image/png,image/webp" capture={document.kind === 'legal_person_face' ? 'user' : undefined} disabled={view_busy || Boolean(view_certificationUploading)} onInput={event => {
                              const file = (event.target as HTMLInputElement).files?.[0];
                              if (file) void uploadCertificationDocument(document.kind, file);
                              (event.currentTarget as HTMLInputElement).value = '';
                            }} />
                              </label>
                            </div>
                          </div> : <label class="certification-upload">
                            <span>{view_certificationUploading === document.kind ? '正在上传…' : '选择图片'}</span>
                            <small>JPG / PNG / WEBP，不超过 5MB</small>
                            <input type="file" accept="image/jpeg,image/png,image/webp" capture={document.kind === 'legal_person_face' ? 'user' : undefined} disabled={view_busy || Boolean(view_certificationUploading)} onInput={event => {
                          const file = (event.target as HTMLInputElement).files?.[0];
                          if (file) void uploadCertificationDocument(document.kind, file);
                          (event.currentTarget as HTMLInputElement).value = '';
                        }} />
                          </label>}
                      </div>)}
                  </div>
                  <label>认证材料说明<textarea class="input account-textarea" value={view_certificationForm.attachNote} placeholder="可填写经营范围、资质说明及需平台核验的其他信息" onInput={event => setCertificationForm({
                      ...view_certificationForm,
                      attachNote: (event.target as HTMLInputElement).value
                    })} /></label>
                <p class="muted">提交后进入平台审核；审核通过前不会改变主体已有业务权限。</p>
                <div class="account-form-actions">
                  <button class="btn btn-primary" disabled={view_busy || Boolean(view_certificationUploading)}>{view_busy ? '提交中…' : view_certificationUploading ? '图片上传中…' : '提交认证审核'}</button>
                  <button type="button" class="btn btn-ghost" onClick={() => setCertificationTarget(null)}>取消</button>
                </div>
              </form>
            </div>}
        </div>}

      {view_tab === 'org' && <div class="account-business-layout">
          <div class="card account-card uc-org-hero">
            <div class="uc-org-hero-main">
              <span class="uc-org-hero-icon"><Icon name="factory" size={22} /></span>
              <div>
                <h2>{activeMerchant?.merchantName ?? '还没有经营主体'}</h2>
                <p>{activeMerchant ? `${activeMerchant.memberType === 'personal' ? '个人主体' : '企业主体'} · 我的角色：${activeMerchant.roleInMerchant} · 主体编码 ${activeMerchant.merchantCode || '—'}` : '创建企业主体后可开展交易、签约与认证；也可以直接申请加入已有主体。'}</p>
              </div>
            </div>
            <div class="uc-org-hero-actions">
              <span class={`account-status ${tone(activeMerchant?.verifyStatus ?? null)}`}>{statusText(activeMerchant?.verifyStatus ?? null)}</span>
              <button type="button" class="btn btn-outline btn-sm" onClick={() => setTab('enterprise')}>企业实名</button>
              <button type="button" class="btn btn-outline btn-sm" onClick={() => setTab('team')}>成员管理</button>
              <button type="button" class="btn btn-outline btn-sm" onClick={() => setTab('roles')}>角色权限</button>
            </div>
          </div>

          <div class="card account-card uc-org-identity">
            <div class="account-card-head">
              <h2>业务身份</h2>
              <span>一个账号可同时持有多个；审核通过后开通对应业务能力，但不改变主体权限</span>
            </div>
            <p class="uc-muted">
              业务身份是你在平台上对外声明的业务角色（批发商 / 零售商 / 农户等），审核通过后自动开通对应业务能力（见下方「已开通能力」），
              业务接口按能力放行；它不改变主体权限——你在主体内的角色与数据范围仍由下方主体列表与「成员管理」维护。
            </p>
            <IdentityApply />
          </div>

          <div class="card account-card">
            <div class="account-card-head">
              <h2>我的经营主体</h2>
              <div class="account-form-actions">
                <span>{view_summary.merchants.length} 个</span>
                <button class="btn btn-outline btn-sm" onClick={() => openCreateBusiness('enterprise')}>创建企业主体</button>
                <button class="btn btn-outline btn-sm" onClick={() => openCreateBusiness('personal')}>创建个人主体</button>
              </div>
            </div>
            {view_summary.merchants.length === 0 ? <div class="account-business-empty">
                <p>当前账号还没有经营主体，可注册个人或企业主体，也可以申请加入已有主体。</p>
                <div><button class="btn btn-primary" onClick={() => openCreateBusiness('personal')}>创建个人主体</button><button class="btn btn-outline" onClick={() => openCreateBusiness('enterprise')}>创建企业主体</button></div>
              </div> : <div class="merchant-list">
                <p class="merchant-active-note">
                  同一时间仅有一个主体处于登录状态；切换后交易、生产管理等业务数据范围同步切换。
                </p>
                {view_summary.merchants.map(merchant => <div class={`merchant-row ${merchant.merchantId === view_summary.activeMerchantId ? 'active' : ''}`} key={merchant.bindingId}>
                    <div class="merchant-main">
                      <div class="merchant-title">
                        <strong>{merchant.merchantName}</strong>
                        <span>{merchant.memberType === 'personal' ? '个人主体' : '企业主体'} · {merchant.roleInMerchant}</span>
                        {merchant.merchantId === view_summary.activeMerchantId && <span class="merchant-active-badge">当前登录主体</span>}
                      </div>
                      <div class="merchant-detail-grid">
                        <div><span>主体编码</span><b>{merchant.merchantCode || '—'}</b></div>
                        <div><span>经营主体 ID</span><b>{merchant.merchantId}</b></div>
                        <div><span>{merchant.memberType === 'personal' ? '经营类型' : '所属行业'}</span><b>{merchant.memberType === 'personal' ? merchant.businessType || '—' : merchant.industry || '—'}</b></div>
                        <div><span>{merchant.memberType === 'personal' ? '身份证号' : '统一社会信用代码'}</span><b>{merchant.creditCodeMasked || '—'}</b></div>
                        <div><span>联系人</span><b>{merchant.contactName || '—'}</b></div>
                        <div><span>联系电话</span><b>{merchant.contactPhone || '—'}</b></div>
                        {merchant.memberType !== 'personal' && <div><span>企业规模</span><b>{merchant.companySize || '—'}</b></div>}
                        <div><span>主体状态</span><b>{merchant.status === 0 ? '停用' : '正常'}</b></div>
                      </div>
                      {merchant.address && <p class="merchant-address">注册地址：{merchant.address}</p>}
                      {merchant.verifyRemark && <p class="merchant-review">审核意见：{merchant.verifyRemark}</p>}
                      {merchant.certification && <div class="certification-track">
                          <span>认证单号</span><b>{merchant.certification.certNo}</b>
                          <span>提交时间</span><b>{String(merchant.certification.submitTime).replace('T', ' ').slice(0, 16)}</b>
                          {merchant.certification.legalPerson && <><span>法定代表人</span><b>{merchant.certification.legalPerson}</b></>}
                          {merchant.certification.reviewTime && <><span>审核时间</span><b>{String(merchant.certification.reviewTime).replace('T', ' ').slice(0, 16)}</b></>}
                        </div>}
                    </div>
                    <div class="merchant-row-actions">
                      <span class={`account-status ${tone(merchant.verifyStatus)}`}>{statusText(merchant.verifyStatus)}</span>
                      {merchant.merchantId !== view_summary.activeMerchantId && <button class="btn btn-outline btn-sm" disabled={view_busy || Boolean(view_switchingMerchantId) || merchant.status === 0} onClick={() => void activateMerchant(merchant)}>
                          {view_switchingMerchantId === merchant.merchantId ? '切换中…' : '切换为此主体'}
                        </button>}
                      {merchant.verifyStatus !== 'approved' && merchant.verifyStatus !== 'pending' && <button class="btn btn-primary btn-sm" disabled={view_busy} onClick={() => void startCertification(merchant)}>
                          {merchant.memberType === 'personal' ? '去实名认证' : merchant.verifyStatus === 'rejected' ? '重新认证' : '去认证'}
                        </button>}
                    </div>
                  </div>)}
              </div>}
          </div>

          <div class="card account-card account-join-card">
            <div class="account-card-head"><h2>申请加入经营主体</h2><span>需要主体负责人审批</span></div>
            <form class="account-business-search" onSubmit={event => void searchBusiness(event)}>
              <input class="input" value={view_businessKeyword} placeholder="输入企业名称、编码或信用代码" onInput={event => setBusinessKeyword((event.target as HTMLInputElement).value)} />
              <button class="btn btn-primary">搜索</button>
            </form>
            <div class="account-form-grid">
              <label>申请角色<select class="select" value={view_joinRole} onChange={event => setJoinRole((event.target as HTMLInputElement).value)}><option value="buyer">采购</option><option value="seller">销售</option><option value="finance">财务</option></select></label>
              <label>申请说明<input class="input" value={view_joinMessage} onInput={event => setJoinMessage((event.target as HTMLInputElement).value)} placeholder="职位、负责业务等" /></label>
            </div>
            <div class="business-results">
              {view_businessResults.map(business => <div class="business-result" key={business.merchantId}>
                  <div><strong>{business.name}</strong><span>{business.memberType === 'personal' ? '个人主体' : '企业主体'} · {business.industry || '行业未填写'} · {business.creditCodeMasked || '证件未公开'}</span></div>
                  <button class="btn btn-outline" disabled={business.alreadyJoined || view_busy} onClick={() => void requestJoin(business)}>
                    {business.alreadyJoined ? '已加入/已申请' : '申请加入'}
                  </button>
                </div>)}
              {!view_businessResults.length && <p class="muted">搜索后显示可申请加入的主体。</p>}
            </div>
          </div>

          <div class="card account-card">
            <div class="account-card-head"><h2>我发出的加入申请</h2><span>{view_summary.sentJoinRequests.length} 条</span></div>
            <JoinList rows={view_summary.sentJoinRequests} onCancel={id => void cancelJoin(id)} />
          </div>

          {view_summary.reviewInbox.length > 0 && <div class="card account-card">
              <div class="account-card-head"><h2>待我审批</h2><span>{view_summary.reviewInbox.length} 条</span></div>
              <div class="join-list">
                {view_summary.reviewInbox.map(row => <div class="join-row" key={row.id}>
                    <div><strong>{row.applicantName}</strong><span>申请加入 {row.merchantName} · {row.requestedRole}</span><p>{row.message || '未填写说明'}</p></div>
                    <div><button class="btn btn-primary btn-sm" onClick={() => void reviewJoin(row.id, true)}>同意</button><button class="btn btn-ghost btn-sm" onClick={() => void reviewJoin(row.id, false)}>拒绝</button></div>
                  </div>)}
              </div>
            </div>}
          <div class="card account-card">
            <div class="account-card-head"><h2>组织协作</h2></div>
            <p class="uc-muted">成员、邀请与角色权限在「组织权限」分组里维护；本页只负责主体归属、切换和加入申请。</p>
            <div class="account-form-actions">
              <button class="btn btn-outline" onClick={() => setTab('team')}>成员管理</button>
              <button class="btn btn-outline" onClick={() => setTab('roles')}>我的角色与权限</button>
            </div>
          </div>

          {view_createBusinessOpen && <div class="account-modal-mask" onClick={() => setCreateBusinessOpen(false)}>
              <form class="account-modal" onClick={event => event.stopPropagation()} onSubmit={event => void createBusiness(event)}>
                <div class="account-card-head">
                  <h2>{view_createIdentity === 'enterprise' ? '创建企业主体' : '创建个人主体'}</h2>
                  <button type="button" class="account-modal-close" onClick={() => setCreateBusinessOpen(false)}>×</button>
                </div>
                <div class="account-form-grid">
                  {view_createIdentity === 'enterprise' ? <>
                      <label>企业名称<span class="account-required">*</span><input class="input" value={view_createBusinessForm.companyName} placeholder="与营业执照一致" onInput={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          companyName: (event.target as HTMLInputElement).value
                        })} /></label>
                      <label>统一社会信用代码<span class="account-required">*</span><input class="input" value={view_createBusinessForm.creditCode} maxlength={18} placeholder="15-18 位字母数字" onInput={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          creditCode: (event.target as HTMLInputElement).value.replace(/\s/g, '').toUpperCase()
                        })} /></label>
                      <label>所属行业<select class="select" value={view_createBusinessForm.industry} onChange={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          industry: (event.target as HTMLInputElement).value
                        })}>{INDUSTRIES.map(item => <option key={item}>{item}</option>)}</select></label>
                      <label>企业规模<select class="select" value={view_createBusinessForm.companySize} onChange={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          companySize: (event.target as HTMLInputElement).value
                        })}>{COMPANY_SIZES.map(item => <option key={item}>{item}</option>)}</select></label>
                      <label class="uc-address-field">注册地址<span class="account-required">*</span>
                        <div class="uc-address-grid">
                          <select class="select" value={view_addressRegion.province} aria-label="省份" onChange={event => setAddressRegion({
                            province: (event.target as HTMLInputElement).value,
                            city: '',
                            district: '',
                            detail: view_addressRegion.detail
                          })}>
                            <option value="">{view_regionLoading ? '加载中…' : '选择省份'}</option>
                            {(view_regionCatalog?.provinces ?? []).map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                          </select>
                          <select class="select" value={view_addressRegion.city} aria-label="城市" disabled={!view_addressRegion.province} onChange={event => setAddressRegion({
                            ...view_addressRegion,
                            city: (event.target as HTMLInputElement).value,
                            district: ''
                          })}>
                            <option value="">{view_addressRegion.province ? '选择城市' : '先选省份'}</option>
                            {cityOptions.map(item => <option key={item.code} value={item.code}>{displayCityName(item, provinceOption)}</option>)}
                          </select>
                          <select class="select" value={view_addressRegion.district} aria-label="区县" disabled={!view_addressRegion.city} onChange={event => setAddressRegion({
                            ...view_addressRegion,
                            district: (event.target as HTMLInputElement).value
                          })}>
                            <option value="">{view_addressRegion.city ? districtOptions.length ? '选择区县' : '该市暂无区县数据' : '先选城市'}</option>
                            {districtOptions.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                          </select>
                        </div>
                        <input class="input" value={view_addressRegion.detail} placeholder="详细地址：街道、门牌号（手工填写）" onInput={event => setAddressRegion({
                          ...view_addressRegion,
                          detail: (event.target as HTMLInputElement).value
                        })} />
                        {view_regionError && <small class="uc-field-error">{view_regionError}
                            <button type="button" class="uc-inline-link" onClick={() => void ensureRegionCatalog()}>重试</button>
                          </small>}
                        {composedAddress && <small class="uc-field-hint">将保存为：{composedAddress}</small>}
                        {!view_regionLoading && !view_regionError && (view_regionCatalog?.provinces?.length ?? 0) === 0 && <small class="uc-field-error">主数据里还没有行政区划数据，请联系运营在「系统配置 → 行政区划」维护。</small>}
                      </label>
                    </> : <>
                      <label>真实姓名<span class="account-required">*</span><input class="input" value={view_createBusinessForm.realName} placeholder="请输入真实姓名" onInput={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          realName: (event.target as HTMLInputElement).value
                        })} /></label>
                      <label>身份证号<span class="account-required">*</span><input class="input" value={view_createBusinessForm.idCard} maxlength={18} placeholder="18 位身份证号（仅存掩码与摘要）" onInput={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          idCard: (event.target as HTMLInputElement).value.replace(/\s/g, '').toUpperCase()
                        })} /></label>
                      <label>经营类型<select class="select" value={view_createBusinessForm.businessType} onChange={event => setCreateBusinessForm({
                          ...view_createBusinessForm,
                          businessType: (event.target as HTMLInputElement).value
                        })}>{BUSINESS_TYPES.map(item => <option key={item}>{item}</option>)}</select></label>
                    </>}
                  <label>联系人姓名<span class="account-required">*</span><input class="input" value={view_createBusinessForm.contactName} placeholder="用于接收重要通知" onInput={event => setCreateBusinessForm({
                        ...view_createBusinessForm,
                        contactName: (event.target as HTMLInputElement).value
                      })} /></label>
                </div>
                <p class="muted">创建后主体会出现在“我的经营主体”中；企业主体还需进入认证流程提交审核。</p>
                <div class="account-form-actions">
                  <button class="btn btn-primary" disabled={view_busy}>{view_busy ? '创建中…' : '创建主体'}</button>
                  <button type="button" class="btn btn-ghost" onClick={() => setCreateBusinessOpen(false)}>取消</button>
                </div>
              </form>
            </div>}
        </div>}

      {view_tab === 'team' && <TeamMembers merchantId={activeMerchant?.merchantId ?? null} merchantName={activeMerchant?.merchantName ?? null} onNotice={flash} onError={setError} />}

      {view_tab === 'roles' && <RolesPermissions merchantId={activeMerchant?.merchantId ?? null} merchantName={activeMerchant?.merchantName ?? null} onNotice={flash} onError={setError} />}
        </main>
      </div>
    </section>;
    };
  }
});
const JoinList = defineComponent({
  name: "JoinList",
  props: {
    rows: null as unknown as PropType<{
      rows: JoinRow[];
      onCancel: (id: string) => void;
    }["rows"]>,
    onCancel: null as unknown as PropType<{
      rows: JoinRow[];
      onCancel: (id: string) => void;
    }["onCancel"]>
  },
  setup(__props: {
    rows: JoinRow[];
    onCancel: (id: string) => void;
  }, {
    slots: __slots
  }) {
    return () => {
      const view_prop_rows = __props.rows;
      const view_prop_onCancel = __props.onCancel;
      if (!view_prop_rows.length) return <div class="empty">暂无申请记录</div>;
      return <div class="join-list">
      {view_prop_rows.map(row => <div class="join-row" key={row.id}>
          <div><strong>{row.merchantName}</strong><span>{row.requestedRole} · {String(row.createdAt).slice(0, 16).replace('T', ' ')}</span><p>{row.message || '未填写说明'}</p></div>
          <div class="join-row-status">
            <span class={`account-status ${tone(row.status)}`}>{row.status === 'pending' ? '待审批' : row.status === 'approved' ? '已同意' : row.status === 'rejected' ? '已拒绝' : row.status}</span>
            {row.status === 'pending' && <button type="button" class="btn btn-ghost btn-sm" onClick={() => view_prop_onCancel(row.id)}>撤回</button>}
          </div>
        </div>)}
    </div>;
    };
  }
});
