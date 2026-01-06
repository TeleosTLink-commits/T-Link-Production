import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import TestMethods from './pages/TestMethods';
import CoAManagement from './pages/CoAManagement';
import SampleInventory from './pages/SampleInventory';
import Shipments from './pages/Shipments';
import ManufacturerPortal from './pages/ManufacturerPortal';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const token = localStorage.getItem('auth_token');

  return (
    <Router>
      <ToastContainer position="top-right" autoClose={3000} />
      <Routes>
        <Route path="/login" element={!token ? <Login /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!token ? <Register /> : <Navigate to="/dashboard" />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="test-methods" element={<TestMethods />} />
          <Route path="coa" element={<CoAManagement />} />
          <Route path="inventory" element={<SampleInventory />} />
          <Route path="shipments" element={<Shipments />} />
          <Route path="manufacturer" element={<ManufacturerPortal />} />
        </Route>

        <Route path="*" element={<Navigate to={token ? '/dashboard' : '/login'} />} />
      </Routes>
    </Router>
  );
}

export default App;
