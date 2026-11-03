<template>
  <footer class="m-footer">
    <div class="m-container">
      <div class="m-footer-main">
        <div>
          <div class="ft-brand">
            <span class="lg">🌾</span>
            <span class="txt">农联优选</span>
          </div>
          <p class="brand-desc">
            农业产业互联网平台 S2B2C 消费者端。基地直供、一物一码、全程可溯源；下单后由产地供应商直发，
            售后由平台统一兜底。
          </p>
          <div class="ft-badges">
            <span>产地直供</span>
            <span>一物一码</span>
            <span>48h 发货</span>
          </div>
        </div>
        <div>
          <h5>关于我们</h5>
          <ul>
            <li>平台介绍</li>
            <li>产地合作</li>
            <li>助农专区</li>
            <li>加入我们</li>
          </ul>
        </div>
        <div>
          <h5>购物指南</h5>
          <ul>
            <li>购物流程</li>
            <li>会员权益</li>
            <li>积分规则</li>
            <li>常见问题</li>
          </ul>
        </div>
        <div>
          <h5>售后服务</h5>
          <ul>
            <li>退换货政策</li>
            <li>售后申请入口</li>
            <li>物流查询</li>
            <li>客服 400-800-0000</li>
          </ul>
        </div>
      </div>
      <div class="m-footer-bar">
        <span>© 2026 农联优选 · 农业产业互联网平台</span>
        <span>消费者端 v1.0 · 数据来源：S2B2C 消费者域接口</span>
      </div>
    </div>
  </footer>
</template>

<script setup></script>

<style scoped>
.ft-brand {
  display: flex;
  align-items: center;
  gap: 9px;
  color: #12764a;
  font-size: 17px;
  font-weight: 800;
}

.ft-brand .lg {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, #12764a, #4fb07f);
  font-size: 17px;
}

.ft-badges {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.ft-badges span {
  padding: 3px 9px;
  border: 1px solid #e3eae5;
  border-radius: 20px;
  background: #f8fbf9;
  color: #6b7c72;
  font-size: var(--agri-font-size-micro);
}
</style>
