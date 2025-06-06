import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/AuthProvider';
import '../styles/Styles.css'; // Ensure styles are correctly applied

const Navbar = () => {
  const { user } = useAuth();

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "User Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "Data Entry", path: "/data-entry" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
  ];

  const userLinks = [
    { name: "Dashboard", path: "../pages/dashboard" },
    { name: "User Profile", path: "../pages/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
  ];

  const links = user?.role === 'admin' ? adminLinks : userLinks;

  return (
    <nav className="sidebar">
      <ul>
        {links.map((link) => (
          <li key={link.name} className={window.location.pathname === link.path ? "active" : ""}>
            <Link to={link.path}>{link.name}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default Navbar;
