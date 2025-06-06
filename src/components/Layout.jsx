import React from 'react';
import Navbar from './Navbar';
import { useTheme } from '../lib/ThemeContext';

const Layout = ({ children }) => {
  const { isDarkMode } = useTheme();

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      <Navbar />
      <div className="flex-1 p-8">
        {children}
      </div>
    </div>
  );
};

export default Layout; 