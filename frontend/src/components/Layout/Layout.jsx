import React from 'react';
import Sidebar from '../Sidebar/ModernSidebar.jsx';
import { useSidebar } from '../../context/SidebarContext.jsx';
import './Layout.css';

const Layout = ({ children }) => {
  const { sidebarCollapsed, isMobile } = useSidebar();
  
  // Determine content class based on sidebar state and device type
  const contentClass = isMobile
    ? 'content mobile'
    : `content ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`;

  return (
    <div className="layout-container">
      <Sidebar />
      <div className={contentClass}>
        {children}
      </div>
    </div>
  );
};

export default Layout;
