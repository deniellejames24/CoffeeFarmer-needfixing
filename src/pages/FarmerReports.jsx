import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";

// Import Chart.js components
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const FarmerReports = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [farmersReport, setFarmersReport] = useState([]);
  const [filteredFarmers, setFilteredFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [searchName, setSearchName] = useState("");
  const [searchLocation, setSearchLocation] = useState("");
  const [minYield, setMinYield] = useState("");
  const [minTrees, setMinTrees] = useState("");

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

  // Function to fetch all necessary data and combine them
  const fetchAllFarmerData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all users (specifically farmers)
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, first_name, middle_name, last_name, email, role')
        .eq('role', 'farmer');

      if (usersError) throw usersError;

      // 2. Fetch all farmer_detail
      const { data: farmerDetailData, error: farmerDetailError } = await supabase
        .from('farmer_detail')
        .select('id, farm_location, farm_size, farm_elevation');

      if (farmerDetailError) throw farmerDetailError;

      // 3. Fetch all plant_data
      const { data: plantData, error: plantError } = await supabase
        .from('plant_data')
        .select('farmer_id, number_of_tree_planted'); // Only need these for aggregation

      if (plantError) throw plantError;

      // 4. Fetch all harvest_data
      const { data: harvestData, error: harvestError } = await supabase
        .from('harvest_data')
        .select('farmer_id, coffee_raw_quantity, coffee_dry_quantity, coffee_premium_grade, coffee_fine_grade, coffee_commercial_grade');

      if (harvestError) throw harvestError;

      // --- Data Aggregation and Joining ---
      const aggregatedReports = usersData.map(user => {
        const detail = farmerDetailData.find(fd => fd.id === user.id);

        // Aggregate plant data for the current farmer
        const farmerPlants = plantData.filter(pd => pd.farmer_id === user.id);
        const totalTrees = farmerPlants.reduce((sum, p) => sum + (p.number_of_tree_planted || 0), 0);

        // Aggregate harvest data for the current farmer
        const farmerHarvests = harvestData.filter(hd => hd.farmer_id === user.id);
        const totalRawQuantity = farmerHarvests.reduce((sum, h) => sum + (h.coffee_raw_quantity || 0), 0);
        const totalDryQuantity = farmerHarvests.reduce((sum, h) => sum + (h.coffee_dry_quantity || 0), 0);

        const sumPremium = farmerHarvests.reduce((sum, h) => sum + (h.coffee_premium_grade || 0), 0);
        const sumFine = farmerHarvests.reduce((sum, h) => sum + (h.coffee_fine_grade || 0), 0);
        const sumCommercial = farmerHarvests.reduce((sum, h) => sum + (h.coffee_commercial_grade || 0), 0);
        const harvestCount = farmerHarvests.length;

        const avgPremium = harvestCount > 0 ? sumPremium / harvestCount : 0;
        const avgFine = harvestCount > 0 ? sumFine / harvestCount : 0;
        const avgCommercial = harvestCount > 0 ? sumCommercial / harvestCount : 0;

        return {
          id: user.id,
          first_name: user.first_name,
          middle_name: user.middle_name,
          last_name: user.last_name,
          email: user.email,
          role: user.role,
          farm_location: detail?.farm_location || 'N/A',
          farm_size: detail?.farm_size || 0,
          farm_elevation: detail?.farm_elevation || 0,
          total_trees: totalTrees,
          total_raw_quantity: totalRawQuantity,
          total_dry_quantity: totalDryQuantity,
          avg_premium_grade: avgPremium,
          avg_fine_grade: avgFine,
          avg_commercial_grade: avgCommercial,
          total_harvest_records: harvestCount,
        };
      });

      setFarmersReport(aggregatedReports);
      setFilteredFarmers(aggregatedReports); // Initialize filtered list with all data

    } catch (err) {
      console.error("Error fetching farmer report data:", err.message);
      setError("Failed to load farmer report data: " + err.message);
      setFarmersReport([]);
      setFilteredFarmers([]);
    } finally {
      setLoading(false);
    }
  }, []); // No dependencies, runs once on mount

  // Effect to filter farmers based on search and filter criteria
  useEffect(() => {
    let currentFiltered = farmersReport.filter(farmer => {
      // Filter by Name
      const fullName = `${farmer.first_name} ${farmer.last_name}`.toLowerCase();
      if (searchName && !fullName.includes(searchName.toLowerCase())) {
        return false;
      }

      // Filter by Location
      if (searchLocation && !farmer.farm_location.toLowerCase().includes(searchLocation.toLowerCase())) {
        return false;
      }

      // Filter by Minimum Yield
      const parsedMinYield = parseFloat(minYield);
      if (!isNaN(parsedMinYield) && farmer.total_raw_quantity < parsedMinYield) {
        return false;
      }

      // Filter by Minimum Trees
      const parsedMinTrees = parseInt(minTrees);
      if (!isNaN(parsedMinTrees) && farmer.total_trees < parsedMinTrees) {
        return false;
      }

      return true;
    });

    setFilteredFarmers(currentFiltered);
  }, [farmersReport, searchName, searchLocation, minYield, minTrees]);

  // Effect for initial auth check and data fetch
  useEffect(() => {
    const checkAuthAndFetchReports = async () => {
      setLoading(true);
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (!authUser) {
        navigate("/login");
        return;
      }

      const { data: loggedInUserData, error: userDetailsError } = await supabase
        .from("users")
        .select("first_name, last_name, role")
        .eq("email", authUser.email)
        .single();

      if (userDetailsError) {
        console.error("Error fetching logged-in user details:", userDetailsError.message);
        navigate("/login");
        return;
      }

      setLoggedInUser(loggedInUserData);

      if (loggedInUserData.role === "admin") {
        fetchAllFarmerData(); // Fetch reports if admin
      } else {
        navigate("/dashboard", { replace: true }); // Redirect if not admin
      }
    };

    checkAuthAndFetchReports();
  }, [navigate, fetchAllFarmerData]); // Depend on fetchAllFarmerData

  // Prepare data for the chart based on filtered farmers
  const chartData = {
    labels: filteredFarmers.map(f => `${f.first_name} ${f.last_name}`),
    datasets: [
      {
        label: 'Total Raw Coffee Quantity (kg)',
        data: filteredFarmers.map(f => f.total_raw_quantity),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Farmer Raw Coffee Yield Comparison',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
                label += ': ';
            }
            if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', { style: 'unit', unit: 'kilogram' }).format(context.parsed.y);
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
          text: 'Farmer',
        },
      },
      y: {
        title: {
          display: true,
          text: 'Total Raw Quantity (kg)',
        },
        beginAtZero: true,
      },
    },
  };

  // Determine top performers (e.g., top 3 by total_raw_quantity)
  const topPerformers = [...farmersReport] // Use farmersReport to ensure top performers are from all data, not just filtered
    .sort((a, b) => b.total_raw_quantity - a.total_raw_quantity)
    .slice(0, 3); // Get top 3

  if (loading) {
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
            <div className="mb-8">
              <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Farmer Reports</h1>
              {loggedInUser && (
                <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Welcome back, {loggedInUser.first_name} {loggedInUser.last_name}</p>
              )}
            </div>
            {/* Top Performers Section */}
            <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 mb-8`}>
              <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Top 3 Best Performing Farmers</h2>
              <div className="grid grid-cols-3 gap-4">
                {topPerformers.map((farmer, index) => (
                  <div 
                    key={farmer.id} 
                    className={`p-4 rounded-lg border ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        #{index + 1} {farmer.first_name} {farmer.last_name}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        index === 0 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : index === 1 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-orange-100 text-orange-800'
                      }`}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </span>
                    </div>
                    <div className={`space-y-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>
                      <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Location: {farmer.farm_location}</p>
                      <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Total Raw Yield: {farmer.total_raw_quantity} kg</p>
                      <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Total Trees: {farmer.total_trees}</p>
                      <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Premium Grade: {farmer.avg_premium_grade.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Filters */}
            <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 mb-8`}>
              <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Filters</h2>
              <div className="grid grid-cols-4 gap-4">
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                <input
                  type="text"
                  placeholder="Search by location..."
                  value={searchLocation}
                  onChange={e => setSearchLocation(e.target.value)}
                  className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                <input
                  type="number"
                  placeholder="Min yield (kg)"
                  value={minYield}
                  onChange={e => setMinYield(e.target.value)}
                  className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                <input
                  type="number"
                  placeholder="Min trees"
                  value={minTrees}
                  onChange={e => setMinTrees(e.target.value)}
                  className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>
            </div>
            {/* Chart */}
            <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 mb-8`}>
              <Bar data={chartData} options={chartOptions} />
            </div>
            {/* Table */}
            <div className={`rounded-lg shadow overflow-x-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Name</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Location</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Farm Size</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Elevation</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Total Trees</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Raw Yield (kg)</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Dry Yield (kg)</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Avg Premium</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Avg Fine</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Avg Commercial</th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>Harvest Records</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {filteredFarmers.map((farmer) => (
                    <tr key={farmer.id} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{farmer.first_name} {farmer.middle_name} {farmer.last_name}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.farm_location}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.farm_size}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.farm_elevation}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_trees}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_raw_quantity}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_dry_quantity}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.avg_premium_grade.toFixed(2)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.avg_fine_grade.toFixed(2)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.avg_commercial_grade.toFixed(2)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_harvest_records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <header className="page-header">
          <div className="logo">☕</div>
          <b><p>Farmer Reports</p></b>
          <div className="user-info">
            {loggedInUser && <span>{loggedInUser.role} | {loggedInUser.first_name} {loggedInUser.last_name}</span>}
            {loggedInUser && <button onClick={handleLogout} className="logout-btn">Logout</button>}
          </div>
        </header>
        <div className="page-main">
          <nav className="sidebar">
            <ul>
              {adminLinks.map((link) => (
                <li key={link.name} className={location.pathname === link.path ? "active" : ""}>
                  {link.name}
                </li>
              ))}
            </ul>
          </nav>
          <main className="content">
            <p className="error-message">Error: {error}</p>
            <p>Please try refreshing the page or contact support.</p>
          </main>
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
          <div className="mb-8">
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Farmer Reports</h1>
            {loggedInUser && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Welcome back, {loggedInUser.first_name} {loggedInUser.last_name}</p>
            )}
          </div>
          {/* Top Performers Section */}
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 mb-8`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Top 3 Best Performing Farmers</h2>
            <div className="grid grid-cols-3 gap-4">
                {topPerformers.map((farmer, index) => (
                <div 
                  key={farmer.id} 
                  className={`p-4 rounded-lg border ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600' 
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      #{index + 1} {farmer.first_name} {farmer.last_name}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-sm ${
                      index === 0 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : index === 1 
                          ? 'bg-gray-100 text-gray-800' 
                          : 'bg-orange-100 text-orange-800'
                    }`}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </span>
                  </div>
                  <div className={`space-y-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>
                    <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Location: {farmer.farm_location}</p>
                    <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Total Raw Yield: {farmer.total_raw_quantity} kg</p>
                    <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Total Trees: {farmer.total_trees}</p>
                    <p className={isDarkMode ? 'text-gray-200' : 'text-gray-700'}>Premium Grade: {farmer.avg_premium_grade.toFixed(2)}</p>
                  </div>
                  </div>
                ))}
              </div>
          </div>
          {/* Filters */}
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 mb-8`}>
            <h2 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Filters</h2>
            <div className="grid grid-cols-4 gap-4">
                <input
                  type="text"
                placeholder="Search by name..."
                  value={searchName}
                onChange={e => setSearchName(e.target.value)}
                className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                <input
                  type="text"
                placeholder="Search by location..."
                  value={searchLocation}
                onChange={e => setSearchLocation(e.target.value)}
                className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                <input
                  type="number"
                placeholder="Min yield (kg)"
                  value={minYield}
                onChange={e => setMinYield(e.target.value)}
                className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
                <input
                  type="number"
                placeholder="Min trees"
                  value={minTrees}
                onChange={e => setMinTrees(e.target.value)}
                className={`px-4 py-2 rounded-md border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
            </div>
          </div>
          {/* Chart */}
          <div className={`rounded-lg shadow-lg ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-6 mb-8`}>
              <Bar data={chartData} options={chartOptions} />
          </div>
          {/* Table */}
          <div className={`rounded-lg shadow overflow-x-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className={isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                <tr>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Name</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Location</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Farm Size</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Elevation</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Total Trees</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Raw Yield (kg)</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Dry Yield (kg)</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Avg Premium</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Avg Fine</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Avg Commercial</th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-100 bg-gray-700' : 'text-black-700 bg-indigo-100'}`}>Harvest Records</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                {filteredFarmers.map((farmer) => (
                  <tr key={farmer.id} className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{farmer.first_name} {farmer.middle_name} {farmer.last_name}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.farm_location}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.farm_size}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.farm_elevation}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_trees}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_raw_quantity}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_dry_quantity}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.avg_premium_grade.toFixed(2)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.avg_fine_grade.toFixed(2)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.avg_commercial_grade.toFixed(2)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>{farmer.total_harvest_records}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FarmerReports;