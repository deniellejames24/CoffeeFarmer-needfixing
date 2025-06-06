// src/components/DSSRecommendations.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";

const DSSRecommendations = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);

  // DSS Input States
  const [soilType, setSoilType] = useState("");
  const [averageRainfall, setAverageRainfall] = useState(""); // Can be 'low', 'moderate', 'high'
  const [plantAge, setPlantAge] = useState(""); // Can be 'young', 'mature', 'old'
  const [recommendations, setRecommendations] = useState([]);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success', 'error', 'info'

  // Add new state for recommendation weights and context
  const [recommendationContext, setRecommendationContext] = useState({
    season: new Date().getMonth() < 6 ? 'dry' : 'wet',
    marketTrend: 'stable', // Could be fetched from an API
    sustainabilityFocus: true
  });

  // Define recommendation weights
  const recommendationWeights = {
    soilManagement: 0.25,
    waterManagement: 0.20,
    pestControl: 0.20,
    fertilization: 0.20,
    pruning: 0.15
  };

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

  const getRecommendations = () => {
    setRecommendations([]);
    setMessage("");
    setMessageType("");

    if (!soilType || !averageRainfall || !plantAge) {
      setMessage("Please select all criteria to get recommendations.");
      setMessageType("error");
      return;
    }

    const currentRecommendations = [];
    const recommendationScores = {};

    // Analyze soil management needs
    const soilRecommendations = analyzeSoilManagement(soilType, plantAge);
    currentRecommendations.push(...soilRecommendations.recommendations);
    recommendationScores.soilManagement = soilRecommendations.score;

    // Analyze water management needs
    const waterRecommendations = analyzeWaterManagement(averageRainfall, soilType);
    currentRecommendations.push(...waterRecommendations.recommendations);
    recommendationScores.waterManagement = waterRecommendations.score;

    // Analyze pest control needs
    const pestRecommendations = analyzePestControl(averageRainfall, soilType);
    currentRecommendations.push(...pestRecommendations.recommendations);
    recommendationScores.pestControl = pestRecommendations.score;

    // Analyze fertilization needs
    const fertilizerRecommendations = analyzeFertilization(soilType, plantAge);
    currentRecommendations.push(...fertilizerRecommendations.recommendations);
    recommendationScores.fertilization = fertilizerRecommendations.score;

    // Analyze pruning needs
    const pruningRecommendations = analyzePruning(plantAge);
    currentRecommendations.push(...pruningRecommendations.recommendations);
    recommendationScores.pruning = pruningRecommendations.score;

    // Calculate overall effectiveness score
    const effectivenessScore = calculateEffectivenessScore(recommendationScores);

    // Prioritize recommendations based on scores and context
    const prioritizedRecommendations = prioritizeRecommendations(
      currentRecommendations,
      effectivenessScore
    );

    if (prioritizedRecommendations.length === 0) {
      setMessage("No specific recommendations for this combination of criteria yet, but general good practices apply.");
      setMessageType("info");
    } else {
      setRecommendations(prioritizedRecommendations);
      setMessage(`Recommendations generated with ${getEffectivenessLevel(effectivenessScore)} effectiveness!`);
      setMessageType("success");
    }
  };

  // Helper functions for analysis
  const analyzeSoilManagement = (soilType, plantAge) => {
    const recommendations = [];
    let score = 0;

    if (soilType === "loamy") {
      recommendations.push("Maintain soil organic matter through regular composting.");
      score += 0.8;
    } else if (soilType === "clayey") {
      recommendations.push("Improve soil structure through regular aeration.");
      recommendations.push("Add organic matter to improve drainage.");
      score += 0.7;
    } else if (soilType === "sandy") {
      recommendations.push("Implement mulching to retain moisture and nutrients.");
      score += 0.6;
    }

    if (plantAge === "old") {
      recommendations.push("Consider soil rejuvenation techniques.");
      score += 0.5;
    }

    return { recommendations, score };
  };

  const analyzeWaterManagement = (rainfall, soilType) => {
    const recommendations = [];
    let score = 0;

    if (rainfall === "low") {
      recommendations.push("Implement drip irrigation system.");
      recommendations.push("Use water conservation techniques like mulching.");
      score += 0.9;
    } else if (rainfall === "moderate") {
      recommendations.push("Monitor soil moisture regularly.");
      score += 0.7;
    } else if (rainfall === "high") {
      recommendations.push("Ensure proper drainage systems are in place.");
      if (soilType === "clayey") {
        recommendations.push("Implement raised beds to prevent waterlogging.");
      }
      score += 0.8;
    }

    return { recommendations, score };
  };

  const analyzePestControl = (rainfall, soilType) => {
    const recommendations = [];
    let score = 0;

    if (rainfall === "high") {
      recommendations.push("Implement regular fungicide application schedule.");
      recommendations.push("Monitor for coffee rust and other fungal diseases.");
      score += 0.8;
    }

    if (soilType === "clayey") {
      recommendations.push("Implement proper drainage to prevent root rot.");
      score += 0.6;
    }

    return { recommendations, score };
  };

  const analyzeFertilization = (soilType, plantAge) => {
    const recommendations = [];
    let score = 0;

    if (plantAge === "young") {
      recommendations.push("Apply balanced NPK fertilizer with higher Phosphorus.");
      score += 0.8;
    } else if (plantAge === "mature") {
      recommendations.push("Regular application of balanced NPK fertilizer.");
      score += 0.7;
    } else if (plantAge === "old") {
      recommendations.push("Focus on Potassium-rich fertilizers for fruit development.");
      score += 0.6;
    }

    if (soilType === "sandy") {
      recommendations.push("Use slow-release fertilizers to prevent nutrient leaching.");
      score += 0.5;
    }

    return { recommendations, score };
  };

  const analyzePruning = (plantAge) => {
    const recommendations = [];
    let score = 0;

    if (plantAge === "young") {
      recommendations.push("Focus on structural pruning to establish strong framework.");
      score += 0.8;
    } else if (plantAge === "mature") {
      recommendations.push("Regular maintenance pruning to remove unproductive branches.");
      score += 0.7;
    } else if (plantAge === "old") {
      recommendations.push("Consider rejuvenation pruning to encourage new growth.");
      score += 0.6;
    }

    return { recommendations, score };
  };

  const calculateEffectivenessScore = (scores) => {
    return Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * recommendationWeights[key]);
    }, 0);
  };

  const prioritizeRecommendations = (recommendations, effectivenessScore) => {
    // Sort recommendations by priority and context
    return recommendations
      .filter(rec => {
        // Filter out recommendations that don't match current context
        if (recommendationContext.season === 'dry' && rec.includes('drainage')) {
          return false;
        }
        return true;
      })
      .map(rec => ({
        text: rec,
        priority: calculatePriority(rec, effectivenessScore)
      }))
      .sort((a, b) => b.priority - a.priority)
      .map(item => item.text);
  };

  const calculatePriority = (recommendation, effectivenessScore) => {
    let priority = effectivenessScore;
    
    // Adjust priority based on context
    if (recommendationContext.sustainabilityFocus && 
        recommendation.includes('organic')) {
      priority += 0.2;
    }
    
    return priority;
  };

  const getEffectivenessLevel = (score) => {
    if (score >= 0.8) return "High";
    if (score >= 0.6) return "Moderate";
    return "Basic";
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
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>DSS Panel</h1>
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>DSS Recommendations</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Welcome back, {user.first_name} {user.last_name}</p>
            )}
          </div>
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6`}>
            <form onSubmit={e => { e.preventDefault(); getRecommendations(); }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Soil Type</label>
                  <select
                    value={soilType}
                    onChange={e => setSoilType(e.target.value)}
                    required
                    className={`mt-1 block w-full rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-indigo-500 focus:border-indigo-500`}
                  >
                    <option value="">Select soil type</option>
                    <option value="loamy">Loamy</option>
                    <option value="clayey">Clayey</option>
                    <option value="sandy">Sandy</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Average Rainfall</label>
                  <select
                    value={averageRainfall}
                    onChange={e => setAverageRainfall(e.target.value)}
                    required
                    className={`mt-1 block w-full rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-indigo-500 focus:border-indigo-500`}
                  >
                    <option value="">Select rainfall</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Plant Age</label>
                  <select
                    value={plantAge}
                    onChange={e => setPlantAge(e.target.value)}
                    required
                    className={`mt-1 block w-full rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'} focus:ring-indigo-500 focus:border-indigo-500`}
                  >
                    <option value="">Select plant age</option>
                    <option value="young">Young</option>
                    <option value="mature">Mature</option>
                    <option value="old">Old</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${isDarkMode ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500' : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'}`}
                >
                  Get Recommendations
                </button>
              </div>
            </form>
            {/* Recommendations Results */}
            {message && (
              <div className={`mt-6 p-4 rounded-md ${
                messageType === 'success' 
                  ? isDarkMode 
                    ? 'bg-green-900/50 text-green-200'
                    : 'bg-green-50 text-green-800'
                  : messageType === 'error'
                    ? isDarkMode
                      ? 'bg-red-900/50 text-red-200'
                      : 'bg-red-50 text-red-800'
                    : isDarkMode
                      ? 'bg-blue-900/50 text-blue-200'
                      : 'bg-blue-50 text-blue-800'
              }`}>
                <p>{message}</p>
              </div>
            )}
            {recommendations.length > 0 && (
              <div className="mt-6">
                <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recommendations:</h3>
                <ul className="list-disc pl-6 space-y-2">
                  {recommendations.map((rec, idx) => (
                    <li key={idx} className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DSSRecommendations;