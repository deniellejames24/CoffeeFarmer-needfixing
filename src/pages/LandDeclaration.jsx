import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useTheme } from "../lib/ThemeContext";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const LandDeclaration = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDarkMode, toggleTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [farmerDetails, setFarmerDetails] = useState({
    farm_location: "",
    farm_size: "",
    farm_elevation: "",
    // plant_id is no longer needed here as a single link, it will be handled by foreign keys
  });
  const [plantDataList, setPlantDataList] = useState([]); // Array to hold multiple plant entries
  const [plantInputForm, setPlantInputForm] = useState({ // State for the single plant input form
    plant_id: null, // Will be null for new plants, set for editing
    coffee_variety: "",
    planting_date: "",
    number_of_tree_planted: "",
  });
  const [hasFarmerDetail, setHasFarmerDetail] = useState(false);
  const [isEditingFarmerDetail, setIsEditingFarmerDetail] = useState(false);
  const [isEditingPlant, setIsEditingPlant] = useState(false); // New state to manage editing an individual plant
  const [showPlantForm, setShowPlantForm] = useState(false); // Controls visibility of the plant data input form

  useEffect(() => {
    const fetchUserAndDetails = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }
      setUser(user);

      // Fetch user's role for navigation links
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("first_name, last_name, email, role")
        .eq("email", user.email)
        .single();
      if (!userError) setUser(prevUser => ({ ...prevUser, ...userData }));

      // Fetch farmer details
      const { data: farmerData, error: farmerError } = await supabase
        .from("farmer_detail")
        .select("*")
        .eq("id", user.id)
        .single();

      if (farmerError && farmerError.code === 'PGRST116') { // No rows found
        setHasFarmerDetail(false);
        setIsEditingFarmerDetail(true);
        toast.info("No farmer details found. Please declare your farm.");
      } else if (farmerData) {
        setFarmerDetails(farmerData);
        setHasFarmerDetail(true);
        setIsEditingFarmerDetail(false);
        toast.success("Farmer details loaded.");

        // Fetch all plant data associated with this farmer's ID
        const { data: plantDataFetched, error: plantListError } = await supabase
          .from("plant_data")
          // Assuming plant_data has a 'farmer_id' column linked to 'farmer_detail.id'
          .select("*")
          .eq("farmer_id", farmerData.id); // IMPORTANT: You MUST have a farmer_id column in plant_data

        if (!plantListError) {
          setPlantDataList(plantDataFetched || []);
          // If there's existing plant data, keep the form hidden initially
          setShowPlantForm(false);
        } else {
          console.error("Error fetching plant data list:", plantListError);
          toast.error("Error fetching associated plant data.");
          setPlantDataList([]);
        }
      } else if (farmerError) {
        console.error("Error fetching farmer details:", farmerError);
        toast.error("Error fetching farmer details.");
      }
    };
    fetchUserAndDetails();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleFarmerDetailChange = (e) => {
    const { name, value } = e.target;
    setFarmerDetails((prev) => ({ ...prev, [name]: value }));
  };

  const handlePlantInputChange = (e) => {
    const { name, value } = e.target;
    setPlantInputForm((prev) => ({ ...prev, [name]: value }));
  };

  const saveFarmerDetails = async () => {
    if (!user) {
      toast.error("User not authenticated.");
      return;
    }

    if (!farmerDetails.farm_location || farmerDetails.farm_size === "" || farmerDetails.farm_elevation === "") {
      toast.warning("Please fill all farmer detail fields.");
      return;
    }
    const parsedFarmSize = parseFloat(farmerDetails.farm_size);
    const parsedFarmElevation = parseFloat(farmerDetails.farm_elevation);

    if (isNaN(parsedFarmSize) || parsedFarmSize < 0 || isNaN(parsedFarmElevation) || parsedFarmElevation < 0) {
      toast.warning("Farm size and elevation must be valid positive numbers.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("farmer_detail")
        .upsert(
          {
            id: user.id, // Link to authenticated user's UUID
            farm_location: farmerDetails.farm_location,
            farm_size: parsedFarmSize,
            farm_elevation: parsedFarmElevation,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (error) {
        throw error;
      }

      setFarmerDetails(data);
      setHasFarmerDetail(true);
      setIsEditingFarmerDetail(false);
      toast.success("Farmer details saved successfully!");
    } catch (error) {
      console.error("Error saving farmer details:", error);
      toast.error(`Error saving farmer details: ${error.message}`);
    }
  };

  const savePlantData = async (e) => {
    e.preventDefault(); // Prevent default form submission
    if (!user || !hasFarmerDetail || !farmerDetails.id) {
      toast.error("Farmer details not saved or user not authenticated.");
      return;
    }

    if (!plantInputForm.coffee_variety || !plantInputForm.planting_date || plantInputForm.number_of_tree_planted === "") {
      toast.warning("Please fill all plant data fields.");
      return;
    }
    const parsedNumTrees = parseInt(plantInputForm.number_of_tree_planted, 10);
    if (isNaN(parsedNumTrees) || parsedNumTrees <= 0) {
      toast.warning("Number of trees planted must be a positive whole number.");
      return;
    }

    try {
      if (plantInputForm.plant_id) {
        // Update existing plant_data
        const { error: updateError } = await supabase
          .from("plant_data")
          .update({
            coffee_variety: plantInputForm.coffee_variety,
            planting_date: plantInputForm.planting_date,
            number_of_tree_planted: parsedNumTrees,
            // Assuming farmer_id cannot change once set for a plant entry
          })
          .eq("plant_id", plantInputForm.plant_id);

        if (updateError) throw updateError;
        toast.success("Plant data updated successfully!");

      } else {
        // Insert new plant_data
        const { data: newPlant, error: insertError } = await supabase
          .from("plant_data")
          .insert({
            farmer_id: farmerDetails.id, // Link to the farmer's UUID
            coffee_variety: plantInputForm.coffee_variety,
            planting_date: plantInputForm.planting_date,
            number_of_tree_planted: parsedNumTrees,
          })
          .select("plant_id") // Select only the ID to get the newly generated one
          .single();

        if (insertError) throw insertError;
        toast.success("Plant data added successfully!");
      }

      // Re-fetch all plant data to update the list
      const { data: updatedPlantList, error: fetchError } = await supabase
        .from("plant_data")
        .select("*")
        .eq("farmer_id", farmerDetails.id);

      if (fetchError) throw fetchError;
      setPlantDataList(updatedPlantList || []);

      // Reset form and hide it after successful save/update
      setPlantInputForm({
        plant_id: null,
        coffee_variety: "",
        planting_date: "",
        number_of_tree_planted: "",
      });
      setShowPlantForm(false);
      setIsEditingPlant(false); // Exit editing mode for plant
    } catch (error) {
      console.error("Error saving plant data:", error);
      toast.error(`Error saving plant data: ${error.message}`);
    }
  };

  const editPlant = (plant) => {
    setPlantInputForm({
      plant_id: plant.plant_id,
      coffee_variety: plant.coffee_variety,
      planting_date: plant.planting_date.split('T')[0], // Format for date input
      number_of_tree_planted: plant.number_of_tree_planted,
    });
    setShowPlantForm(true);
    setIsEditingPlant(true);
  };

  const deletePlant = async (plantId) => {
    if (!window.confirm("Are you sure you want to delete this plant entry?")) return;

    try {
      const { error } = await supabase
        .from("plant_data")
        .delete()
        .eq("plant_id", plantId);

      if (error) throw error;

      toast.success("Plant data deleted successfully!");
      setPlantDataList(plantDataList.filter(plant => plant.plant_id !== plantId));

      // If the deleted plant was being edited, reset the form
      if (plantInputForm.plant_id === plantId) {
        setPlantInputForm({ plant_id: null, coffee_variety: "", planting_date: "", number_of_tree_planted: "" });
        setShowPlantForm(false);
        setIsEditingPlant(false);
      }
    } catch (error) {
      console.error("Error deleting plant data:", error);
      toast.error(`Error deleting plant data: ${error.message}`);
    }
  };

  const cancelPlantEdit = () => {
    setPlantInputForm({ plant_id: null, coffee_variety: "", planting_date: "", number_of_tree_planted: "" });
    setShowPlantForm(false);
    setIsEditingPlant(false);
  };

  const adminLinks = [
    { name: "Dashboard", path: "/dashboard" },
    { name: "User Management", path: "/user-management" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "Data Entry", path: "/data-entry" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
  ];

  const userLinks = [
    { name: "Dashboard", path: "/farmer-dashboard" },
    { name: "User Profile", path: "/user-profile" },
    { name: "Predictive Analytics", path: "/predictive-analytics" },
    { name: "DSS Recommendations", path: "/dss-recommendations" },
    { name: "Coffee Grade Predictor", path: "/coffee-grader" },
    { name: "Land & Plant Declaration", path: "/land-declaration" },
    { name: "Harvest Reporting", path: "/harvest-reporting" },
  ];

  const navLinks = user?.role === "admin" ? adminLinks : userLinks;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex`}>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={isDarkMode ? "dark" : "light"}
      />
      {/* Sidebar Navigation */}
      <div className={`w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg relative`}>
        <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="text-2xl">☕</div>
              <h1 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Land Declaration</h1>
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
            <h1 className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Land & Plant Declaration</h1>
            {user && (
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Manage your farm and plant information
              </p>
            )}
          </div>

          {/* Farmer Details Form */}
          <div className={`bg-white rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white bg-gray-700' : 'text-gray-900'}`}>
                {hasFarmerDetail && !isEditingFarmerDetail ? 'Farm Information' : 'Declare Farm Information'}
              </h3>
            </div>
            <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              {hasFarmerDetail && !isEditingFarmerDetail ? (
                <div className="space-y-4">
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Location</p>
                    <p className={`mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{farmerDetails.farm_location}</p>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Size (hectares)</p>
                    <p className={`mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{farmerDetails.farm_size}</p>
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Elevation (meters)</p>
                    <p className={`mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{farmerDetails.farm_elevation}</p>
                  </div>
                  <button
                    onClick={() => setIsEditingFarmerDetail(true)}
                    className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                        : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    }`}
                  >
                    Edit Farm Details
                  </button>
                </div>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); saveFarmerDetails(); }} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label htmlFor="farm_location" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Farm Location
                      </label>
                      <input
                        type="text"
                        id="farm_location"
                        name="farm_location"
                        value={farmerDetails.farm_location}
                        onChange={handleFarmerDetailChange}
                        required
                        className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label htmlFor="farm_size" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Farm Size (hectares)
                      </label>
                      <input
                        type="number"
                        id="farm_size"
                        name="farm_size"
                        value={farmerDetails.farm_size}
                        onChange={handleFarmerDetailChange}
                        required
                        min="0"
                        step="0.01"
                        className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                          isDarkMode 
                            ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                            : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                        }`}
                      />
                    </div>
                    <div>
                      <label htmlFor="farm_elevation" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Farm Elevation (meters)
                      </label>
                      <input
                        type="number"
                        id="farm_elevation"
                        name="farm_elevation"
                        value={farmerDetails.farm_elevation}
                        onChange={handleFarmerDetailChange}
                        required
                        min="0"
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
                      Save Farm Details
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          {/* Plant Data Section */}
          {hasFarmerDetail && (
            <div className={`mt-8 bg-white rounded-lg shadow ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className={`px-6 py-4 border-b ${isDarkMode ? 'border-gray-700 bg-gray-700' : 'border-gray-200'}`}>
                <h3 className={`text-lg font-medium ${isDarkMode ? 'text-white bg-gray-700' : 'text-gray-900'}`}>Plant Data</h3>
              </div>
              <div className={`p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
                {plantDataList.length > 0 ? (
                  <div className="space-y-4">
                    {plantDataList.map((plant) => (
                      <div key={plant.plant_id} className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Coffee Variety</p>
                            <p className={`mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{plant.coffee_variety}</p>
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Planting Date</p>
                            <p className={`mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                              {new Date(plant.planting_date).toLocaleDateString()}
                            </p>
                          </div>
                          <div>
                            <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Number of Trees</p>
                            <p className={`mt-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{plant.number_of_tree_planted}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end space-x-2">
                          <button
                            onClick={() => {
                              setPlantInputForm({
                                plant_id: plant.plant_id,
                                coffee_variety: plant.coffee_variety,
                                planting_date: plant.planting_date.split('T')[0],
                                number_of_tree_planted: plant.number_of_tree_planted,
                              });
                              setIsEditingPlant(true);
                              setShowPlantForm(true);
                            }}
                            className={`px-3 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              isDarkMode
                                ? 'text-indigo-400 bg-gray-600 hover:bg-gray-500 focus:ring-indigo-500'
                                : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 focus:ring-indigo-500'
                            }`}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deletePlant(plant.plant_id)}
                            className={`px-3 py-1 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                              isDarkMode
                                ? 'text-red-400 bg-gray-600 hover:bg-gray-500 focus:ring-red-500'
                                : 'text-red-600 bg-red-50 hover:bg-red-100 focus:ring-red-500'
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    No plant data recorded yet. Click "Add New Plant Data" to get started.
                  </p>
                )}

                {!showPlantForm && (
                  <button
                    onClick={() => {
                      setShowPlantForm(true);
                      setPlantInputForm({
                        plant_id: null,
                        coffee_variety: "",
                        planting_date: "",
                        number_of_tree_planted: "",
                      });
                      setIsEditingPlant(false);
                    }}
                    className={`mt-4 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      isDarkMode
                        ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                        : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                    }`}
                  >
                    Add New Plant Data
                  </button>
                )}

                {showPlantForm && (
                  <div className={`mt-6 p-4 rounded-lg ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <h4 className={`text-lg font-medium mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      {isEditingPlant ? 'Edit Plant Data' : 'Add New Plant Data'}
                    </h4>
                    <form onSubmit={savePlantData} className="space-y-6">
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                        <div>
                          <label htmlFor="coffee_variety" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Coffee Variety
                          </label>
                          <input
                            type="text"
                            id="coffee_variety"
                            name="coffee_variety"
                            value={plantInputForm.coffee_variety}
                            onChange={handlePlantInputChange}
                            required
                            className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label htmlFor="planting_date" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Planting Date
                          </label>
                          <input
                            type="date"
                            id="planting_date"
                            name="planting_date"
                            value={plantInputForm.planting_date}
                            onChange={handlePlantInputChange}
                            required
                            className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                        <div>
                          <label htmlFor="number_of_tree_planted" className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Number of Trees Planted
                          </label>
                          <input
                            type="number"
                            id="number_of_tree_planted"
                            name="number_of_tree_planted"
                            value={plantInputForm.number_of_tree_planted}
                            onChange={handlePlantInputChange}
                            required
                            min="1"
                            className={`mt-1 block w-full rounded-md shadow-sm text-black ${
                              isDarkMode 
                                ? 'bg-gray-700 border-gray-600 text-white focus:border-indigo-500 focus:ring-indigo-500'
                                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPlantForm(false);
                            setIsEditingPlant(false);
                          }}
                          className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            isDarkMode
                              ? 'text-gray-300 bg-gray-600 hover:bg-gray-500 focus:ring-gray-500'
                              : 'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500'
                          }`}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            isDarkMode
                              ? 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                              : 'text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500'
                          }`}
                        >
                          {isEditingPlant ? 'Update Plant Data' : 'Add Plant Data'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandDeclaration;