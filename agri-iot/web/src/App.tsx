import { Routes, Route } from 'react-router-dom'
import Login from './pages/login'
import AppLayout from './pages/layout'
import Dashboard from './pages/dashboard'
import DeviceList from './pages/device/list'
import DeviceDetail from './pages/device/detail'
import PlotList from './pages/plot/list'
import AlertList from './pages/alert/list'
import AlertRule from './pages/alert/rule'
import GroupList from './pages/group/list'
import ReportList from './pages/report/list'
import RuleList from './pages/rule/list'
import RuleConfig from './pages/rule/config'
import PushConfig from './pages/push/config'
import PushMessage from './pages/push/message'
import SceneList from './pages/scene/list'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/devices" element={<DeviceList />} />
        <Route path="/devices/:id" element={<DeviceDetail />} />
        <Route path="/plots" element={<PlotList />} />
        <Route path="/alerts" element={<AlertList />} />
        <Route path="/alert-rules" element={<AlertRule />} />
        <Route path="/groups" element={<GroupList />} />
        <Route path="/reports" element={<ReportList />} />
        <Route path="/rules" element={<RuleList />} />
        <Route path="/rules/config" element={<RuleConfig />} />
        <Route path="/push/config" element={<PushConfig />} />
        <Route path="/push/messages" element={<PushMessage />} />
        <Route path="/scenes" element={<SceneList />} />
      </Route>
    </Routes>
  )
}

export default App
