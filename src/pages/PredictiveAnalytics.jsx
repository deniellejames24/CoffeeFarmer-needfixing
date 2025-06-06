// src/components/PredictiveAnalytics.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import "../styles/Styles.css"; // Ensure your styles are imported
import Layout from '../components/Layout';

const PredictiveAnalytics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);

  // Input States for Prediction
  const [previousYield, setPreviousYield] = useState("");
  const [avgTemperature, setAvgTemperature] = useState("");
  const [avgRainfall, setAvgRainfall] = useState("");
  const [fertilizerApplication, setFertilizerApplication] = useState("");
  const [pestDiseaseIncidence, setPestDiseaseIncidence] = useState("");

  // Prediction Output States
  const [predictedYield, setPredictedYield] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success', 'error', 'info'

  // Add new state for historical data
  const [historicalData, setHistoricalData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Add weights for different factors
  const factorWeights = {
    temperature: 0.25,
    rainfall: 0.25,
    fertilizer: 0.20,
    pestDisease: 0.20,
    soilQuality: 0.10
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

  // Enhanced prediction algorithm
  const predictYield = async () => {
    setIsLoading(true);
    setPredictedYield("");
    setMessage("");
    setMessageType("");

    try {
      const prevYield = parseFloat(previousYield);
      const temp = parseFloat(avgTemperature);
      const rainfall = parseFloat(avgRainfall);

      // Input validation
      if (isNaN(prevYield) || prevYield <= 0 ||
          isNaN(temp) || temp < 0 ||
          isNaN(rainfall) || rainfall < 0 ||
          !fertilizerApplication || !pestDiseaseIncidence) {
        setMessage("Please enter valid positive numbers for all fields and make all selections.");
        setMessageType("error");
        return;
      }

      // Calculate base yield change
      let yieldChangePercentage = 0;
      let confidenceScore = 0;

      // Temperature impact with weighted scoring
      const tempImpact = calculateTemperatureImpact(temp);
      yieldChangePercentage += tempImpact * factorWeights.temperature;
      confidenceScore += calculateConfidenceScore(temp, 15, 28);

      // Rainfall impact with weighted scoring
      const rainfallImpact = calculateRainfallImpact(rainfall);
      yieldChangePercentage += rainfallImpact * factorWeights.rainfall;
      confidenceScore += calculateConfidenceScore(rainfall, 1000, 3000);

      // Fertilizer impact with weighted scoring
      const fertilizerImpact = calculateFertilizerImpact(fertilizerApplication);
      yieldChangePercentage += fertilizerImpact * factorWeights.fertilizer;
      confidenceScore += 0.8; // High confidence in fertilizer data

      // Pest/Disease impact with weighted scoring
      const pestImpact = calculatePestImpact(pestDiseaseIncidence);
      yieldChangePercentage += pestImpact * factorWeights.pestDisease;
      confidenceScore += 0.7; // Moderate confidence in pest data

      // Calculate final prediction with confidence interval
      const finalPredictedYield = prevYield * (1 + (yieldChangePercentage / 100));
      const confidenceInterval = calculateConfidenceInterval(finalPredictedYield, confidenceScore / 4);

      // Format output with confidence level
      const confidenceLevel = getConfidenceLevel(confidenceScore / 4);
      setPredictedYield(`${finalPredictedYield.toFixed(2)} kg/hectare (${confidenceLevel})`);
      setMessage(`Prediction range: ${confidenceInterval.min.toFixed(2)} - ${confidenceInterval.max.toFixed(2)} kg/hectare`);
      setMessageType("success");
    } catch (error) {
      setMessage("An error occurred during prediction. Please try again.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper functions for impact calculations
  const calculateTemperatureImpact = (temp) => {
    if (temp >= 18 && temp <= 24) return 15;
    if ((temp >= 15 && temp < 18) || (temp > 24 && temp <= 28)) return 3;
    return -15;
  };

  const calculateRainfallImpact = (rainfall) => {
    if (rainfall >= 1500 && rainfall <= 2500) return 10;
    if ((rainfall >= 1000 && rainfall < 1500) || (rainfall > 2500 && rainfall <= 3000)) return -5;
    return -15;
  };

  const calculateFertilizerImpact = (level) => {
    switch (level) {
      case "high": return 12;
      case "moderate": return 5;
      case "low": return -8;
      default: return 0;
    }
  };

  const calculatePestImpact = (level) => {
    switch (level) {
      case "none": return 10;
      case "low": return -5;
      case "moderate": return -15;
      case "high": return -30;
      default: return 0;
    }
  };

  const calculateConfidenceScore = (value, min, max) => {
    const range = max - min;
    const optimalRange = range * 0.4; // 40% of range is considered optimal
    const optimalCenter = (min + max) / 2;
    const distanceFromOptimal = Math.abs(value - optimalCenter);
    return Math.max(0, 1 - (distanceFromOptimal / (optimalRange / 2)));
  };

  const calculateConfidenceInterval = (prediction, confidenceScore) => {
    const margin = prediction * (1 - confidenceScore) * 0.2; // 20% margin based on confidence
    return {
      min: prediction - margin,
      max: prediction + margin
    };
  };

  const getConfidenceLevel = (score) => {
    if (score >= 0.8) return "High Confidence";
    if (score >= 0.6) return "Moderate Confidence";
    return "Low Confidence";
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
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            Predictive Analytics
          </h2>
        </div>
        <div className="flex justify-between items-center mb-8">
          <div>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Welcome back, {user.first_name} {user.last_name}
              </p>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="rounded-lg shadow-lg p-6">
            <form onSubmit={(e) => { e.preventDefault(); predictYield(); }} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="previousYield" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Previous Harvest Yield (kg/hectare)
                  </label>
                  <input
                    id="previousYield"
                    type="number"
                    step="0.1"
                    value={previousYield}
                    onChange={(e) => setPreviousYield(e.target.value)}
                    placeholder="e.g., 800"
                    required
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:ring-indigo-500 focus:border-indigo-500`}
                  />
                  <p className={`mt-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Enter your last season's yield.
                  </p>
                </div>

                <div>
                  <label htmlFor="avgTemperature" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Average Temperature (°C)
                  </label>
                  <input
                    id="avgTemperature"
                    type="number"
                    step="0.1"
                    value={avgTemperature}
                    onChange={(e) => setAvgTemperature(e.target.value)}
                    placeholder="e.g., 22.5"
                    required
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:ring-indigo-500 focus:border-indigo-500`}
                  />
                </div>

                <div>
                  <label htmlFor="avgRainfall" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Average Rainfall (mm)
                  </label>
                  <input
                    id="avgRainfall"
                    type="number"
                    step="0.1"
                    value={avgRainfall}
                    onChange={(e) => setAvgRainfall(e.target.value)}
                    placeholder="e.g., 2000"
                    required
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    } focus:ring-indigo-500 focus:border-indigo-500`}
                  />
                </div>

                <div>
                  <label htmlFor="fertilizerApplication" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Fertilizer Application Level
                  </label>
                  <select
                    id="fertilizerApplication"
                    value={fertilizerApplication}
                    onChange={(e) => setFertilizerApplication(e.target.value)}
                    required
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-indigo-500 focus:border-indigo-500`}
                  >
                    <option value="">Select level</option>
                    <option value="high">High</option>
                    <option value="moderate">Moderate</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="pestDiseaseIncidence" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    Pest/Disease Incidence
                  </label>
                  <select
                    id="pestDiseaseIncidence"
                    value={pestDiseaseIncidence}
                    onChange={(e) => setPestDiseaseIncidence(e.target.value)}
                    required
                    className={`mt-1 block w-full rounded-md border ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-white'
                        : 'bg-white border-gray-300 text-gray-900'
                    } focus:ring-indigo-500 focus:border-indigo-500`}
                  >
                    <option value="">Select level</option>
                    <option value="none">None</option>
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    isDarkMode
                      ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                      : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Predicting...' : 'Predict Yield'}
                </button>
              </div>
            </form>

            {predictedYield && (
              <div className={`mt-6 p-4 rounded-md ${
                messageType === 'success' 
                  ? isDarkMode 
                    ? 'bg-green-900/50 text-green-200'
                    : 'bg-green-50 text-green-800'
                  : isDarkMode
                    ? 'bg-red-900/50 text-red-200'
                    : 'bg-red-50 text-red-800'
              }`}>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  Predicted Yield: {predictedYield}
                </h3>
                <p className="mt-2">{message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PredictiveAnalytics;