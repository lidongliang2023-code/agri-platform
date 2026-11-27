<template>
  <main class="signed-out">
    <section class="m-card m-card-pad" aria-labelledby="signed-out-title">
      <h1 id="signed-out-title">已退出商城</h1>
      <p>查询订单或购物车时，请重新登录。</p>
      <div class="m-row-wrap">
        <a class="m-btn primary" href="/">重新登录</a>
        <a class="m-btn ghost" href="/trace">查询溯源码</a>
      </div>
    </section>
  </main>
</template>

<style scoped>
.signed-out { min-height: 80vh; display: grid; place-items: center; padding: 24px; }
.signed-out section { width: min(100%, 420px); box-sizing: border-box; }
.signed-out h1 { margin-top: 0; }
.signed-out p { margin-bottom: 24px; }
</style>
