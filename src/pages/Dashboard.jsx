import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { useAuth } from "../lib/AuthProvider";
import Layout from '../components/Layout';

// Import Chart.js components
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title } from 'chart.js';
import { Pie, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, Title);

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user } = useAuth();
  const [totalFarmers, setTotalFarmers] = useState(0);
  const [totalHarvests, setTotalHarvests] = useState(0); // This will now be total quantity
  const [totalPlants, setTotalPlants] = useState(0);     // This will now be total number of trees
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // States for Chart Data
  const [gradeDistributionData, setGradeDistributionData] = useState({
    labels: [],
    datasets: []
  });
  const [seasonalHarvestData, setSeasonalHarvestData] = useState({
    labels: [],
    datasets: []
  });
  const [forecastedHarvestAmount, setForecastedHarvestAmount] = useState(null);


  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user) {
        navigate("/login");
        return;
      }

      // Redirect non-admin users immediately
      if (user.role !== "admin") {
        navigate("/farmer-dashboard", { replace: true });
        return;
      }

      setLoading(true);
      setError("");

      try {
        // Fetch all data in parallel using Promise.all
        const [
          farmersResult,
          harvestResult,
          plantResult,
          recentFarmersResult,
          recentHarvestsResult
        ] = await Promise.all([
          // Total Farmers count
          supabase.from("farmer_detail").select("id", { count: "exact" }),
          
          // Harvest data
          supabase.from("harvest_data").select(`
            coffee_raw_quantity,
            coffee_fine_grade,
            coffee_premium_grade,
            coffee_commercial_grade,
            harvest_date
          `),
          
          // Plant data
          supabase.from("plant_data").select("number_of_tree_planted"),
          
          // Recent farmers
          supabase.from("farmer_detail")
            .select("id, created_at, users(first_name, last_name)")
            .order("created_at", { ascending: false })
            .limit(3),
          
          // Recent harvests
          supabase.from("harvest_data")
            .select("harvest_date, farmer_id, farmer_detail(users(first_name, last_name))")
            .order("harvest_date", { ascending: false })
            .limit(3)
        ]);

        // Handle any errors from the parallel requests
        const errors = [
          farmersResult.error,
          harvestResult.error,
          plantResult.error,
          recentFarmersResult.error,
          recentHarvestsResult.error
        ].filter(Boolean);

        if (errors.length > 0) {
          throw new Error(errors[0].message);
        }

        // Process farmers count
        setTotalFarmers(farmersResult.count);

        // Process harvest data
        const harvestData = harvestResult.data;
        const sumRawQuantity = harvestData.reduce((sum, harvest) => 
          sum + (harvest.coffee_raw_quantity || 0), 0);
        setTotalHarvests(sumRawQuantity);

        // Process plant data
        const plantData = plantResult.data;
        const sumTotalTrees = plantData.reduce((sum, plant) => 
          sum + (plant.number_of_tree_planted || 0), 0);
        setTotalPlants(sumTotalTrees);

        // Process grade distribution data
        const totalFine = harvestData.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0);
        const totalPremium = harvestData.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0);
        const totalCommercial = harvestData.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0);

        setGradeDistributionData({
          labels: ['Fine Grade', 'Premium Grade', 'Commercial Grade'],
          datasets: [{
            data: [totalFine, totalPremium, totalCommercial],
            backgroundColor: ['#6b4226', '#d2a679', '#f8d3ac'],
            hoverBackgroundColor: ['#8c5c3e', '#e0b58e', '#fae2bb']
          }]
        });

        // Process seasonal harvest data
        const monthlyHarvests = harvestData.reduce((acc, harvest) => {
          if (harvest.harvest_date && harvest.coffee_raw_quantity) {
            const date = new Date(harvest.harvest_date);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            acc[monthYear] = (acc[monthYear] || 0) + harvest.coffee_raw_quantity;
          }
          return acc;
        }, {});

        const sortedMonths = Object.keys(monthlyHarvests).sort();
        
        setSeasonalHarvestData({
          labels: sortedMonths.map(my => {
            const [year, month] = my.split('-');
            const date = new Date(year, parseInt(month) - 1);
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          }),
          datasets: [{
            label: 'Total Raw Coffee Harvest (kg)',
            data: sortedMonths.map(my => monthlyHarvests[my]),
            fill: false,
            borderColor: '#6b4226',
            tension: 0.1,
            pointBackgroundColor: '#d2a679',
            pointBorderColor: '#6b4226',
          }]
        });

        // Process recent activities
        const activities = [
          ...(recentFarmersResult.data || []).map(f => ({
            date: new Date(f.created_at).toLocaleDateString(),
            activity: "New Farmer Registration",
            farmer: `${f.users?.first_name || 'N/A'} ${f.users?.last_name || ''}`,
            status: "Completed"
          })),
          ...(recentHarvestsResult.data || []).map(h => ({
            date: new Date(h.harvest_date).toLocaleDateString(),
            activity: "Harvest Recorded",
            farmer: `${h.farmer_detail?.users?.first_name || 'N/A'} ${h.farmer_detail?.users?.last_name || ''}`,
            status: "Completed"
          }))
        ];

        activities.sort((a, b) => new Date(b.date) - new Date(a.date));
        setRecentActivities(activities.slice(0, 5));

      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setError(`Failed to load dashboard data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate, user]);

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

  const farmerNavLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" }, // This should go to farmer dashboard
    { name: "User Profile", path: "/user-profile" }, // Consistent with farmer
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : farmerNavLinks;


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center space-x-4">
              <div className="text-4xl">☕</div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Logout
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Farmers</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{totalFarmers}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Harvests (kg)</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{totalHarvests}</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900">Total Plants</h3>
              <p className="mt-2 text-3xl font-bold text-indigo-600">{totalPlants}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Grade Distribution</h3>
              <div className="h-64">
                <Pie data={gradeDistributionData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Seasonal Harvest</h3>
              <div className="h-64">
                <Line data={seasonalHarvestData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Recent Activities</h3>
            </div>
            <div className="divide-y divide-gray-200">
              {recentActivities.map((activity, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{activity.activity}</p>
                      <p className="text-sm text-gray-500">by {activity.farmer}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-sm text-gray-500">{activity.date}</span>
                      <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                        {activity.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {navLinks.map((link) => (
              <button
                key={link.path}
                onClick={() => navigate(link.path)}
                className="px-4 py-2 text-sm font-medium text-indigo-600 bg-white border border-indigo-600 rounded-md hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {link.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // If not admin, the component would have already redirected.
  if (user?.role !== "admin") {
      return null;
  }

  return (
    <Layout>
      <div className={`max-w-7xl mx-auto`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Dashboard Overview</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Welcome back, {user.first_name} {user.last_name}
              </p>
            )}
          </div>

          {/* Stats Grid - Single Row */}
          <div className="flex flex-row gap-6 mb-8">
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Farmers</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalFarmers}</p>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Harvests (kg)</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalHarvests}</p>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Total Plants</h3>
              <p className={`mt-2 text-3xl font-bold ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>{totalPlants}</p>
            </div>
          </div>

          {/* Charts Grid - Single Row */}
          <div className="flex flex-row gap-6 mb-8">
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Grade Distribution</h3>
              <div className="h-64">
                <Pie data={gradeDistributionData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
            <div className={`flex-1 p-6 rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Seasonal Harvest</h3>
              <div className="h-64">
                <Line data={seasonalHarvestData} options={{ maintainAspectRatio: false }} />
              </div>
            </div>
          </div>

          {/* Recent Activities */}
          <div className={`rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Recent Activities</h3>
            </div>
            <div className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
              {recentActivities.map((activity, index) => (
                <div key={index} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{activity.activity}</p>
                      <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>by {activity.farmer}</p>
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
    </Layout>
  );
};

export default Dashboard;