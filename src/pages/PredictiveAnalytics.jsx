// src/pages/PredictiveAnalytics.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { fetchWeatherData, fetchWeatherForecast } from "../lib/weatherService";
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import "../styles/Styles.css"; // Ensure your styles are imported
import Layout from '../components/Layout';
import { useAuth } from "../lib/AuthProvider";
import { AdvancedAnalytics } from "../lib/ml/AdvancedAnalytics";
import MLInsights from "../components/analytics/MLInsights";
import { QualityPredictor } from '../lib/ml/QualityPredictor';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Add PlantSubAnalytics component
const PlantSubAnalytics = ({ plant, historicalHarvests, plantStatuses, weatherForecast, isDarkMode }) => {
  // Calculate plant-specific metrics
  const plantHarvests = historicalHarvests.filter(h => h.plant_id === plant.plant_id);
  const plantStatus = plantStatuses.find(s => s.plant_id === plant.plant_id);
  
  // Calculate total yield
  const totalYield = plantHarvests.reduce((sum, h) => sum + h.coffee_raw_quantity, 0);
  
  // Calculate average yield per harvest
  const avgYield = plantHarvests.length > 0 ? totalYield / plantHarvests.length : 0;
  
  // Calculate yield trend (last 3 harvests)
  const recentHarvests = plantHarvests.slice(-3);
  const yieldTrend = recentHarvests.length >= 2 
    ? (recentHarvests[recentHarvests.length - 1]?.coffee_raw_quantity || 0) > 
      (recentHarvests[recentHarvests.length - 2]?.coffee_raw_quantity || 0)
      ? 'increasing'
      : 'decreasing'
    : 'stable';

  // Calculate health score
  const calculateHealthScore = () => {
    let score = 100;
    
    if (plantStatus) {
      // Deduct points based on status
      if (plantStatus.status === 'diseased') score -= 30;
      if (plantStatus.status === 'pest-affected') score -= 20;
      
      // Check soil pH (optimal range: 5.5-6.5)
      const pH = parseFloat(plantStatus.soil_ph);
      if (pH && (pH < 5.5 || pH > 6.5)) {
        score -= 15;
      }
      
      // Check moisture level
      if (plantStatus.moisture_level === 'dry') {
        score -= 15;
      }
    }
    
    // Adjust for weather conditions if available
    if (weatherForecast) {
      if (weatherForecast.temperature > 24) score -= 10;
      if (weatherForecast.rainfall * 12 < 1500) score -= 10;
    }
    
    return Math.max(0, score);
  };

  const healthScore = calculateHealthScore();

  // Generate recommendations
  const getRecommendations = () => {
    const recs = [];
    
    if (plantStatus) {
      if (plantStatus.status === 'diseased') {
        recs.push({
          type: 'critical',
          message: 'Implement disease management practices immediately'
        });
      }
      if (plantStatus.status === 'pest-affected') {
        recs.push({
          type: 'high',
          message: 'Apply pest control measures'
        });
      }
      if (plantStatus.moisture_level === 'dry') {
        recs.push({
          type: 'medium',
          message: 'Increase irrigation frequency'
        });
      }
      
      const pH = parseFloat(plantStatus.soil_ph);
      if (pH && (pH < 5.5 || pH > 6.5)) {
        recs.push({
          type: 'high',
          message: `Adjust soil pH (current: ${pH}) to optimal range (5.5-6.5)`
        });
      }
    }
    
    if (weatherForecast) {
      if (weatherForecast.temperature > 24) {
        recs.push({
          type: 'medium',
          message: 'Consider additional shade measures due to high temperatures'
        });
      }
      if (weatherForecast.rainfall * 12 < 1500) {
        recs.push({
          type: 'medium',
          message: 'Plan for supplementary irrigation due to low rainfall forecast'
        });
      }
    }
    
    return recs;
  };

  const recommendations = getRecommendations();

  return (
    <div className={`mt-6 p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-700' : 'bg-white'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
          {plant.coffee_variety}
        </h3>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
          healthScore > 80 ? isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
          : healthScore > 60 ? isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
          : isDarkMode ? 'bg-red-900 text-red-200' : 'bg-red-100 text-red-800'
        }`}>
          Health Score: {healthScore}%
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Total Yield</div>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {totalYield.toFixed(2)} kg
          </div>
        </div>
        <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Average Yield</div>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            {avgYield.toFixed(2)} kg
          </div>
        </div>
        <div className={`p-4 rounded ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}`}>
          <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Yield Trend</div>
          <div className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'} flex items-center`}>
            {yieldTrend === 'increasing' ? (
              <>
                <span className="text-green-500">↑</span> Increasing
              </>
            ) : yieldTrend === 'decreasing' ? (
              <>
                <span className="text-red-500">↓</span> Decreasing
              </>
            ) : (
              <>
                <span className="text-yellow-500">→</span> Stable
              </>
            )}
          </div>
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-4">
          <h4 className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Recommendations
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className={`p-3 rounded ${
                  rec.type === 'critical'
                    ? isDarkMode ? 'bg-red-900/20 text-red-200' : 'bg-red-50 text-red-700'
                    : rec.type === 'high'
                    ? isDarkMode ? 'bg-orange-900/20 text-orange-200' : 'bg-orange-50 text-orange-700'
                    : isDarkMode ? 'bg-yellow-900/20 text-yellow-200' : 'bg-yellow-50 text-yellow-700'
                }`}
              >
                {rec.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PredictiveAnalytics = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [analytics] = useState(() => new AdvancedAnalytics());
  const [farmerDetails, setFarmerDetails] = useState(null);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Input States for Prediction
  const [previousYield, setPreviousYield] = useState("");
  const [avgTemperature, setAvgTemperature] = useState("");
  const [avgRainfall, setAvgRainfall] = useState("");
  const [fertilizerApplication, setFertilizerApplication] = useState("");
  const [pestDiseaseIncidence, setPestDiseaseIncidence] = useState("");

  // Prediction Output States
  const [predictedYield, setPredictedYield] = useState("");
  const [recommendations, setRecommendations] = useState([]);
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'success', 'error', 'info'

  // Add new state for historical data
  const [historicalHarvests, setHistoricalHarvests] = useState([]);
  const [plantStatuses, setPlantStatuses] = useState([]);
  const [weatherForecast, setWeatherForecast] = useState(null);

  // Chart data state
  const [yieldChartData, setYieldChartData] = useState(null);

  // Loading and error states
  const [isLoading, setIsLoading] = useState(false);

  // Add weights for different factors
  const factorWeights = {
    temperature: 0.25,
    rainfall: 0.25,
    fertilizer: 0.20,
    pestDisease: 0.20,
    soilQuality: 0.10
  };

  const [manualLocation, setManualLocation] = useState({
    latitude: '',
    longitude: ''
  });
  const [manualEnvironment, setManualEnvironment] = useState({
    temperature: '',
    rainfall: '',
    elevation: ''
  });

  // Add new state for editing
  const [editingCards, setEditingCards] = useState(new Set());

  // State management
  const [mlAnalysis, setMlAnalysis] = useState(null);

  // Current conditions state
  const [currentConditions, setCurrentConditions] = useState({
    pH: 6.0,
    moisture: 'moderate',
    lastFertilized: new Date().toISOString().split('T')[0]
  });

  // New state for quality distribution
  const [qualityDistribution, setQualityDistribution] = useState(null);
  const [seasonalYields, setSeasonalYields] = useState(null);

  // Function to safely parse numeric values with validation
  const safeParseFloat = (value, defaultValue = 0) => {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
  };

  // Function to calculate days since last fertilized with validation
  const getDaysSinceLastFertilized = (lastFertilized) => {
    if (!lastFertilized || !(lastFertilized instanceof Date) && isNaN(new Date(lastFertilized))) {
      return 30; // Default to 30 days if no date or invalid date
    }
    const today = new Date();
    const fertilizedDate = new Date(lastFertilized);
    const diffDays = Math.floor((today - fertilizedDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Function to convert moisture level to numeric value with validation
  const moistureToNumeric = (moistureLevel) => {
    if (!moistureLevel || typeof moistureLevel !== 'string') {
      return 60; // Default to moderate
    }
    const moistureMap = {
      'very_dry': 20,
      'dry': 40,
      'moderate': 60,
      'moist': 80,
      'very_moist': 90
    };
    return moistureMap[moistureLevel.toLowerCase()] || 60;
  };

  // Function to validate and process harvest data
  const processHarvestData = (harvests) => {
    if (!Array.isArray(harvests)) return [];
    
    return harvests
      .filter(h => h && typeof h === 'object' && h.coffee_raw_quantity != null && h.harvest_date != null)
      .map(h => ({
        ...h,
        coffee_raw_quantity: safeParseFloat(h.coffee_raw_quantity, 0),
        harvest_date: new Date(h.harvest_date).toISOString()
      }))
      .filter(h => !isNaN(new Date(h.harvest_date).getTime()))
      .sort((a, b) => new Date(a.harvest_date) - new Date(b.harvest_date));
  };

  // Function to validate and process plant status data
  const processPlantStatus = (status) => {
    if (!status || typeof status !== 'object') {
      return null;
    }

    return {
      timestamp: status.created_at || new Date().toISOString(),
      temperature: safeParseFloat(status.temperature, 25),
      humidity: moistureToNumeric(status.moisture_level),
      soil_ph: safeParseFloat(status.soil_ph, 6.5),
      fertilizer_level: getDaysSinceLastFertilized(status.last_fertilized) < 30 ? 1 : 0
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!user?.id) {
          throw new Error('User not authenticated');
        }

        // Fetch farmer details
        const { data: farmerData, error: farmerError } = await supabase
          .from('farmer_detail')
          .select('*')
          .eq('id', user.id)
          .single();

        if (farmerError) throw farmerError;
        setFarmerDetails(farmerData);

        // Fetch plants
        const { data: plantData, error: plantError } = await supabase
          .from('plant_data')
          .select('*')
          .eq('farmer_id', user.id);

        if (plantError) throw plantError;
        const validPlants = (plantData || []).filter(p => p && p.plant_id != null);
        setPlants(validPlants);

        if (validPlants.length === 0) {
          throw new Error('No valid plants found');
        }

        // Fetch historical harvests
        const { data: harvests, error: harvestError } = await supabase
          .from('harvest_data')
          .select('*')
          .eq('farmer_id', user.id)
          .order('harvest_date', { ascending: true });

        if (harvestError) throw harvestError;
        const processedHarvests = processHarvestData(harvests || []);
        setHistoricalHarvests(processedHarvests);

        // Fetch plant statuses (which includes environmental data)
        const { data: statuses, error: statusError } = await supabase
          .from('plant_status')
          .select('*')
          .in('plant_id', validPlants.map(p => p.plant_id))
          .order('created_at', { ascending: false });

        if (statusError) throw statusError;

        // Process plant statuses to create environmental data
        const validStatuses = (statuses || [])
          .filter(s => s != null)
          .map(status => ({
            ...status,
            temperature: 25, // Default temperature since it's not in the schema
            humidity: moistureToNumeric(status.moisture_level),
            soil_ph: safeParseFloat(status.soil_ph, 6.5),
            timestamp: status.created_at,
            fertilizer_level: getDaysSinceLastFertilized(status.last_fertilized) < 30 ? 1 : 0
          }))
          .filter(s => 
            typeof s.temperature === 'number' && 
            typeof s.humidity === 'number' && 
            typeof s.soil_ph === 'number'
          );
        
        setPlantStatuses(validStatuses);

        // Set current conditions from latest plant status
        if (validStatuses.length > 0) {
          const latestStatus = validStatuses[0];
          setCurrentConditions(prev => ({
            ...prev,
            temperature: safeParseFloat(latestStatus.temperature, 25),
            humidity: safeParseFloat(latestStatus.humidity, 70),
            pH: safeParseFloat(latestStatus.soil_ph, 6.5),
            moisture: latestStatus.moisture_level || 'moderate',
            lastFertilized: latestStatus.last_fertilized || new Date().toISOString().split('T')[0]
          }));
        }

        // Initialize ML analytics only if we have both harvest data and environmental data
        if (processedHarvests.length > 0 && validStatuses.length > 0) {
          // Create environmental data from plant statuses
          const environmentalData = validStatuses.map(status => ({
            temperature: safeParseFloat(status.temperature, 25),
            humidity: safeParseFloat(status.humidity, 70),
            soil_ph: safeParseFloat(status.soil_ph, 6.5),
            timestamp: status.created_at,
            fertilizer_level: getDaysSinceLastFertilized(status.last_fertilized) < 30 ? 1 : 0
          }));

          // Initialize analytics with processed data
          analytics.initializeWithHistoricalData(processedHarvests, environmentalData);

          // Update analysis with latest conditions
          const latestStatus = validStatuses[0];
          const analysisConditions = {
            temperature: Math.max(0, safeParseFloat(latestStatus.temperature, 25)),
            humidity: Math.max(0, safeParseFloat(latestStatus.humidity, 70)),
            pH: Math.max(0, safeParseFloat(latestStatus.soil_ph, 6.5)),
            rainfall: Math.max(0, safeParseFloat(latestStatus.rainfall, 1500)),
            pestDiseaseIncidence: Math.max(0, safeParseFloat(latestStatus.pestDiseaseIncidence, 0)),
            fertilizerApplication: Math.max(0, safeParseFloat(latestStatus.last_fertilized ? 1 : 0, 0))
          };

          // Validate conditions and provide specific error messages
          const invalidConditions = Object.entries(analysisConditions)
            .filter(([_, value]) => typeof value !== 'number' || value < 0)
            .map(([key]) => key);

          if (invalidConditions.length > 0) {
            console.warn('Invalid environmental conditions:', invalidConditions);
            // Instead of throwing error, use default values
            analysisConditions.temperature = Math.max(analysisConditions.temperature, 25);
            analysisConditions.humidity = Math.max(analysisConditions.humidity, 70);
            analysisConditions.pH = Math.max(analysisConditions.pH, 6.5);
            analysisConditions.rainfall = Math.max(analysisConditions.rainfall, 1500);
            analysisConditions.pestDiseaseIncidence = Math.max(analysisConditions.pestDiseaseIncidence, 0);
            analysisConditions.fertilizerApplication = Math.max(analysisConditions.fertilizerApplication, 0);
          }

          await updateAnalysis(analysisConditions);
        } else {
          console.warn('Insufficient data for analysis');
          // Use default values instead of throwing error
          const defaultConditions = {
            temperature: 25,
            humidity: 70,
            pH: 6.5,
            rainfall: 1500,
            pestDiseaseIncidence: 0,
            fertilizerApplication: 0
          };
          await updateAnalysis(defaultConditions);
        }

      } catch (err) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  const updateAnalysis = async (conditions) => {
    try {
      if (!conditions || typeof conditions !== 'object') {
        throw new Error('Invalid conditions object');
      }

      // Ensure all values are valid numbers
      const validatedConditions = {
        temperature: safeParseFloat(conditions.temperature, 25),
        humidity: safeParseFloat(conditions.humidity, 70),
        pH: safeParseFloat(conditions.pH, 6.5),
        rainfall: safeParseFloat(conditions.rainfall, 1500),
        pestDiseaseIncidence: safeParseFloat(conditions.pestDiseaseIncidence, 0),
        fertilizerApplication: safeParseFloat(conditions.fertilizerApplication, 0)
      };

      // Validate that all required fields are present and non-negative
      Object.entries(validatedConditions).forEach(([key, value]) => {
        if (value < 0) {
          throw new Error(`Invalid negative value for ${key}: ${value}`);
        }
      });

      const analysis = await analytics.getComprehensiveAnalysis(validatedConditions);
      if (!analysis) {
        throw new Error('Analysis returned null or undefined');
      }
      
      setMlAnalysis(analysis);
    } catch (err) {
      console.error('Error updating analysis:', err);
      setError(err.message);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (!name) return;

    const newConditions = {
      ...currentConditions,
      [name]: value
    };
    setCurrentConditions(newConditions);

    // Update analysis with validated values
    updateAnalysis({
      temperature: safeParseFloat(newConditions.temperature, 25),
      humidity: moistureToNumeric(newConditions.moisture),
      pH: safeParseFloat(newConditions.pH, 6.5),
      rainfall: 1500,
      pestDiseaseIncidence: 0,
      fertilizerApplication: getDaysSinceLastFertilized(newConditions.lastFertilized) < 30 ? 1 : 0
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const updateYieldChart = (harvests) => {
    if (!harvests.length) return;

    const chartData = {
      labels: harvests.map(h => new Date(h.harvest_date).toLocaleDateString()),
      datasets: [
        {
          label: 'Raw Coffee Yield (kg)',
          data: harvests.map(h => h.coffee_raw_quantity),
          borderColor: isDarkMode ? 'rgba(147, 197, 253, 1)' : 'rgba(59, 130, 246, 1)',
          backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.5)' : 'rgba(59, 130, 246, 0.5)',
        }
      ]
    };

    setYieldChartData(chartData);
  };

  const predictYield = async () => {
    setIsLoading(true);
    setPredictedYield("");
    setRecommendations([]);
    setError("");

    try {
      if (!historicalHarvests.length) {
        throw new Error("No historical harvest data available for prediction");
      }

      // Calculate base prediction from historical data
      const recentHarvests = historicalHarvests.slice(-3);
      const avgHistoricalYield = recentHarvests.reduce((sum, h) => sum + h.coffee_raw_quantity, 0) / recentHarvests.length;

      // Adjust prediction based on weather
      let weatherImpact = 0;
      if (weatherForecast) {
        // Optimal conditions: Temperature 18-24°C, Rainfall 1500-2500mm annually
        const tempDiff = Math.abs(weatherForecast.temperature - 21); // 21°C is ideal
        const rainDiff = Math.abs(weatherForecast.rainfall * 12 - 2000); // Scale to annual rainfall

        weatherImpact = (tempDiff > 3 ? -0.1 : 0.1) + (rainDiff > 500 ? -0.1 : 0.1);
      }

      // Get latest plant status
      const { data: latestStatus } = await supabase
        .from("plant_status")
        .select("*")
        .eq("farmer_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Adjust prediction based on plant status
      let statusImpact = 0;
      const recommendations = [];

      if (latestStatus) {
        // Soil pH impact (optimal range: 5.5-6.5)
        if (latestStatus.soil_ph) {
          const pH = parseFloat(latestStatus.soil_ph);
          if (pH < 5.5 || pH > 6.5) {
            statusImpact -= 0.1;
            recommendations.push(`Adjust soil pH to optimal range (5.5-6.5). Current pH: ${pH}`);
          }
        }

        // Moisture impact
        if (latestStatus.moisture_level === 'dry') {
          statusImpact -= 0.15;
          recommendations.push("Increase irrigation to improve soil moisture");
        }

        // Disease impact
        if (latestStatus.status === 'diseased') {
          statusImpact -= 0.2;
          recommendations.push("Implement disease management practices immediately");
        }
      }

      // Calculate final prediction
      const predictedAmount = avgHistoricalYield * (1 + weatherImpact + statusImpact);
      const confidenceScore = calculateConfidenceScore(weatherImpact, statusImpact, historicalHarvests.length);

      // Add weather-based recommendations
      if (weatherForecast) {
        if (weatherForecast.temperature > 24) {
          recommendations.push("Consider additional shade measures due to high temperatures");
        }
        if (weatherForecast.rainfall * 12 < 1500) {
          recommendations.push("Plan for supplementary irrigation due to expected low rainfall");
        }
      }

      setPredictedYield(`${predictedAmount.toFixed(2)} kg/hectare`);
      setRecommendations(recommendations);
      setConfidenceScore(confidenceScore);

    } catch (error) {
      console.error("Prediction error:", error);
      setError(error.message);
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

  const calculateConfidenceScore = (weatherImpact, statusImpact, dataPoints) => {
    // Base confidence from amount of historical data
    let confidence = Math.min(dataPoints / 10, 1) * 0.4;
    
    // Weather data reliability
    confidence += weatherForecast ? 0.3 : 0;
    
    // Status data reliability
    confidence += Math.abs(statusImpact) < 0.2 ? 0.3 : 0.15;
    
    return confidence;
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

  // Initialize manual values when starting to edit
  const handleStartEditing = (cardType) => {
    setEditingCards(prev => {
      const newSet = new Set(prev);
      newSet.add(cardType);
      return newSet;
    });
    
    if (cardType === 'environment') {
      setManualEnvironment({
        temperature: weatherForecast?.temperature || '',
        rainfall: weatherForecast?.rainfall || '',
        elevation: farmerDetails?.farm_elevation || ''
      });
    } else if (cardType === 'location') {
      setManualLocation({
        latitude: farmerDetails?.farm_latitude || '',
        longitude: farmerDetails?.farm_longitude || ''
      });
    }
  };

  const handleCancelEdit = (cardType) => {
    setEditingCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(cardType);
      return newSet;
    });
  };

  // Modified environment update handler
  const handleEnvironmentUpdate = (e) => {
    e.preventDefault();
    setWeatherForecast(prev => ({
      ...prev,
      temperature: parseFloat(manualEnvironment.temperature),
      rainfall: parseFloat(manualEnvironment.rainfall)
    }));
    setFarmerDetails(prev => ({
      ...prev,
      farm_elevation: parseFloat(manualEnvironment.elevation)
    }));
    handleCancelEdit('environment');
  };

  // Modified location update handler
  const handleLocationUpdate = (e) => {
    e.preventDefault();
    setFarmerDetails(prev => ({
      ...prev,
      farm_latitude: parseFloat(manualLocation.latitude),
      farm_longitude: parseFloat(manualLocation.longitude)
    }));
    handleCancelEdit('location');
  };

  // Calculate data quality score based on available data
  const getDataQualityScore = () => {
    let score = 0;
    let totalFactors = 0;

    // Check historical harvests
    if (historicalHarvests && historicalHarvests.length > 0) {
      score += 20;
    }
    totalFactors++;

    // Check plants data
    if (plants && plants.length > 0) {
      score += 20;
    }
    totalFactors++;

    // Check weather forecast
    if (weatherForecast) {
      score += 20;
    }
    totalFactors++;

    // Check farmer details
    if (farmerDetails) {
      score += 20;
    }
    totalFactors++;

    // Check location data
    if (farmerDetails?.farm_latitude && farmerDetails?.farm_longitude) {
      score += 20;
    }
    totalFactors++;

    return Math.round((score / (totalFactors * 20)) * 100);
  };

  // Get number of available prediction factors
  const getAvailableFactors = () => {
    let count = 0;
    if (historicalHarvests && historicalHarvests.length > 0) count++;
    if (plants && plants.length > 0) count++;
    if (weatherForecast) count++;
    if (farmerDetails) count++;
    if (farmerDetails?.farm_latitude && farmerDetails?.farm_longitude) count++;
    return count;
  };

  useEffect(() => {
    if (historicalHarvests.length > 0) {
      // Calculate quality distribution
      const distribution = QualityPredictor.predictQualityDistribution(
        currentConditions,
        historicalHarvests
      );
      setQualityDistribution(distribution);

      // Calculate seasonal yields
      const yields = {
        wet: QualityPredictor.predictSeasonalYield(currentConditions, historicalHarvests, 'wet'),
        dry: QualityPredictor.predictSeasonalYield(currentConditions, historicalHarvests, 'dry'),
        transition: QualityPredictor.predictSeasonalYield(currentConditions, historicalHarvests, 'transition')
      };
      setSeasonalYields(yields);
    }
  }, [currentConditions, historicalHarvests]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading analytics...</div>;
  }

  if (error) {
    return <div className="text-red-600 p-4">Error: {error}</div>;
  }

  return (
    <Layout>
      <div className={`container mx-auto px-4 py-8 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
          <div className={`mb-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-lg shadow-lg p-6`}>
            <h2 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Predictive Analytics
            </h2>
          </div>

        {/* Quality Grade and Seasonal Yield Predictions */}
        <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
          <h2 className={`text-2xl font-bold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Coffee Quality Predictions</h2>
          
          {/* Quality Grade Predictions */}
          <div className="mb-8">
            <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Predicted Coffee Bean Quality Distribution
              </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Premium Grade</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
                  }`}>
                    {historicalHarvests.length > 0 ? 
                      `${((historicalHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0) / 
                      historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0)) * 100).toFixed(1)}%` : 
                      'No data'
                    }
                  </span>
              </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Projected high-quality beans based on current growing conditions
            </div>
              </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Fine Grade</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {historicalHarvests.length > 0 ? 
                      `${((historicalHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0) / 
                      historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0)) * 100).toFixed(1)}%` : 
                      'No data'
                    }
                  </span>
              </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Expected standard quality beans based on growing patterns
                </div>
          </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Commercial Grade</span>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    isDarkMode ? 'bg-yellow-900 text-yellow-200' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {historicalHarvests.length > 0 ? 
                      `${((historicalHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0) / 
                      historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0)) * 100).toFixed(1)}%` : 
                      'No data'
                    }
                  </span>
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Predicted basic grade beans based on historical data
              </div>
                </div>
            </div>
          </div>

          {/* Seasonal Yield Predictions */}
                <div>
            <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Seasonal Yield Forecast
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🌱</span>
                  <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Peak Season</span>
                </div>
                <div className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {historicalHarvests.length > 0 ? 
                    `${(historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0) * 1.2).toFixed(1)} kg` : 
                    'No data'
                  }
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  March - May (Primary Harvest)
              </div>
            </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🌿</span>
                  <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Mid Season</span>
                </div>
                <div className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                  {historicalHarvests.length > 0 ? 
                    `${(historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0) * 0.8).toFixed(1)} kg` : 
                    'No data'
                  }
              </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  September - November (Secondary Harvest)
                </div>
                </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">🍃</span>
                  <span className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>Off Season</span>
                </div>
                <div className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                  {historicalHarvests.length > 0 ? 
                    `${(historicalHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0) * 0.4).toFixed(1)} kg` : 
                    'No data'
                  }
                </div>
                <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  December - February & June - August
                </div>
              </div>
              </div>
            </div>

          {/* Quality Improvement Recommendations */}
          <div className="mt-8">
            <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
              Quality Improvement Insights
            </h3>
            <div className="space-y-3">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className={`font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Premium Grade Optimization
                </div>
                <ul className={`list-disc list-inside text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <li>Maintain optimal soil pH between 6.0-6.5</li>
                  <li>Ensure consistent irrigation during critical growth phases</li>
                  <li>Implement selective harvesting for ripe cherries</li>
                </ul>
              </div>

              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <div className={`font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                  Seasonal Adjustments
                </div>
                <ul className={`list-disc list-inside text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  <li>Adjust irrigation based on seasonal rainfall patterns</li>
                  <li>Modify fertilization schedule for each growing season</li>
                  <li>Implement additional shade during peak dry seasons</li>
                </ul>
                </div>
              </div>
            </div>
          </div>

                {/* Environmental Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Soil pH</label>
            <input
              type="number"
              name="pH"
              value={currentConditions.pH}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md shadow-sm ${
                isDarkMode
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-blue-600'
              }`}
              step="0.1"
              min="0"
              max="14"
            />
              </div>
          <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Moisture Level</label>
            <select
              name="moisture"
              value={currentConditions.moisture}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md shadow-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-blue-600'
              }`}
            >
              <option value="very_dry">Very Dry</option>
              <option value="dry">Dry</option>
              <option value="moderate">Moderate</option>
              <option value="moist">Moist</option>
              <option value="very_moist">Very Moist</option>
            </select>
          </div>
          <div className={`p-4 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Last Fertilized</label>
            <input
              type="date"
              name="lastFertilized"
              value={currentConditions.lastFertilized}
              onChange={handleInputChange}
              className={`mt-1 block w-full rounded-md shadow-sm ${
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500' 
                  : 'bg-white border-gray-300 text-gray-900 focus:border-blue-600 focus:ring-blue-600'
              }`}
            />
          </div>
                </div>

        {/* ML Insights Component */}
        {mlAnalysis && historicalHarvests.length > 0 && (
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
            <MLInsights
              environmentalData={plantStatuses.map(status => ({
                timestamp: status.timestamp,
                temperature: safeParseFloat(status.temperature, 25),
                humidity: safeParseFloat(status.humidity, 70),
                pH: safeParseFloat(status.soil_ph, 6.5)
              }))}
              growthData={historicalHarvests.map(h => ({
                value: safeParseFloat(h.coffee_raw_quantity, 0),
                timestamp: new Date(h.harvest_date)
              }))}
            />
                  </div>
                )}
        {mlAnalysis && historicalHarvests.length === 0 && (
          <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow-lg mb-8`}>
            <div className="text-center py-8">
              <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                No Growth Forecast Available
              </h3>
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Growth forecast requires harvest data. Please record some harvests to see predictions and insights.
              </p>
              </div>
            </div>
          )}

        {/* Plant Sub-Analytics Section */}
        <div className="mt-8">
          <h2 className={`text-xl font-semibold mb-6 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Individual Plant Analytics
          </h2>
          <div className="space-y-6">
                  {plants.map(plant => (
              <PlantSubAnalytics
                      key={plant.plant_id}
                plant={plant}
                historicalHarvests={historicalHarvests}
                plantStatuses={plantStatuses}
                weatherForecast={weatherForecast}
                isDarkMode={isDarkMode}
              />
            ))}
            </div>
        </div>

        {/* Additional Analytics */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Historical Trends */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Historical Trends</h2>
            {historicalHarvests.length > 0 && (
                <Line
                data={{
                  labels: historicalHarvests.map(h => new Date(h.harvest_date).toLocaleDateString()),
                  datasets: [{
                    label: 'Raw Coffee Yield (kg)',
                    data: historicalHarvests.map(h => safeParseFloat(h.coffee_raw_quantity, 0)),
                    borderColor: isDarkMode ? 'rgba(147, 197, 253, 1)' : 'rgba(59, 130, 246, 1)',
                    backgroundColor: isDarkMode ? 'rgba(147, 197, 253, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  }]
                }}
                  options={{
                    responsive: true,
                  plugins: {
                    legend: {
                      position: 'top',
                      labels: {
                        color: isDarkMode ? '#fff' : '#1f2937'
                      }
                    },
                    title: {
                      display: true,
                      text: 'Historical Harvest Yields',
                      color: isDarkMode ? '#fff' : '#1f2937'
                    }
                  },
                    scales: {
                      x: {
                        grid: {
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                        color: isDarkMode ? '#fff' : '#1f2937'
                        }
                      },
                    y: {
                        grid: {
                        color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                        color: isDarkMode ? '#fff' : '#1f2937'
                        }
                      }
                    }
                  }}
                />
            )}
          </div>

          {/* Environmental Impact */}
          <div className={`p-6 rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Environmental Impact</h2>
            {mlAnalysis?.environmentalStatus && (
              <div className="space-y-4">
                {Object.entries(mlAnalysis.environmentalStatus).map(([factor, data]) => (
                  <div key={factor} className="flex items-center justify-between">
                    <span className={`capitalize ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>{factor}</span>
                    <div className="flex items-center">
                      <span className={`px-2 py-1 rounded ${
                        data.status === 'optimal' 
                          ? isDarkMode ? 'bg-green-900 text-green-100' : 'bg-green-100 text-green-800'
                          : data.status === 'high'
                          ? isDarkMode ? 'bg-red-900 text-red-100' : 'bg-red-100 text-red-800'
                          : isDarkMode ? 'bg-yellow-900 text-yellow-100' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {safeParseFloat(data.value, 0)}{data.unit} ({data.status})
                      </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PredictiveAnalytics;