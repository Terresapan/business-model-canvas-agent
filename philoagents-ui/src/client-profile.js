import apiService from "./services/ApiService.js";

// Global state for client management
let currentFormMode = "create"; // 'create' or 'edit'
let selectedToken = null;
let allUsers = [];
let isInitialized = false;

// Initialize client profile management
export function initializeClientProfileManagement() {
  console.log("Initializing Client Profile Management...");
  console.log("Document ready state:", document.readyState);

  // Prevent double initialization
  if (isInitialized) {
    console.log("Already initialized, skipping...");
    return;
  }

  isInitialized = true;

  // Wait for DOM to be ready
  if (document.readyState === "loading") {
    console.log("DOM still loading, waiting for DOMContentLoaded...");
    document.addEventListener("DOMContentLoaded", () => {
      console.log("DOMContentLoaded fired, setting up form handlers...");
      setupFormHandlers();
    });
  } else {
    console.log("DOM already ready, setting up form handlers immediately...");
    setupFormHandlers();
  }

  // Load existing users
  loadAllUsers();
}

function setupFormHandlers() {
  console.log("=== Setting up form handlers ===");

  // Wait a bit for the form HTML to be injected
  setTimeout(() => {
    const formContainer = document.getElementById("client-form-container");
    const form = document.getElementById("client-form");

    console.log("Form container:", formContainer);
    console.log("Form element:", form);

    if (!formContainer || !form) {
      console.warn(
        "Form elements not found yet, form may be shown dynamically later"
      );
      return;
    }

    console.log("Form elements found, attaching handlers...");

    const submitBtn = document.getElementById("form-submit-btn");
    const cancelBtn = document.getElementById("form-cancel-btn");

    // Stop propagation of clicks on the form to prevent them reaching Phaser
    form.addEventListener("click", (e) => {
      e.stopPropagation();
    });
    // Also stop mousedown/up/pointer events just in case Phaser uses those
    form.addEventListener("mousedown", (e) => e.stopPropagation());
    form.addEventListener("pointerdown", (e) => e.stopPropagation());

    // Handle form submission
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleFormSubmit();
    });

    // Handle cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        hideForm();
      });
    }

    console.log("Form handlers setup complete");
  }, 100);
}

async function loadAllUsers() {
  try {
    console.log("Loading all users from API...");
    allUsers = await apiService.getAllBusinessUsers();
    console.log("Loaded users:", allUsers);
  } catch (error) {
    console.error("Error loading users:", error);
    allUsers = [];
  }
}

export function showCreateForm() {
  currentFormMode = "create";
  selectedToken = null;

  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const tokenField = document.getElementById("token");

  if (formTitle) formTitle.textContent = "Create New Client Profile";
  if (submitBtn) submitBtn.textContent = "Create Profile";

  // Clear form
  clearForm();

  // Make token field editable
  if (tokenField) {
    tokenField.readOnly = false;
    tokenField.style.backgroundColor = "#fff";
  }

  showForm();
}

export function showEditForm(token) {
  currentFormMode = "edit";
  selectedToken = token;

  const user = allUsers.find((u) => u.token === token);
  if (!user) {
    console.error("User not found:", token);
    return;
  }

  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const tokenField = document.getElementById("token");

  if (formTitle) formTitle.textContent = "Edit Client Profile";
  if (submitBtn) submitBtn.textContent = "Update Profile";

  // Populate form fields
  document.getElementById("token").value = user.token;
  document.getElementById("owner_name").value = user.owner_name;
  document.getElementById("business_name").value = user.business_name;
  document.getElementById("sector").value = user.sector;
  document.getElementById("business_type").value = user.business_type;
  document.getElementById("size").value = user.size;
  document.getElementById("challenges").value = user.challenges.join(", ");
  document.getElementById("goals").value = user.goals.join(", ");
  document.getElementById("current_focus").value = user.current_focus;

  // Make token field read-only
  if (tokenField) {
    tokenField.readOnly = true;
    tokenField.style.backgroundColor = "#eee";
  }

  showForm();
}

