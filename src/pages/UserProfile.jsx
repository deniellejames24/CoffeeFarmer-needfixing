import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";

const UserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for editable profile fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");

  // State for password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordChangeMessage, setPasswordChangeMessage] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      setLoading(true);
      setError("");
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate("/login");
        return;
      }

      // Fetch user's full details from 'users' table
      const { data, error } = await supabase
        .from("users")
        .select("first_name, middle_name, last_name, email, role")
        .eq("id", authUser.id) // Use authUser.id for fetching specific user
        .single();

      if (error) {
        console.error("Error fetching user profile:", error.message);
        setError("Failed to load user profile. Please try again.");
      } else {
        setUser(data);
        setFirstName(data.first_name || "");
        setMiddleName(data.middle_name || "");
        setLastName(data.last_name || "");
      }
      setLoading(false);
    };
    fetchUser();
  }, [navigate]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors
    setPasswordChangeMessage(""); // Clear password messages

    const updatedDetails = {
      first_name: firstName,
      middle_name: middleName,
      last_name: lastName,
    };

    const { data, error } = await supabase
      .from("users")
      .update(updatedDetails)
      .eq("id", user?.id); // Use user.id for update

    if (error) {
      console.error("Error updating profile:", error.message);
      setError("Error updating profile: " + error.message);
    } else {
      // Update local state with new values
      setUser(prevUser => ({ ...prevUser, ...updatedDetails }));
      setError("Profile updated successfully!"); // Use error state for success message
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordChangeMessage(""); // Clear previous messages
    setError(""); // Clear general errors

    if (newPassword !== confirmNewPassword) {
      setPasswordChangeMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeMessage("Password must be at least 6 characters long.");
      return;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("Error changing password:", error.message);
        setPasswordChangeMessage("Error changing password: " + error.message);
      } else {
        setPasswordChangeMessage("Password changed successfully!");
        setNewPassword("");
        setConfirmNewPassword("");
      }
    } catch (err) {
      console.error("Unexpected error changing password:", err);
      setPasswordChangeMessage("An unexpected error occurred.");
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
  const navLinks = user?.role === "admin" ? adminLinks : userLinks;


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
          <div className="mb-8">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Profile</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Manage your profile information
              </p>
            )}
          </div>

          {/* Profile Form */}
          <div className={`bg-white rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white bg-gray-700' : 'text-gray-900'}`}>Profile Information</h3>
            </div>
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      First Name
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="middleName" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Middle Name
                    </label>
                    <input
                      type="text"
                      id="middleName"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                        : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    }`}
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Password Change Form */}
          <div className={`mt-8 bg-white rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white bg-gray-700' : 'text-gray-900'}`}>Change Password</h3>
            </div>
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="newPassword" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      New Password
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmNewPassword" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmNewPassword"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                        isDarkMode 
                          ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                          : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                      }`}
                    />
                  </div>
                </div>
                {passwordChangeMessage && (
                  <p className={`text-sm ${passwordChangeMessage.includes('Error') ? 'text-red-500' : 'text-green-500'}`}>
                    {passwordChangeMessage}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                        : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    }`}
                  >
                    Change Password
                  </button>
                </div>
              </form>
            </div>
          </div>

          {error && (
            <div className={`mt-4 p-4 rounded-md ${
              error.includes('Error') 
                ? 'bg-red-50 text-red-700' 
                : 'bg-green-50 text-green-700'
            }`}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;