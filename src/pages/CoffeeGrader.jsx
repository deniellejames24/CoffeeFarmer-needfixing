import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import Layout from '../components/Layout';

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
    { value: "uniform_minimal_defects", label: "Uniform, minimal defects" },
    { value: "slight_variation_few_defects", label: "Slight variation, few defects" },
    { value: "mixed_sizes_more_defects", label: "Mixed sizes, more defects" },
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
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Enhanced Header Section */}
        <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Coffee Grade Predictor
              </h2>
              {user && (
                <p className={`mt-2 text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Welcome back, <span className="font-semibold">{user.first_name} {user.last_name}</span>
                </p>
              )}
              <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Enter your coffee bean measurements below to predict their grade
              </p>
            </div>
            <div className={`hidden md:block p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
              <div className="text-center">
                <div className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Grade Scale</div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Fine</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Premium</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Commercial</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto">
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-8`}>
            <form onSubmit={e => { e.preventDefault(); gradeCoffee(); }} className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Bean Size Input */}
                <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Coffee Bean Size (mm)
                  </label>
                  <div className="mt-2">
                    <input
                      type="number"
                      step="0.01"
                      value={beanSize}
                      onChange={e => setBeanSize(e.target.value)}
                      placeholder="e.g., 6.8"
                      required
                      className={`block w-full rounded-md border-2 ${
                        isDarkMode 
                          ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200`}
                    />
                  </div>
                  <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Average diameter of coffee beans
                  </p>
                </div>

                {/* Bean Weight Input */}
                <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Weight (100 beans in grams)
                  </label>
                  <div className="mt-2">
                    <input
                      type="number"
                      step="0.1"
                      value={beanWeight}
                      onChange={e => setBeanWeight(e.target.value)}
                      placeholder="e.g., 9.2"
                      required
                      className={`block w-full rounded-md border-2 ${
                        isDarkMode 
                          ? 'bg-gray-600 border-gray-500 text-white placeholder-gray-400' 
                          : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                      } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200`}
                    />
                  </div>
                  <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Weight of 100 random coffee beans
                  </p>
                </div>

                {/* Physical Description Select */}
                <div className="md:col-span-2">
                  <div className={`p-6 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                      Physical Description
                    </label>
                    <div className="mt-2">
                      <select
                        value={beanDescription}
                        onChange={e => setBeanDescription(e.target.value)}
                        required
                        className={`block w-full rounded-md border-2 ${
                          isDarkMode 
                            ? 'bg-gray-600 border-gray-500 text-white' 
                            : 'bg-white border-gray-300 text-gray-900'
                        } focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors duration-200`}
                      >
                        {descriptionOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Select the best description of the beans' physical quality
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-center pt-4">
                <button
                  type="submit"
                  className="px-8 py-3 text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transform transition-transform duration-200 hover:scale-105"
                >
                  Predict Grade
                </button>
              </div>
            </form>

            {/* Enhanced Prediction Results */}
            {predictedGrade && (
              <div className={`mt-8 p-6 rounded-lg ${
                messageType === 'success' 
                  ? isDarkMode 
                    ? 'bg-green-900/30 border-2 border-green-500/30' 
                    : 'bg-green-50 border-2 border-green-200'
                  : isDarkMode
                    ? 'bg-red-900/30 border-2 border-red-500/30'
                    : 'bg-red-50 border-2 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`text-lg font-medium ${
                      messageType === 'success'
                        ? isDarkMode ? 'text-green-200' : 'text-green-800'
                        : isDarkMode ? 'text-red-200' : 'text-red-800'
                    }`}>
                      Predicted Grade
                    </h3>
                    <p className={`mt-2 text-xl font-bold ${
                      messageType === 'success'
                        ? isDarkMode ? 'text-green-100' : 'text-green-900'
                        : isDarkMode ? 'text-red-100' : 'text-red-900'
                    }`}>
                      {predictedGrade}
                    </p>
                  </div>
                  {messageType === 'success' && (
                    <div className={`hidden md:block h-16 w-16 rounded-full ${
                      predictedGrade.includes('Fine') 
                        ? 'bg-green-500' 
                        : predictedGrade.includes('Premium')
                          ? 'bg-blue-500'
                          : 'bg-yellow-500'
                    } opacity-75`} />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CoffeeGrader;