function showForm() {
  const formContainer = document.getElementById("client-form-container");
  if (formContainer) {
    formContainer.style.display = "flex";
    console.log("Form shown");
  }
}

function hideForm() {
  const formContainer = document.getElementById("client-form-container");
  if (formContainer) {
    formContainer.style.display = "none";
    clearForm();
    console.log("Form hidden");
  }
}

function clearForm() {
  const form = document.getElementById("client-form");
  if (form) {
    form.reset();
  }
}

async function handleFormSubmit() {
  const formData = {
    token: document.getElementById("token").value.trim(),
    owner_name: document.getElementById("owner_name").value.trim(),
    business_name: document.getElementById("business_name").value.trim(),
    sector: document.getElementById("sector").value.trim(),
    business_type: document.getElementById("business_type").value.trim(),
    size: document.getElementById("size").value.trim(),
    challenges: document
      .getElementById("challenges")
      .value.split(",")
      .map((s) => s.trim())
      .filter((s) => s),
    goals: document
      .getElementById("goals")
      .value.split(",")
      .map((s) => s.trim())
      .filter((s) => s),
    current_focus: document.getElementById("current_focus").value.trim(),
  };

  // Handle Image Upload - Store in LocalStorage only
  const fileInput = document.getElementById("business_image");
  if (fileInput && fileInput.files.length > 0) {
    const file = fileInput.files[0];
    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }
    try {
      const base64Image = await readFileAsBase64(file);
      localStorage.setItem("temp_business_image", base64Image);
      console.log("Image saved to localStorage (temp_business_image)");
    } catch (e) {
      console.error("Error reading file:", e);
      alert("Failed to process image file");
      return;
    }
  } else {
    console.log(
      "No new image selected, keeping existing localStorage data if any"
    );
  }

  // Validate required fields
  if (!formData.token || !formData.owner_name || !formData.business_name) {
    alert("Please fill in Token, Owner Name, and Business Name");
    return;
  }

  try {
    console.log("=== FORM SUBMISSION DEBUG ===");
    console.log("Form data:", JSON.stringify(formData, null, 2));
    console.log("API Service:", apiService);
    console.log("API URL:", apiService.apiUrl);
    console.log("Current mode:", currentFormMode);

    // Test direct fetch first
    const testUrl = `${apiService.apiUrl}/business/user`;
    console.log("Test URL:", testUrl);

    // Make a test request to verify connectivity
    const testResponse = await fetch(testUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    console.log("Test response status:", testResponse.status);
    console.log(
      "Test response headers:",
      Object.fromEntries(testResponse.headers.entries())
    );

    if (!testResponse.ok) {
      const text = await testResponse.text();
      console.error("Test request failed:", text);
      throw new Error(
        `API connectivity test failed: ${testResponse.status} ${testResponse.statusText}`
      );
    }

    if (currentFormMode === "create") {
      console.log("Creating new user...");
      const result = await apiService.createBusinessUser(formData);
      console.log("User created successfully:", result);
      alert("Client profile created successfully!");
    } else {
      console.log("Updating user...");
      await apiService.updateBusinessUser(selectedToken, formData);
      console.log("User updated successfully");
      alert("Client profile updated successfully!");
    }

    // Reload users list
    await loadAllUsers();

    // Hide form
    hideForm();

    // Clear the file input
    if (fileInput) fileInput.value = "";

    // Refresh the main menu dropdown if it exists
    if (window.refreshBusinessDropdown) {
      window.refreshBusinessDropdown();
    }
  } catch (error) {
    console.error("=== ERROR DEBUG ===");
    console.error("Error object:", error);
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);

    // Log the response if it exists
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response text:", await error.response.text());
    }

    // More detailed error message
    let errorMessage = "Failed to save profile";
    if (error.message) {
      errorMessage += ": " + error.message;
    }

    alert(`Error: ${errorMessage}`);
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

export function getAllUsers() {
  return allUsers;
}

export function getUserByToken(token) {
  return allUsers.find((u) => u.token === token);
}
