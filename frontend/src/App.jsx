import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home/Home.jsx';
import Users from './pages/Users/Users.jsx';
import CustomerDetails from './pages/CustomerDetails/CustomerDetails.jsx';
import CustomerEdit from './pages/CustomerEdit/CustomerEdit.jsx';
import CustomerAdd from './pages/CustomerAdd/CustomerAdd.jsx';
import SurvivalAnalysis from './pages/SurvivalAnalysis/SurvivalAnalysis.jsx';
import Layout from './components/Layout/Layout.jsx';
import Login from './pages/Login/Login.jsx';
import Unauthorized from './pages/Unauthorized/Unauthorized.jsx';
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute.jsx';
import AdminUsers from './pages/AdminUsers/AdminUsers.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { SidebarProvider } from './context/SidebarContext.jsx';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import HistoricalAnalytics from './pages/HistoricalAnalytics/HistoricalAnalytics';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SidebarProvider>
          <div className="App">
            <ToastContainer position="top-right" />
            <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            
            {/* Protected routes - accessible to all logged in users */}
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={
                <Layout>
                  <Home />
                </Layout>
              } />
              
              <Route path="/users" element={
                <Layout>
                  <Users />
                </Layout>
              } />
              
              <Route path="/customer/:id" element={
                <Layout>
                  <CustomerDetails />
                </Layout>
              } />
              
              <Route path="/survival-analysis" element={
                <Layout>
                  <SurvivalAnalysis />
                </Layout>
              } />
              
              <Route path="/historical-analytics" element={
                <Layout>
                  <HistoricalAnalytics />
                </Layout>
              } />
            </Route>
            
            {/* Routes protected by editor or admin roles */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'editor']} />}>
              <Route path="/customer/:id/edit" element={
                <Layout>
                  <CustomerEdit />
                </Layout>
              } />
              
              <Route path="/customer/add" element={
                <Layout>
                  <CustomerAdd />
                </Layout>
              } />
            </Route>
            
            {/* Admin only routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/admin/users" element={
                <Layout>
                  <AdminUsers />
                </Layout>
              } />
            </Route>
          </Routes>
          </div>
        </SidebarProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
