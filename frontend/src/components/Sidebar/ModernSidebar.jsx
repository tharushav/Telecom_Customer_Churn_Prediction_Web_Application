import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  FaHome, FaUsers, FaChartLine, FaSignOutAlt, FaChevronRight, 
  FaChevronLeft, FaUserCog, FaUserPlus, FaExclamationTriangle, FaHistory 
} from 'react-icons/fa';
import { IoMdAnalytics } from "react-icons/io";
import './ModernSidebar.css';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSidebar } from '../../context/SidebarContext.jsx';

const Sidebar = () => {
  const location = useLocation();
  const { user, logout, hasRole } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const { sidebarCollapsed, toggleSidebar } = useSidebar();

  const handleLogoutClick = () => {
    setShowLogoutConfirmation(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirmation(false);
    logout();
    navigate('/login');
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirmation(false);
  };

  // Check if current route matches given path
  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <>
      <div className={`sidebar ${!sidebarCollapsed ? 'expanded' : 'collapsed'}`} data-mobile="true">
        <div className="sidebar-header">
          <div className="header-content">
            <div className="header-logo">
              <IoMdAnalytics />
            </div>
            <h2 className="header-text">Churn Analytics</h2>
          </div>
          <button className="sidebar-toggle" onClick={toggleSidebar} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {sidebarCollapsed ? <FaChevronRight /> : <FaChevronLeft />}
          </button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-info">
            <div className="username">{user?.username || 'User'}</div>
            <div className="role">{user?.role || 'Unknown'}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <li>
              <NavLink to="/" className={isActive('/') ? 'active' : ''} title="Dashboard">
                <FaHome className="nav-icon" />
                <span className="nav-text">Dashboard</span>
              </NavLink>
            </li>
            
            <li>
              <NavLink to="/users" className={isActive('/users') ? 'active' : ''} title="Customers">
                <FaUsers className="nav-icon" />
                <span className="nav-text">Customers</span>
              </NavLink>
            </li>
            
            <li>
              <NavLink to="/survival-analysis" className={isActive('/survival-analysis') ? 'active' : ''} title="Survival Analysis">
                <FaChartLine className="nav-icon" />
                <span className="nav-text">Survival Analysis</span>
              </NavLink>
            </li>
            
            <li>
              <NavLink to="/historical-analytics" className={isActive('/historical-analytics') ? 'active' : ''} title="Historical Analytics">
                <FaHistory className="nav-icon" />
                <span className="nav-text">Historical Analytics</span>
              </NavLink>
            </li>
            
            {/* Only show Add Customer for editors and admins */}
            {hasRole(['admin', 'editor']) && (
              <li>
                <NavLink to="/customer/add" className={isActive('/customer/add') ? 'active' : ''} title="Add Customer">
                  <FaUserPlus className="nav-icon" />
                  <span className="nav-text">Add Customer</span>
                </NavLink>
              </li>
            )}
            
            {/* Admin only navigation */}
            {hasRole('admin') && (
              <li>
                <NavLink to="/admin/users" className={isActive('/admin/users') ? 'active' : ''} title="Admin Users">
                  <FaUserCog className="nav-icon" />
                  <span className="nav-text">Admin Users</span>
                </NavLink>
              </li>
            )}
            
            {/* Separator for visibility */}
            <li className="nav-separator"></li>
            
            {/* Logout button as a list item with highlight for maximum visibility */}
            <li className="logout-list-item">
              <button className="logout-button logout-highlight" onClick={handleLogoutClick} title="Logout">
                <FaSignOutAlt className="nav-icon logout-icon" />
                <span className="nav-text logout-text">LOGOUT</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>

      {/* Moved the logout confirmation modal outside of the sidebar DOM structure */}
      {showLogoutConfirmation && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-modal">
            <div className="delete-icon-container">
              <FaExclamationTriangle className="delete-warning-icon" />
            </div>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out of the system?</p>
            <div className="delete-confirmation-buttons">
              <button className="cancel-delete-button" onClick={handleCancelLogout}>Cancel</button>
              <button className="confirm-delete-button" onClick={handleConfirmLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
