import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";

const CoffeeGrader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [beanSize, setBeanSize] = useState("");
  const [beanWeight, setBeanWeight] = useState("");
  const [beanDescription, setBeanDescription] = useState(""); // This will hold the selected dropdown value
  const [predictedGrade, setPredictedGrade] = useState("");
  const [messageType, setMessageType] = useState(""); // "success" or "error" for styling messages

  // Dropdown options for Physical Description - simplified to only lead to Fine, Premium, Commercial
  const descriptionOptions = [
    { value: "", label: "Select description..." },
    { value: "uniform_minimal_defects", label: "Uniform, minimal defects (Fine)" },
    { value: "slight_variation_few_defects", label: "Slight variation, few defects (Premium)" },
    { value: "mixed_sizes_more_defects", label: "Mixed sizes, more defects (Commercial)" },
  ];

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data, error } = await supabase
          .from("users")
          .select("first_name, last_name, email, role")
          .eq("email", authUser.email)
          .single();
        if (!error) setUser(data);
      } else {
        navigate("/login");
      }
    };
    fetchUser();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const gradeCoffee = () => {
    setPredictedGrade(""); // Clear previous prediction
    setMessageType(""); // Clear previous message type

    const size = parseFloat(beanSize);
    const weight = parseFloat(beanWeight);

    if (isNaN(size) || isNaN(weight) || size <= 0 || weight <= 0) {
      setPredictedGrade("Please enter valid positive numbers for Size and Weight.");
      setMessageType("error");
      return;
    }

    if (!beanDescription) {
      setPredictedGrade("Please select a physical description of the coffee beans.");
      setMessageType("error");
      return;
    }

    // Calculate scores for each grade based on how well the inputs match
    const gradeScores = {
      fine: 0,
      premium: 0,
      commercial: 0
    };

    // --- SIZE SCORING ---
    if (size >= 6.75) {
      gradeScores.fine += 1;
    } else if (size >= 6.0 && size < 6.75) {
      gradeScores.premium += 1;
    } else { // All other valid sizes ( >= 5.5 for commercial) default to commercial
      gradeScores.commercial += 1;
    }

    // --- WEIGHT SCORING ---
    if (weight >= 8.5 && weight <= 10.5) {
      gradeScores.fine += 1;
    } else if (weight >= 7.0 && weight < 8.5) {
      gradeScores.premium += 1;
    } else { // All other valid weights ( >= 6.0 for commercial) default to commercial
      gradeScores.commercial += 1;
    }

    // --- DESCRIPTION SCORING (based on dropdown value) ---
    switch (beanDescription) {
      case "uniform_minimal_defects":
        gradeScores.fine += 1;
        break;
      case "slight_variation_few_defects":
        gradeScores.premium += 1;
        break;
      case "mixed_sizes_more_defects":
        gradeScores.commercial += 1;
        break;
      default:
        // This case should ideally not be hit due to 'required' and initial check
        break;
    }

    // --- DETERMINE FINAL GRADE ---
    let grade = "Cannot determine grade - inputs don't match standard criteria"; // Default for initial message
    let confidence = "";

    const maxScore = Math.max(gradeScores.fine, gradeScores.premium, gradeScores.commercial);

    if (maxScore === 0) {
      setPredictedGrade(grade);
      setMessageType("error");
    } else {
      // Find all grades that have the max score
      const potentialGrades = [];
      if (gradeScores.fine === maxScore) potentialGrades.push("Fine Grade");
      if (gradeScores.premium === maxScore) potentialGrades.push("Premium Grade");
      if (gradeScores.commercial === maxScore) potentialGrades.push("Commercial Grade");

      // Prioritize higher quality in case of a tie
      if (potentialGrades.includes("Fine Grade")) {
        grade = "Fine Grade";
      } else if (potentialGrades.includes("Premium Grade")) {
        grade = "Premium Grade";
      } else {
        grade = "Commercial Grade";
      }

      // Refine confidence based on max score
      if (maxScore === 3) {
        confidence = " (High Confidence)";
      } else if (maxScore === 2) {
        confidence = " (Moderate Confidence)";
      } else if (maxScore === 1) {
        confidence = " (Low Confidence)";
      }
      
      if (potentialGrades.length > 1) {
          confidence += " (Tie resolved to higher grade)";
      }

      setPredictedGrade(grade + confidence);
      setMessageType("success"); // Default to success if a grade is determined
    }
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "Farmer Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Farmer Report", path: "/farmer-reports" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
  ];

  const farmerLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : farmerLinks;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      {/* Sidebar Navigation */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg relative`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">☕</div>
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Coffee Grader</h1>
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
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Coffee Grade Predictor</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Welcome back, {user.first_name} {user.last_name}</p>
            )}
          </div>
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <form onSubmit={e => { e.preventDefault(); gradeCoffee(); }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Coffee Bean Size (mm)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={beanSize}
                    onChange={e => setBeanSize(e.target.value)}
                    placeholder="e.g., 6.8"
                    required
                    className={`mt-1 block w-full rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-indigo-500 focus:border-indigo-500`}
                  />
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Average diameter of coffee beans.</p>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Weight (100 beans in grams)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={beanWeight}
                    onChange={e => setBeanWeight(e.target.value)}
                    placeholder="e.g., 9.2"
                    required
                    className={`mt-1 block w-full rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:ring-indigo-500 focus:border-indigo-500`}
                  />
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Weight of 100 random coffee beans.</p>
                </div>
                <div className="md:col-span-2">
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Physical Description</label>
                  <select
                    value={beanDescription}
                    onChange={e => setBeanDescription(e.target.value)}
                    required
                    className={`mt-1 block w-full rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-indigo-500 focus:border-indigo-500`}
                  >
                    {descriptionOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Select the best description of the beans' physical quality.</p>
                </div>
              </div>
              <div className="flex justify-end md:col-span-2">
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDarkMode ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}`}
                >
                  Predict Grade
                </button>
              </div>
            </form>
            {/* Prediction Results */}
            {predictedGrade && (
              <div className={`mt-6 p-4 rounded-md ${
                messageType === 'success' 
                  ? isDarkMode 
                    ? 'bg-green-900/50 text-green-200'
                    : 'bg-green-50 text-green-800'
                  : isDarkMode
                    ? 'bg-red-900/50 text-red-200'
                    : 'bg-red-50 text-red-800'
              }`}>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Predicted Grade</h3>
                <p className="mt-2">{predictedGrade}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoffeeGrader;