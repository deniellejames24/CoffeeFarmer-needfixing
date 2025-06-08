import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthProvider";
import Layout from '../components/Layout';

const UserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for editable profile fields
  const [profileData, setProfileData] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
  });

  // State for password change
  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!authUser) {
        navigate("/login");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("users")
          .select("first_name, middle_name, last_name")
          .eq("id", authUser.id)
          .single();

        if (error) throw error;

        setProfileData({
          firstName: data.first_name || "",
          middleName: data.middle_name || "",
          lastName: data.last_name || "",
        });
      } catch (error) {
        console.error("Error fetching user profile:", error.message);
        setError("Failed to load user profile. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [navigate, authUser]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError("");
    setPasswordChangeMessage("");

    try {
      const { error } = await supabase
        .from("users")
        .update({
          first_name: profileData.firstName,
          middle_name: profileData.middleName,
          last_name: profileData.lastName,
        })
        .eq("id", authUser?.id);

      if (error) throw error;
      setError("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error.message);
      setError("Error updating profile: " + error.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage("");
    setError("");

    const { newPassword, confirmNewPassword } = passwordData;

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordChangeMessage("Password changed successfully!");
      setPasswordData({
        newPassword: "",
        confirmNewPassword: "",
      });
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordChangeMessage("Error changing password: " + error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Navigation links for admin dashboard
  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "User Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "Data Entry", path: "/data-entry" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
  ];

  // Navigation links for farmer dashboard
  const userLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  // Determine which set of links to use based on the current user's role
  const navLinks = authUser?.role === "admin" ? adminLinks : userLinks;

  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      {/* Sidebar Navigation */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg relative`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">☕</div>
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Profile</h1>
            </div>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-md ${isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <nav className="p-4">
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.path}>
                <button
                  onClick={() => navigate(link.path)}
                  className={`w-full text-left px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    location.pathname === link.path
                      ? isDarkMode 
                        ? 'bg-gray-700 text-indigo-400'
                        : 'bg-indigo-50 text-indigo-500'
                      : isDarkMode
                        ? 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-indigo-400'
                        : 'bg-white text-gray-500 hover:bg-gray-50 hover:text-indigo-400'
                  }`}
                >
                  {link.name}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className={`sticky bottom-0 w-full p-4 border-t ${isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
          <button
            onClick={handleLogout}
            className={`w-full px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              isDarkMode
                ? 'text-indigo-400 bg-gray-700 hover:bg-gray-600 focus:ring-indigo-500'
                : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:ring-indigo-500'
            }`}
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              User Profile
            </h2>
            <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Manage your account settings and preferences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Information */}
            <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Profile Information</h3>
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-indigo-900' : 'bg-indigo-100'}`}>
                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    First Name
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Middle Name
                  </label>
                  <input
                    type="text"
                    name="middleName"
                    value={profileData.middleName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-indigo-500'
                    } focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  }`}
                >
                  Save Profile
                </button>
              </form>
            </div>

            {/* Password Change */}
            <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} hover:shadow-xl transition-shadow duration-200`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className={`text-xl font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Change Password</h3>
                <div className={`p-3 rounded-full ${isDarkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                  <svg className={`w-6 h-6 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmNewPassword"
                    value={passwordData.confirmNewPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-3 py-2 rounded-lg border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white focus:border-green-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
                    } focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors`}
                  />
                </div>

                <button
                  type="submit"
                  className={`w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isDarkMode
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  Change Password
                </button>
              </form>
            </div>
          </div>

          {/* Messages */}
          {(error || passwordChangeMessage) && (
            <div className="mt-6">
              {error && (
                <div className={`p-4 rounded-lg ${
                  error.includes("successfully")
                    ? isDarkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'
                    : isDarkMode ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800'
                }`}>
                  {error}
                </div>
              )}
              {passwordChangeMessage && (
                <div className={`p-4 rounded-lg ${
                  passwordChangeMessage.includes("successfully")
                    ? isDarkMode ? 'bg-green-800 text-green-200' : 'bg-green-100 text-green-800'
                    : isDarkMode ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800'
                }`}>
                  {passwordChangeMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;