// Simple profile management - no imports to avoid circular dependencies
console.log("Simple profile management loaded");

// Global state
let apiUrl = (() => {
  // Check if API_URL is defined globally (set by webpack build)
  if (typeof API_URL !== "undefined" && API_URL) {
    console.log("Using API_URL from build environment:", API_URL);
    return API_URL;
  }

  // Detect if we're in production/cloud environment
  const isProd =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1" &&
    !window.location.hostname.includes("192.168.");

  if (isProd) {
    // In production/cloud, use the same host as the UI without port
    // Cloud Run services are accessed via the same domain with path routing
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    // Remove port if present in hostname (for Cloud Run)
    const cleanHostname = hostname.split(":")[0];
    return `${protocol}//${cleanHostname}`;
  }

  // In local development, use localhost
  return "http://localhost:8000";
})();

console.log("API URL determined as:", apiUrl);

let allUsers = [];
let currentMode = "create"; // 'create' or 'edit'
let editToken = null; // Token being edited

async function loadAllUsers() {
  console.log("Loading all users from:", `${apiUrl}/business/users`);
  try {
    const response = await fetch(`${apiUrl}/business/users`);
    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);

    if (response.ok) {
      allUsers = await response.json();
      console.log("Loaded users:", allUsers);
      return allUsers;
    } else {
      const errorText = await response.text();
      console.error(
        "Failed to load users - Response not ok:",
        response.status,
        errorText
      );
    }
  } catch (error) {
    console.error("Error loading users:", error);
    console.error("Error details:", error.message, error.stack);
  }
  return [];
}

async function createUser(userData) {
  console.log("Creating user with data:", userData);
  console.log("POST request to:", `${apiUrl}/business/user`);

  try {
    const response = await fetch(`${apiUrl}/business/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    console.log("Create user response status:", response.status);
    console.log("Create user response ok:", response.ok);

    if (response.ok) {
      const result = await response.json();
      console.log("User created successfully:", result);
      return result;
    } else {
      const errorData = await response
        .json()
        .catch(() => ({ detail: "Unknown error" }));
      console.error(
        "Failed to create user - Response not ok:",
        response.status,
        errorData
      );
      throw new Error(
        errorData.detail || `Failed to create user: ${response.status}`
      );
    }
  } catch (error) {
    console.error("Error creating user:", error);
    console.error("Error details:", error.message, error.stack);
    throw error;
  }
}

async function updateUser(token, userData) {
  try {
    const response = await fetch(`${apiUrl}/business/user/${token}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("User updated:", result);
      return result;
    } else {
      const error = await response.json();
      throw new Error(error.detail || "Failed to update user");
    }
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

function showCreateForm() {
  console.log("Showing create form...");

  // Set mode to create
  currentMode = "create";
  editToken = null;

  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const tokenField = document.getElementById("token");

  if (formTitle) formTitle.textContent = "Create New Client Profile";
  if (submitBtn) submitBtn.textContent = "Create Profile";

  // Clear form
  document.getElementById("client-form").reset();

  // Make token field editable
  if (tokenField) {
    tokenField.readOnly = false;
    tokenField.style.backgroundColor = "#fff";
  }

  const formContainer = document.getElementById("client-form-container");
  if (formContainer) {
    formContainer.style.display = "flex";
  }
}

async function showEditForm(token) {
  console.log("Showing edit form for token:", token);

  // Set mode to edit and store the token
  currentMode = "edit";
  editToken = token;

  // Load all users first to ensure we have the latest data
  allUsers = await loadAllUsers();
  console.log("Loaded users for edit:", allUsers);

  const user = allUsers.find((u) => u.token === token);
  if (!user) {
    console.error("User not found:", token);
    alert("User not found. Please try refreshing the page.");
    return;
  }

  console.log("Editing user:", user);

  // Update form title and button
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

  // Show form
  const formContainer = document.getElementById("client-form-container");
  if (formContainer) {
    formContainer.style.display = "flex";
  }
}

// Expose functions globally for Phaser scene to access
window.showCreateForm = showCreateForm;
window.showEditForm = showEditForm;

function hideForm() {
  const formContainer = document.getElementById("client-form-container");
  if (formContainer) {
    formContainer.style.display = "none";
  }
}

function setupFormHandlers() {
  console.log("Setting up simple form handlers...");

  const form = document.getElementById("client-form");
  const cancelBtn = document.getElementById("form-cancel-btn");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleSubmit();
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener("click", hideForm);
  }
}

async function handleSubmit() {
  console.log("=== FORM SUBMISSION STARTED ===");
  console.log("Current mode:", currentMode);
  console.log("Edit token:", editToken);

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

  console.log("Form data collected:", formData);

  try {
    if (currentMode === "create") {
      console.log("Creating new user...");
      await createUser(formData);
      alert("Profile created successfully!");
      console.log("Profile created alert shown");
    } else if (currentMode === "edit" && editToken) {
      console.log("Updating existing user...");
      await updateUser(editToken, formData);
      alert("Profile updated successfully!");
      console.log("Profile updated alert shown");
    } else {
      throw new Error("Invalid mode or missing token");
    }

    hideForm();
    document.getElementById("client-form").reset();

    // Reload users if callback exists
    if (window.onProfileCreated) {
      console.log("Calling onProfileCreated callback");
      window.onProfileCreated();
    }

    // Also trigger global refresh if available
    if (window.refreshBusinessDropdown) {
      console.log("Calling refreshBusinessDropdown callback");
      window.refreshBusinessDropdown();
    }

    console.log("=== FORM SUBMISSION COMPLETED SUCCESSFULLY ===");
  } catch (error) {
    console.error("=== FORM SUBMISSION FAILED ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    alert(`Error: ${error.message}`);
  }
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFormHandlers);
} else {
  setupFormHandlers();
}

console.log("Simple profile module initialized");
