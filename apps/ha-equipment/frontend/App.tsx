/** @jsxRuntime automatic */
/* eslint-disable react-perf/jsx-no-new-object-as-prop */

import { Routes, Route } from 'react-router-dom'
import { Layout } from './pages/ui/Layout'
import Equipment from './pages/Equipment'
import EquipmentDetail from './pages/EquipmentDetail'
import Intake from './pages/Intake'
import IntakeDetail from './pages/IntakeDetail'
import NeedsChecking from './pages/NeedsChecking'
import Bins from './pages/Bins'
import BinDetail from './pages/BinDetail'
import HaDiscovery from './pages/HaDiscovery'
import Audit from './pages/Audit'
import Settings from './pages/Settings'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Equipment />} />
        <Route path="/equipment/:equipmentId" element={<EquipmentDetail />} />
        <Route path="/intake" element={<Intake />} />
        <Route path="/intake/:intakeId" element={<IntakeDetail />} />
        <Route path="/needs-checking" element={<NeedsChecking />} />
        <Route path="/bins" element={<Bins />} />
        <Route path="/bins/:binId" element={<BinDetail />} />
        <Route path="/ha" element={<HaDiscovery />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Equipment />} />
      </Routes>
    </Layout>
  )
}
/* eslint-enable react-perf/jsx-no-new-object-as-prop */
