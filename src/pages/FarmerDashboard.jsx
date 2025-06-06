import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import "../styles/Styles.css"; // Ensure your styles are imported

// Import Chart.js components
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const FarmerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [farmerDetails, setFarmerDetails] = useState(null); // Will be null if no details declared
  const [totalFarmerPlants, setTotalFarmerPlants] = useState(0); // Sum of trees
  const [totalRawHarvests, setTotalRawHarvests] = useState(0); // Sum of raw quantity
  const [totalDryHarvests, setTotalDryHarvests] = useState(0); // Sum of dry quantity
  const [totalPremiumKg, setTotalPremiumKg] = useState(0); // Sum of premium grade in Kg
  const [totalFineKg, setTotalFineKg] = useState(0);       // Sum of fine grade in Kg
  const [totalCommercialKg, setTotalCommercialKg] = useState(0); // Sum of commercial grade in Kg
  const [recentFarmerActivities, setRecentFarmerActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for Chart Data
  const [harvestBarChartData, setHarvestBarChartData] = useState({
    labels: ['Raw Harvest', 'Dry Harvest'],
    datasets: [{
      label: 'Coffee Quantity (kg)',
      data: [0, 0],
      backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
      borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
      borderWidth: 1,
    }]
  });

  const [gradePieChartData, setGradePieChartData] = useState({
    labels: ['Premium', 'Fine', 'Commercial'],
    datasets: [{
      label: 'Graded Yield (kg)',
      data: [0, 0, 0],
      backgroundColor: [
        'rgba(255, 99, 132, 0.6)',
        'rgba(54, 162, 235, 0.6)',
        'rgba(255, 206, 86, 0.6)',
      ],
      borderColor: [
        'rgba(255, 99, 132, 1)',
        'rgba(54, 162, 235, 1)',
        'rgba(255, 206, 86, 1)',
      ],
      borderWidth: 1,
    }]
  });


  useEffect(() => {
    const fetchFarmerDashboardData = async () => {
      setLoading(true);
      setError("");

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate("/login");
        return;
      }
      // Set the base user info (auth user)
      setUser(authUser);

      // Fetch user's role and full name from 'users' table
      const { data: userData, error: userDetailsError } = await supabase
        .from("users")
        .select("first_name, last_name, email, role")
        .eq("email", authUser.email)
        .single();

      if (userDetailsError) {
        console.error("Error fetching user details:", userDetailsError.message);
        setError("Failed to fetch your user profile. Please try again.");
        setLoading(false);
        return;
      }
      // Update user state with details including role and names
      setUser(prevUser => ({ ...prevUser, ...userData }));

      // --- Access Control: Only allow farmers ---
      if (userData?.role !== "farmer") {
        setError("Access Denied: Only farmers can view this dashboard.");
        setLoading(false);
        // Optionally redirect to a generic dashboard or login if not a farmer
        // navigate("/dashboard", { replace: true });
        return;
      }
      // --- End Access Control ---

      try {
        // Fetch specific farmer details using user.id
        // Handle case where farmer_detail might not exist (new user)
        const { data: farmerData, error: farmerDetailError } = await supabase
          .from("farmer_detail")
          .select("id, farm_location, farm_size, farm_elevation")
          .eq("id", authUser.id) // IMPORTANT: Filter by the authenticated user's ID
          .single();

        if (farmerDetailError && farmerDetailError.code !== 'PGRST116') { // PGRST116 means no rows found, which is expected for new farmers
          throw farmerDetailError; // Re-throw other unexpected errors
        }

        // If farmerData is null (no details yet), farmerDetails will remain null, and the UI will show default.
        // If farmerData is found, set it.
        setFarmerDetails(farmerData);

        // Fetch Total Plants for this farmer (sum of 'number_of_tree_planted')
        const { data: plantData, error: plantsError } = await supabase
          .from("plant_data")
          .select("number_of_tree_planted") // Select the quantity column
          .eq("farmer_id", authUser.id); // IMPORTANT: Filter by farmer's ID
        if (plantsError) throw plantsError;

        // Sum up the number_of_tree_planted
        const sumTotalTrees = plantData.reduce((sum, plant) => sum + (plant.number_of_tree_planted || 0), 0);
        setTotalFarmerPlants(sumTotalTrees);


        // Fetch ALL relevant Harvest data for this farmer
        const { data: harvestData, error: harvestsError } = await supabase
          .from("harvest_data")
          .select("coffee_raw_quantity, coffee_dry_quantity, coffee_premium_grade, coffee_fine_grade, coffee_commercial_grade, harvest_date") // Select all relevant columns
          .eq("farmer_id", authUser.id); // IMPORTANT: Filter by farmer's ID
        if (harvestsError) throw harvestsError;

        // Sum up the coffee quantities
        const sumRawQuantity = harvestData.reduce((sum, harvest) => sum + (harvest.coffee_raw_quantity || 0), 0);
        setTotalRawHarvests(sumRawQuantity);

        const sumDryQuantity = harvestData.reduce((sum, harvest) => sum + (harvest.coffee_dry_quantity || 0), 0);
        setTotalDryHarvests(sumDryQuantity);

        // Calculate total Kg for each grade (assuming grades are percentages of raw quantity)
        // Ensure raw_quantity is used for grade calculation if grades are percentages
        const sumPremiumKg = harvestData.reduce((sum, harvest) => sum + ((harvest.coffee_premium_grade / 100) * (harvest.coffee_raw_quantity || 0) || 0), 0);
        setTotalPremiumKg(sumPremiumKg);

        const sumFineKg = harvestData.reduce((sum, harvest) => sum + ((harvest.coffee_fine_grade / 100) * (harvest.coffee_raw_quantity || 0) || 0), 0);
        setTotalFineKg(sumFineKg);

        const sumCommercialKg = harvestData.reduce((sum, harvest) => sum + ((harvest.coffee_commercial_grade / 100) * (harvest.coffee_raw_quantity || 0) || 0), 0);
        setTotalCommercialKg(sumCommercialKg);

        // Update Chart Data
        setHarvestBarChartData({
          labels: ['Raw Harvest', 'Dry Harvest'],
          datasets: [{
            label: 'Coffee Quantity (kg)',
            data: [sumRawQuantity, sumDryQuantity],
            backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(153, 102, 255, 0.6)'],
            borderColor: ['rgba(75, 192, 192, 1)', 'rgba(153, 102, 255, 1)'],
            borderWidth: 1,
          }]
        });

        const totalGradedYield = sumPremiumKg + sumFineKg + sumCommercialKg;
        setGradePieChartData({
          labels: ['Premium', 'Fine', 'Commercial'],
          datasets: [{
            label: 'Graded Yield (kg)',
            data: [sumPremiumKg, sumFineKg, sumCommercialKg],
            backgroundColor: [
              'rgba(255, 99, 132, 0.6)', // Premium
              'rgba(54, 162, 235, 0.6)', // Fine
              'rgba(255, 206, 86, 0.6)', // Commercial
            ],
            borderColor: [
              'rgba(255, 99, 132, 1)',
              'rgba(54, 162, 235, 1)',
              'rgba(255, 206, 86, 1)',
            ],
            borderWidth: 1,
          }]
        });


        // Fetch Recent Activities for this farmer
        // Get recent plant declarations
        const { data: recentPlants, error: recentPlantsError } = await supabase
          .from("plant_data")
          .select("planting_date, coffee_variety")
          .eq("farmer_id", authUser.id)
          .order("planting_date", { ascending: false })
          .limit(3);

        // Get recent harvest records (use the already fetched harvestData for activities)
        // Sort the fetched harvestData by date for recent activities
        const sortedRecentHarvests = [...harvestData].sort((a, b) => new Date(b.harvest_date) - new Date(a.harvest_date)).slice(0, 3);


        let activities = [];
        if (!recentPlantsError && recentPlants) {
          activities = activities.concat(recentPlants.map(p => ({
            date: new Date(p.planting_date).toLocaleDateString(),
            activity: `New Plant Declaration: ${p.coffee_variety}`,
            status: "Completed"
          })));
        } else if (recentPlantsError) {
          console.error("Error fetching recent plants:", recentPlantsError);
        }

        if (sortedRecentHarvests) { // Use sortedRecentHarvests directly
          activities = activities.concat(sortedRecentHarvests.map(h => ({
            date: new Date(h.harvest_date).toLocaleDateString(),
            activity: "Harvest Recorded",
            status: "Completed"
          })));
        }
        // No need for else if (recentHarvestsError) here, as we're using already fetched data.

        // Sort activities by date in descending order and limit to top 5
        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentFarmerActivities(activities.slice(0, 5));

      } catch (err) {
        console.error("Failed to fetch farmer dashboard data:", err);
        setError(`Failed to load your dashboard data: ${err.message}`);
        // If a critical error occurs, it should still show the error state.
      } finally {
        setLoading(false);
      }
    };

    fetchFarmerDashboardData();
  }, [navigate]); // navigate is a dependency

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  // Navigation links for farmer dashboard
  const farmerNavLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" }, // This new dashboard
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = farmerNavLinks;

  // Chart options for Bar Graph (Harvests)
  const harvestBarChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Raw vs. Dry Coffee Harvest (kg)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed.y !== null) {
                label += context.parsed.y.toFixed(2) + ' kg';
            }
            return label;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Harvest Type',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Quantity (kg)',
        },
        beginAtZero: true,
      },
    },
  };

  // Chart options for Pie Chart (Graded Yield)
  const gradePieChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Distribution of Graded Yield (kg)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed !== null) {
                label += context.parsed.toFixed(2) + ' kg';
            }
            return label;
          }
        }
      }
    },
  };


  if (loading) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 rounded-lg shadow`}>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Error</h1>
            <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{error}</p>
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
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Farmer Panel</h1>
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
            {farmerNavLinks.map((link) => (
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
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Farmer Dashboard</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Welcome back, {user.first_name} {user.last_name}
              </p>
            )}
          </div>

          {/* Stats Grid - Single Row */}
          <div className="flex flex-row gap-6 mb-8">
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Plants</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalFarmerPlants}</p>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Raw Harvest (kg)</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalRawHarvests}</p>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dry Harvest (kg)</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalDryHarvests}</p>
            </div>
          </div>

          {/* Charts Grid - Single Row */}
          <div className="flex flex-row gap-6 mb-8">
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Harvest Distribution</h3>
              <div className="h-64">
                <Bar data={harvestBarChartData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Grade Distribution</h3>
              <div className="h-64">
                <Pie data={gradePieChartData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div className={`rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activities</h3>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {recentFarmerActivities.map((activity, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activity.activity}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{activity.date}</span>
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        {activity.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerDashboard;