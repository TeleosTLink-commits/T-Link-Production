import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TestMethods from './pages/TestMethods';
import SampleInventory from './pages/SampleInventory';
import Shipments from './pages/Shipments';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
// Manufacturer portal components
import ManufacturerSignUp from './pages/manufacturer/ManufacturerSignUp';
import ManufacturerDashboard from './pages/manufacturer/ManufacturerDashboard';
import CoALookup from './pages/manufacturer/CoALookup';
import InventorySearch from './pages/manufacturer/InventorySearch';
import ShipmentRequest from './pages/manufacturer/ShipmentRequest';
import MyShipments from './pages/manufacturer/MyShipments';
import SupportForms from './pages/manufacturer/SupportForms';
// Internal lab staff components
import ProcessingDashboard from './pages/internal/ProcessingDashboard';
import ProcessingView from './pages/internal/ProcessingView';
import TrackingView from './pages/internal/TrackingView';
import SupplyInventory from './pages/internal/SupplyInventory';
import HazmatWarning from './pages/internal/HazmatWarning';
import AdminPanel from './pages/internal/AdminPanel';

function App() {
  const token = localStorage.getItem('auth_token');

  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/dashboard" />} />
        <Route path="/manufacturer/signup" element={!token ? <ManufacturerSignUp /> : <Navigate to="/manufacturer/dashboard" />} />
        
        {/* Protected Routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          
          {/* Internal Dashboard & Pages */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="test-methods" element={<TestMethods />} />
          <Route path="inventory" element={<SampleInventory />} />
          <Route path="shipments" element={<Shipments />} />
          
          {/* Manufacturer Portal Pages */}
          <Route path="manufacturer/dashboard" element={<ManufacturerDashboard />} />
          <Route path="manufacturer/coa-lookup" element={<CoALookup />} />
          <Route path="manufacturer/inventory-search" element={<InventorySearch />} />
          <Route path="manufacturer/shipment-request" element={<ShipmentRequest />} />
          <Route path="manufacturer/my-shipments" element={<MyShipments />} />
          <Route path="manufacturer/support" element={<SupportForms />} />
          
          {/* Internal Lab Staff Pages */}
          <Route path="internal/processing-dashboard" element={<ProcessingDashboard />} />
          <Route path="internal/processing/shipment/:id" element={<ProcessingView />} />
          <Route path="internal/tracking/:id" element={<TrackingView />} />
          <Route path="internal/supplies" element={<SupplyInventory />} />
          <Route path="internal/hazmat-processing" element={<HazmatWarning />} />
          <Route path="internal/admin" element={<AdminPanel />} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} />} />
      </Routes>
    </Router>
  );
}

export default App;
