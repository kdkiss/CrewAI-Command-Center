import React from 'react';
import { NavLink, Navigate, Route, Routes } from 'react-router-dom';

const CrewNavLinks = ({ navItems, onNavigate, layout = 'horizontal', className = '' }) => {
  const containerClasses = [
    layout === 'vertical' ? 'flex flex-col gap-2' : 'flex gap-2',
    className
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <nav className={containerClasses}>
      {navItems.map(item => (
        <NavLink
          key={item.key}
          to={item.path}
          end
          onClick={() => {
            if (typeof onNavigate === 'function') {
              onNavigate();
            }
          }}
          className={({ isActive }) => {
            const baseClasses =
              layout === 'vertical'
                ? 'inline-flex w-full items-center justify-start rounded-lg px-3 py-2 text-left text-sm capitalize transition-colors'
                : 'inline-flex items-center rounded-lg px-3 py-2 text-sm capitalize transition-colors whitespace-nowrap';
            const activeClasses = 'bg-blue-600 text-white dark:bg-blue-500 dark:text-blue-50';
            const inactiveClasses =
              'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800';

            return `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`;
          }}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
};

const CrewSidebarRoutes = ({
  crewSidebar,
  monitorSidebar,
  activitySidebar,
  librarySidebar,
  systemSidebar,
  configSidebar,
  settingsSidebar
}) => (
  <Routes>
    <Route path="/" element={<Navigate to="/crews" replace />} />
    <Route path="/crews" element={crewSidebar} />
    <Route path="/crews/*" element={crewSidebar} />
    <Route path="/monitor" element={monitorSidebar} />
    <Route path="/activity" element={activitySidebar} />
    <Route path="/library" element={librarySidebar} />
    <Route path="/system" element={systemSidebar} />
    <Route path="/config" element={configSidebar} />
    <Route path="/settings" element={settingsSidebar} />
  </Routes>
);

export { CrewNavLinks, CrewSidebarRoutes };
