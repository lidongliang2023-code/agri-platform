import { Route, Routes } from 'react-router-dom'
import MobileTrade from '@/pages/mobile-trade'
import SsoCallback from './pages/sso/callback'

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/sso/callback" element={<SsoCallback />} />
      <Route path="*" element={<MobileTrade />} />
    </Routes>
  )
}
