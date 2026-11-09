async function debug() {
  const loginRes = await fetch('http://localhost:8093/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 })
  });
  const token = (await loginRes.json()).data.accessToken;

  // 1. Finance Fund Workbench
  const finRes = await fetch('http://localhost:8087/api/v1/fund-workbench/mine', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Finance Workbench:', await finRes.text());

  // 2. Info Articles
  const infoRes = await fetch('http://localhost:8096/api/v1/info/public/articles?page=1&size=10');
  console.log('Info Articles:', await infoRes.text());
}
debug();
