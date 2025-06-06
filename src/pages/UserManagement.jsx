import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";


const UserManagement = () => {
  const navigate = useNavigate();
  const location = useLocation(); // To highlight active link
  const { isDarkMode, toggleTheme } = useTheme();
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null); // The logged-in admin user
  const [showModal, setShowModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // The user being edited
  const [searchQuery, setSearchQuery] = useState(""); // New state for search query

  const [formData, setFormData] = useState({
    first_name: "",
    middle_name: "",
    last_name: "",
    email: "",
    password: "", // Added password to formData
    role: "farmer", // default to farmer
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Farmer Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Farmer Report", path: "/farmer-reports" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
  ];

  // Memoize fetchAllUsers to prevent unnecessary re-creations
  const fetchAllUsers = useCallback(async () => {
    // If search query is empty, fetch all users. Otherwise, apply search filter.
    let query = supabase.from("users").select("*");

    if (searchQuery) {
      // Use OR to search in first_name or last_name
      query = query.or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%`);
    }

    const { data, error } = await query.order('last_name', { ascending: true }); // Order by last name

    if (error) {
      console.error("Error fetching all users:", error.message);
    } else {
      setUsers(data);
    }
  }, [searchQuery]); // Depend on searchQuery

  useEffect(() => {
    const fetchUserDataAndUsers = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate("/login");
        return;
      }

      // Fetch logged-in user's details and role
      const { data: loggedInUserData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name, role")
        .eq("email", authUser.email)
        .single();

      if (userError) {
        console.error("Error fetching logged-in user details:", userError.message);
        navigate("/login"); // Redirect if logged-in user's details are not found
        return;
      }

      setUser(loggedInUserData);

      // Only fetch all users if the logged-in user is an admin
      if (loggedInUserData.role === "admin") {
        fetchAllUsers();
      } else {
        // If not admin, redirect them
        navigate("/dashboard", { replace: true });
      }
    };

    fetchUserDataAndUsers();
  }, [navigate, fetchAllUsers]); // Add fetchAllUsers to dependencies

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEditUser = (userToEdit) => {
    setCurrentUser(userToEdit);
    setFormData({
      first_name: userToEdit.first_name,
      middle_name: userToEdit.middle_name || "",
      last_name: userToEdit.last_name,
      email: userToEdit.email,
      password: "", // Clear password field when editing
      role: userToEdit.role,
    });
    setShowModal(true);
  };

  const handleAddNewUserClick = () => {
    setCurrentUser(null); // Clear currentUser to indicate adding new user
    setFormData({
      first_name: "",
      middle_name: "",
      last_name: "",
      email: "",
      password: "", // Ensure password field is clear for new user
      role: "farmer",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (currentUser) {
      // Editing an existing user
      const { id, email } = currentUser; // Use current user's ID and email for update
      const { first_name, middle_name, last_name, role } = formData;

      const { error } = await supabase
        .from("users")
        .update({ first_name, middle_name, last_name, role })
        .eq("id", id); // Update by ID for precision

      if (error) {
        alert("Error updating user: " + error.message);
      } else {
        alert("User updated successfully!");
        setShowModal(false);
        fetchAllUsers(); // Re-fetch all users to update the table
      }
    } else {
      // Creating a new user
      const { first_name, middle_name, last_name, email, password, role } = formData;

      if (!password) {
        alert("Password is required for new user creation.");
        return;
      }

      try {
        // 1. Create user in Supabase Auth (handles password hashing)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            // Optional: You can set user metadata here if needed
            data: {
              first_name: first_name,
              last_name: last_name,
              role: role,
            }
          }
        });

        if (authError) {
          throw authError;
        }

        // If auth user is created, ensure an entry in your 'users' table exists.
        // Supabase often creates a basic entry on sign-up if you have RLS configured,
        // but explicitly inserting ensures all your custom fields are there.
        // Check if an entry already exists to avoid duplicates.
        const { data: existingUser, error: fetchExistingError } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();

        if (fetchExistingError && fetchExistingError.code !== 'PGRST116') { // PGRST116 means "no rows found"
          // If it's an actual error, not just no user found, throw it
          throw fetchExistingError;
        }

        if (!existingUser) {
            const { data: newUserData, error: insertError } = await supabase
                .from("users")
                .insert([{ first_name, middle_name, last_name, email, role }]);

            if (insertError) {
                // If insertion to 'users' table fails after auth user creation,
                // consider handling this (e.g., deleting auth user, logging error)
                throw insertError;
            }
        }

        alert("New user added successfully!");
        setShowModal(false);
        fetchAllUsers(); // Re-fetch all users to update the table
      } catch (error) {
        alert("Error adding new user: " + error.message);
        console.error("Error details:", error);
      }
    }
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm("Are you sure you want to delete this user? This action cannot be undone.")) {
      try {
        // Fetch user email to delete from auth.users (if needed for cascade)
        const { data: userToDelete, error: fetchError } = await supabase
          .from('users')
          .select('email')
          .eq('id', id)
          .single();

        if (fetchError) {
          throw new Error('Could not find user to delete.');
        }

        // Delete from your 'users' table first
        const { error: deleteUserError } = await supabase.from("users").delete().eq("id", id);
        if (deleteUserError) {
          throw deleteUserError;
        }

        // Optional: If you want to delete from Supabase Auth users as well (requires admin role and service_role key)
        // This part needs to be handled carefully and typically done via a Supabase Function or on the server side
        // to use the service_role key, as it's not safe to expose it client-side.
        // For client-side, you typically only delete from your custom 'users' table.
        // If your 'users' table has a foreign key constraint with cascade delete to auth.users, it would happen automatically.
        // If not, you'd need a server-side function or careful manual deletion in Supabase Auth.
        // For demonstration, we'll assume a client-side deletion only from your 'users' table is sufficient
        // or that you have a database trigger/function handling auth.users deletion.

        const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userToDelete.email);
        if (deleteAuthError) {
          console.warn("Could not delete user from Supabase Auth (might require service_role key or specific policies):", deleteAuthError.message);
          // Don't throw, as the record from your 'users' table is already deleted.
        }


        alert("User deleted successfully!");
        fetchAllUsers(); // Re-fetch all users to update the table
      } catch (error) {
        alert("Error deleting user: " + error.message);
        console.error("Delete error details:", error);
      }
    }
  };


  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      {/* Sidebar Navigation */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg relative`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">☕</div>
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Admin Panel</h1>
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
            {adminLinks.map((link) => (
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
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>User Management</h1>
              {user && (
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Welcome back, {user.first_name} {user.last_name}
                </p>
              )}
            </div>
            <button
              onClick={handleAddNewUserClick}
              className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isDarkMode
                  ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                  : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
              }`}
            >
              Add New User
            </button>
          </div>

          {/* Search Bar */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full px-4 py-2 rounded-md border ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400'
                  : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500`}
            />
          </div>

          {/* Users Table */}
          <div className={`rounded-lg shadow overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'
                    }`}>Name</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'
                    }`}>Email</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'
                    }`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {users.filter(user => user.role !== 'admin').map((user) => (
                    <tr key={user.id} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                      <td className={`px-6 py-4 whitespace-nowrap ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                      }`}>
                        {user.first_name} {user.middle_name} {user.last_name}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEditUser(user)}
                          className={`mr-4 ${
                            isDarkMode
                              ? 'text-indigo-400 hover:text-indigo-300'
                              : 'text-indigo-700 bg-indigo-100 hover:text-indigo-700' // Adjusted for light mode
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className={
                            isDarkMode
                              ? 'text-red-400 hover:text-red-300'
                              : 'text-red-500 bg-red-100 hover:text-red-700' // Adjusted for light mode
                          }
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className={`rounded-lg shadow-xl max-w-md w-full ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <h2 className={`text-xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              {currentUser ? 'Edit User' : 'Add New User'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  First Name
                </label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-indigo-500 focus:border-indigo-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Middle Name
                </label>
                <input
                  type="text"
                  name="middle_name"
                  value={formData.middle_name}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-indigo-500 focus:border-indigo-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Last Name
                </label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-indigo-500 focus:border-indigo-500`}
                />
              </div>
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!!currentUser}
                  className={`mt-1 block w-full rounded-md border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-indigo-500 focus:border-indigo-500`}
                />
              </div>
              {!currentUser && (
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-indigo-500 focus:border-indigo-500`}
                  />
                </div>
              )}
              <div>
                <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Role
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className={`mt-1 block w-full rounded-md border ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-white'
                      : 'bg-white border-gray-300 text-gray-900'
                  } focus:ring-indigo-500 focus:border-indigo-500`}
                >
                  <option value="farmer">Farmer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isDarkMode
                    ? 'text-gray-300 bg-gray-700 hover:bg-gray-600 focus:ring-gray-500'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  isDarkMode
                    ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                }`}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;