/* ============================================================
   农业产业互联网平台 · 产品原型共享脚本
   ============================================================ */
(function () {
  "use strict";

  /* ---------- SVG 图标库（Feather 风格 24x24） ---------- */
  var ICONS = {
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    truck: '<rect x="1" y="3" width="15" height="13"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    money: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    cpu: '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
    cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    location: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    close: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    spark: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.7 1.9L21.6 17.6 19.7 18.3 19 20.2 18.3 18.3 16.4 17.6 18.3 16.9z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
    thermo: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>',
    drop: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    factory: '<path d="M2 20h20"/><path d="M4 20V8l5 4V8l5 4V4h6v16"/><line x1="7" y1="17" x2="7" y2="17"/><line x1="12" y1="17" x2="12" y2="17"/>',
    seed: '<path d="M12 22V12"/><path d="M12 12C8 12 5 9 5 5c4 0 7 3 7 7z"/><path d="M12 15c3.5 0 6-2.5 6-6-3.5 0-6 2.5-6 6z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>',
    repo: '<path d="M4 4h13a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2z"/><path d="M4 4v14a2 2 0 0 0 2 2"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'
  };

  function hydrateIcons(root) {
    root = root || document;
    var nodes = root.querySelectorAll("[data-icon]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var name = el.getAttribute("data-icon");
      if (!ICONS[name]) continue;
      var size = el.getAttribute("data-size") || "18";
      el.innerHTML = '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size +
        '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        ICONS[name] + "</svg>";
    }
  }

  /* ---------- 时钟 ---------- */
  function startClock() {
    var nodes = document.querySelectorAll(".js-clock");
    if (!nodes.length) return;
    function tick() {
      var d = new Date();
      var p = function (n) { return (n < 10 ? "0" : "") + n; };
      var txt = d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
        " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
      for (var i = 0; i < nodes.length; i++) nodes[i].textContent = txt;
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- 数字滚动动画 ---------- */
  function runCounters() {
    var nodes = document.querySelectorAll(".js-count");
    for (var i = 0; i < nodes.length; i++) {
      (function (el) {
        var to = parseFloat(el.getAttribute("data-to") || el.textContent.replace(/[^\d.]/g, "")) || 0;
        var dec = (el.getAttribute("data-dec") || "0") | 0;
        var from = 0, dur = 900, t0 = null;
        function step(ts) {
          if (!t0) t0 = ts;
          var k = Math.min((ts - t0) / dur, 1);
          var e = 1 - Math.pow(1 - k, 3);
          var val = from + (to - from) * e;
          el.textContent = val.toFixed(dec);
          if (k < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      })(nodes[i]);
    }
  }

  /* ---------- Tabs ---------- */
  function bindTabs() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-tab]");
      if (!btn) return;
      var group = btn.getAttribute("data-tab-group");
      var sel = btn.getAttribute("data-tab");
      var scope = group ? document.querySelector('[data-tabscope="' + group + '"]') : document;
      if (!scope) return;
      scope.querySelectorAll("[data-tab]").forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      var panels = (group ? document.querySelector('[data-panels="' + group + '"]') : document)
        .querySelectorAll("[data-tabpanel]");
      panels.forEach(function (p) {
        p.classList.toggle("hide", p.getAttribute("data-tabpanel") !== sel);
      });
    });
  }

  /* ---------- 筛选 chips 单选 ---------- */
  function bindChips() {
    document.addEventListener("click", function (e) {
      var chip = e.target.closest(".chips .chip");
      if (!chip) return;
      chip.parentElement.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("on"); });
      chip.classList.add("on");
    });
  }

  /* ---------- 分页（原型仅做高亮切换） ---------- */
  function bindPager() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest(".pager button");
      if (!btn) return;
      var pager = btn.parentElement;
      var isNum = /^\d+$/.test(btn.textContent.trim());
      if (!isNum) return; /* 上一页/下一页暂不联动（静态原型） */
      pager.querySelectorAll("button").forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
    });
  }

  /* ---------- 顶部搜索占位交互 ---------- */
  /* 依据本页 script 的引用路径推导原型根目录前缀，兼容根目录与各级子目录 */
  function basePrefix() {
    var s = document.querySelector('script[src*="assets/js/app.js"]');
    if (!s) return "";
    return s.getAttribute("src").replace(/assets\/js\/app\.js.*$/, "");
  }

  function bindSearch() {
    var prefix = basePrefix();
    document.querySelectorAll(".header-search input, .m-search").forEach(function (el) {
      el.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { window.location.href = prefix + "trade/index.html"; }
      });
    });
  }

  /* ---------- 登录态（localStorage） ---------- */
  var AUTH_KEY = "agri_cloud_user";
  function Auth() {
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || "null"); }
    catch (e) { return null; }
  }
  function setAuth(u) {
    if (u) localStorage.setItem(AUTH_KEY, JSON.stringify(u));
    else localStorage.removeItem(AUTH_KEY);
  }
  function loginUser(u) {
    if (!u || !u.name) u = { name: "农产云用户", phone: "", identity: "enterprise", time: Date.now() };
    u.time = Date.now();
    setAuth(u);
  }
  function logoutUser() { setAuth(null); }
  function isLoggedIn() { return !!Auth(); }

  /* 依据当前页面 script src 推导原型根相对前缀 */
  function topbarPrefix() {
    var s = document.querySelector('script[src*="assets/js/app.js"]');
    if (!s) return "portal/";
    var src = s.getAttribute("src");
    // 去掉末尾 assets/js/app.js 后的部分
    var prefix = src.replace(/assets\/js\/app\.js.*$/, "");
    // topbar 里已有 "portal/login.html" 这种引用：如果当前在 portal/ 下，prefix 是 "../"，要替换成 "../portal/"
    // 最简单：把旧 href 里的 "portal/" 替换为空（同级），否则用 "../portal/"
    // 这里统一：入口链接相对于 portal/ 目录，所以从根路径开始写 portal/login.html，从子路径 (trade/) 写 ../portal/login.html
    return prefix;
  }

  /* ---------- 顶部通栏登录入口自动渲染 ----------
     所有 .topbar 都带一个带 data-auth-placeholder 的容器，
     初始静态 HTML 里保留 <a href="...">登录</a> 和 <a href="...">免费注册</a>，
     本函数在 DOMContentLoaded 时：
       - 未登录 → 保留静态内容即可（做兜底，把 placeholder 替换成标准入口）
       - 已登录 → 替换为 头像 + 用户名 + 退出
  */
  function renderTopbarAuth() {
    var prefix = topbarPrefix();
    // 登录/注册链接的相对路径：
    //   - 根目录 index.html: prefix="" → "portal/login.html"
    //   - portal/*.html: prefix="../" → "../portal/login.html" (但 portal 目录内应该是同级)
    //   - trade/*.html / module/*.html / mobile/*.html / production/*.html: prefix="../" → "../portal/login.html"
    // portal/ 目录内没有 .topbar，所以统一用 prefix + "portal/login.html" 不对
    // 方案：读现有 topbar 中登录入口的 href，用它作为基准
    var placeholders = document.querySelectorAll(".topbar");
    for (var i = 0; i < placeholders.length; i++) {
      var bar = placeholders[i];
      // 找 bar 内最后一个 <span> 容器（里面放了入口）
      var container = null;
      var spans = bar.querySelectorAll(".container > span");
      // 取包含 "登录" 或 "login" 文本的那个 span
      for (var j = 0; j < spans.length; j++) {
        if (/login|登录/i.test(spans[j].textContent) || /register|注册/i.test(spans[j].textContent)) {
          container = spans[j]; break;
        }
      }
      if (!container) continue;

      var user = Auth();
      if (user) {
        // 已登录 → 头像 + 用户名 + 会员中心 + 退出
        var initial = (user.name || "农").trim().charAt(0);
        var html = '<a href="' + prefix + 'trade/member.html" style="display:inline-flex;align-items:center;gap:6px">' +
          '<span style="width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#2FB877,#0EA5E9);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:700">' + initial + '</span>' +
          '<span style="max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + user.name + '</span>' +
          '</a>' +
          '<span class="sep">·</span>' +
          '<a href="' + prefix + 'trade/member.html">会员中心</a>' +
          '<span class="sep">·</span>' +
          '<a href="javascript:void(0)" data-auth-action="logout" style="color:#FFD166">退出</a>';
        container.innerHTML = html;
      } else {
        // 未登录：确保入口存在（兜底）
        if (!/login|登录/i.test(container.textContent)) {
          container.innerHTML += '<span class="sep">·</span>' +
            '<a href="' + prefix + 'portal/login.html" data-icon="user" data-size="12" style="vertical-align:-2px;margin-right:3px"></span>' +
            '<a href="' + prefix + 'portal/login.html"><span data-icon="user" data-size="12" style="vertical-align:-2px;margin-right:3px"></span>登录</a>' +
            '<span class="sep">·</span>' +
            '<a href="' + prefix + 'portal/register.html"><span data-icon="plus" data-size="12" style="vertical-align:-2px;margin-right:3px"></span>免费注册</a>';
          hydrateIcons(container);
        }
      }
    }
  }

  /* 全局委托：退出按钮 */
  document.addEventListener("click", function (e) {
    var a = e.target.closest("[data-auth-action='logout']");
    if (a) {
      e.preventDefault();
      logoutUser();
      try { localStorage.removeItem(AUTH_KEY); } catch (err) {}
      // 刷新当前页以渲染未登录态
      location.reload();
    }
  });

  /* ---------- 产业链三级分类数据：一级产业 → 二级品类 → 三级品种 ---------- */
  var TAXONOMY = {
    "粮油产业": { l2: {
      "稻谷·大米": ["粳稻谷", "籼稻谷", "富硒大米", "有机大米"],
      "小麦·面粉": ["强筋小麦", "中筋小麦", "高筋面粉"],
      "玉米": ["优质蛋白玉米", "鲜食玉米", "工业玉米"],
      "大豆": ["黄大豆", "高蛋白大豆", "黑大豆"],
      "油脂": ["一级菜籽油", "一级大豆油", "压榨花生油", "玉米胚芽油"]
    } },
    "果蔬产业": { l2: {
      "柑橘": ["赣南脐橙", "砂糖橘", "沃柑"],
      "苹果": ["洛川苹果", "红富士", "花牛苹果"],
      "设施蔬菜": ["番茄", "黄瓜", "螺丝椒"],
      "食用菌": ["香菇", "平菇", "金针菇"]
    } },
    "畜禽产业": { l2: {
      "生猪": ["冷鲜猪肉(白条)", "分割猪肉", "生猪(活体)"],
      "肉牛": ["冷鲜牛肉", "牛肉(分割)", "育肥牛"],
      "家禽": ["白羽肉鸡", "土鸡", "蛋鸡"],
      "蛋奶": ["鲜鸡蛋", "生鲜乳", "全脂奶粉"]
    } },
    "茶药产业": { l2: {
      "茶叶": ["有机红茶", "西湖龙井", "普洱茶", "福鼎白茶"],
      "中药材": ["三七", "枸杞", "当归", "黄芪"]
    } },
    "饲料农资": { l2: {
      "饲料": ["豆粕43%", "玉米蛋白粉", "进口鱼粉", "预混料"],
      "化肥": ["尿素", "复合微生物肥", "磷酸二铵", "氯化钾"],
      "农药": ["生物农药", "除草剂", "杀菌剂"],
      "种子": ["杂交玉米种", "水稻种子", "蔬菜种子"]
    } },
    "水产产业": { l2: {
      "淡水鱼": ["加州鲈鱼", "草鱼", "鲫鱼"],
      "海水养殖": ["大黄鱼", "石斑鱼", "大西洋鲑"],
      "虾蟹": ["南美白对虾", "大闸蟹", "小龙虾"],
      "贝藻": ["海参", "生蚝", "海带"]
    } },
    "预制菜": { l2: {
      "净菜": ["免洗蔬菜", "鲜切水果", "净菜套餐"],
      "即烹": ["调味牛排", "调理包", "预制汤品"],
      "即食": ["卤味", "罐头", "自热米饭"]
    } },
    "冷链物流": { l2: {
      "冷链仓储": ["冷库租赁", "低温仓配", "气调库"],
      "冷链运输": ["冷藏干线", "冷链城配", "冷链零担"],
      "冷链设备": ["冷藏车", "冷藏集装箱", "保温箱"]
    } }
  };

  /* ---------- 全国 34 省级行政区（按官方行政区划代码顺序） ----------
     group：大区分组，便于 UI 折叠分组显示 */
  var PROVINCES = [
    /* 华北 */
    { code: 11, name: "北京", group: "华北" },
    { code: 12, name: "天津", group: "华北" },
    { code: 13, name: "河北", group: "华北" },
    { code: 14, name: "山西", group: "华北" },
    { code: 15, name: "内蒙古", group: "华北" },
    /* 东北 */
    { code: 21, name: "辽宁", group: "东北" },
    { code: 22, name: "吉林", group: "东北" },
    { code: 23, name: "黑龙江", group: "东北" },
    /* 华东 */
    { code: 31, name: "上海", group: "华东" },
    { code: 32, name: "江苏", group: "华东" },
    { code: 33, name: "浙江", group: "华东" },
    { code: 34, name: "安徽", group: "华东" },
    { code: 35, name: "福建", group: "华东" },
    { code: 36, name: "江西", group: "华东" },
    { code: 37, name: "山东", group: "华东" },
    /* 华中 */
    { code: 41, name: "河南", group: "华中" },
    { code: 42, name: "湖北", group: "华中" },
    { code: 43, name: "湖南", group: "华中" },
    /* 华南 */
    { code: 44, name: "广东", group: "华南" },
    { code: 45, name: "广西", group: "华南" },
    { code: 46, name: "海南", group: "华南" },
    /* 西南 */
    { code: 50, name: "重庆", group: "西南" },
    { code: 51, name: "四川", group: "西南" },
    { code: 52, name: "贵州", group: "西南" },
    { code: 53, name: "云南", group: "西南" },
    { code: 54, name: "西藏", group: "西南" },
    /* 西北 */
    { code: 61, name: "陕西", group: "西北" },
    { code: 62, name: "甘肃", group: "西北" },
    { code: 63, name: "青海", group: "西北" },
    { code: 64, name: "宁夏", group: "西北" },
    { code: 65, name: "新疆", group: "西北" },
    /* 港澳台 */
    { code: 71, name: "台湾", group: "港澳台" },
    { code: 81, name: "香港", group: "港澳台" },
    { code: 82, name: "澳门", group: "港澳台" }
  ];

  window.PROTO = {
    hydrateIcons: hydrateIcons,
    ICONS: ICONS,
    TAXONOMY: TAXONOMY,
    PROVINCES: PROVINCES,
    Auth: {
      get: Auth,
      login: loginUser,
      logout: logoutUser,
      isLoggedIn: isLoggedIn
    }
  };

  document.addEventListener("DOMContentLoaded", function () {
    hydrateIcons();
    startClock();
    runCounters();
    bindTabs();
    bindChips();
    bindPager();
    bindSearch();
    renderTopbarAuth();
    // renderTopbarAuth 重写 innerHTML 后需要再 hydrate 一次
    hydrateIcons();
  });
})();
