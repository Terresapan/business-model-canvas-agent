// Simple profile management - no imports to avoid circular dependencies
console.log("Simple profile management loaded");

// Global state
let apiUrl = (() => {
  // Check if NODE_ENV is defined (webpack defines it) - fallback to "production" for built apps
  const nodeEnv =
    typeof process !== "undefined" && process.env && process.env.NODE_ENV
      ? process.env.NODE_ENV
      : "development";
  console.log("NODE_ENV:", nodeEnv);

  const isProd = nodeEnv === "production";
  console.log("Is production build:", isProd);

  // Always use localhost in development mode for Docker
  if (
    !isProd ||
    (typeof window !== "undefined" &&
      window.location.hostname === "localhost" &&
      window.location.port === "8080")
  ) {
    console.log("Development mode - using localhost");
    console.log("Protocol:", window.location.protocol);
    console.log("Hostname:", window.location.hostname);
    console.log("Port:", window.location.port);

    return "http://localhost:8000";
  } else {
    console.log("Production mode detected");
    // Use window.location to determine API URL in production
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // If API_URL is defined via webpack env, use it
    if (typeof API_URL !== "undefined" && API_URL) {
      console.log("Using API_URL from build environment:", API_URL);
      return API_URL;
    } else {
      // Detect Cloud Run service and route to correct API service
      console.log("Current hostname:", hostname);

      if (hostname.includes("philoagents-ui-")) {
        // We're on the UI service, switch to API service
        const apiHostname = hostname.replace(
          "philoagents-ui-",
          "philoagents-api-"
        );
        const apiUrl = `${protocol}//${apiHostname}`;
        console.log("Detected UI service, using API service URL:", apiUrl);
        return apiUrl;
      } else if (hostname.includes("philoagents-api-")) {
        // Already on API service
        console.log("Already on API service hostname:", hostname);
        return `${protocol}//${hostname}`;
      } else {
        // Fallback for other production environments
        console.log("Unknown production hostname, using as-is:", hostname);
        return `${protocol}//${hostname}`;
      }
    }
  }
})();

console.log("API URL determined as:", apiUrl);

let allUsers = [];
let currentMode = "create"; // 'create' or 'edit'
let editToken = null; // Token being edited

async function loadAllUsers() {
  console.log("=== LOAD ALL USERS FUNCTION STARTED ===");
  console.log("Loading all users from:", `${apiUrl}/business/users`);
  console.log("API URL being used:", apiUrl);

  try {
    console.log("Initiating fetch request to /business/users...");
    const response = await fetch(`${apiUrl}/business/users`);
    console.log("Fetch request completed");

    console.log("Response status:", response.status);
    console.log("Response ok:", response.ok);
    console.log("Response statusText:", response.statusText);
    console.log("Response type:", response.type);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (response.ok) {
      console.log("Response is OK, parsing JSON...");
      allUsers = await response.json();
      console.log("Loaded users:", allUsers);
      console.log("Number of users loaded:", allUsers.length);
      return allUsers;
    } else {
      console.error(
        "Response is not OK, attempting to extract error details..."
      );
      // Try to get error details from response
      let errorData;
      let errorBody;

      try {
        errorBody = await response.text();
        console.error("Error response body (text):", errorBody);
        errorData = JSON.parse(errorBody);
        console.error("Error response data (parsed JSON):", errorData);
      } catch (e) {
        console.error("Failed to parse error response as JSON:", e);
        errorData = {
          detail: errorBody || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      console.error(
        "Failed to load users - Response not ok:",
        response.status,
        errorData
      );
    }
  } catch (error) {
    console.error("=== ERROR LOADING USERS (CATCH BLOCK) ===");
    console.error("Error object:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error type:", error.constructor.name);
  }

  console.log("Returning empty array due to error");
  return [];
}

async function createUser(userData) {
  console.log("=== CREATE USER FUNCTION STARTED ===");
  console.log("Creating user with data:", userData);
  console.log("POST request to:", `${apiUrl}/business/user`);
  console.log("Request headers:", { "Content-Type": "application/json" });

  try {
    console.log("Initiating fetch request...");
    const response = await fetch(`${apiUrl}/business/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    console.log("Fetch request completed");

    console.log("Create user response status:", response.status);
    console.log("Create user response ok:", response.ok);
    console.log("Create user response statusText:", response.statusText);
    console.log("Create user response type:", response.type);
    console.log(
      "Create user response headers:",
      Object.fromEntries(response.headers.entries())
    );

    if (response.ok) {
      console.log("Response is OK, parsing JSON...");
      const result = await response.json();
      console.log("User created successfully:", result);
      return result;
    } else {
      console.error(
        "Response is not OK, attempting to extract error details..."
      );
      // Try to get error details from response
      let errorData;
      let errorBody;

      try {
        errorBody = await response.text();
        console.error("Error response body (text):", errorBody);
        errorData = JSON.parse(errorBody);
        console.error("Error response data (parsed JSON):", errorData);
      } catch (e) {
        console.error("Failed to parse error response as JSON:", e);
        errorData = {
          detail: errorBody || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      console.error(
        "Failed to create user - Response not ok:",
        response.status,
        errorData
      );
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `Failed to create user: HTTP ${response.status}`;
      console.error("Throwing error:", errorMessage);
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error("=== ERROR CREATING USER (CATCH BLOCK) ===");
    console.error("Error object:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error type:", error.constructor.name);
    console.error(
      "Error stringified:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
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
  console.log("API URL being used:", apiUrl);

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

  console.log("Form data collected:", JSON.stringify(formData, null, 2));

  try {
    if (currentMode === "create") {
      console.log("Creating new user...");
      const result = await createUser(formData);
      console.log("User creation result:", result);
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
    console.error("Error object:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
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
