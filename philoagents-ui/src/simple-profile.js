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

// Global state for role-based interface
let currentBusinessToken = null;
let currentBusinessRole = "user";
let currentBusinessProfile = null;

// Auto-generate secure tokens instead of manual input
function generateSecureToken() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Secure token validation
async function validateToken(token) {
  try {
    const response = await fetch(
      `${apiUrl}/business/tokens/validate?token=${encodeURIComponent(token)}`
    );
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Token validation failed:", error);
    return { valid: false };
  }
}

// Set current business session
async function setCurrentBusiness(token) {
  const validation = await validateToken(token);

  if (!validation.valid) {
    alert("Invalid business token. Please check and try again.");
    return false;
  }

  currentBusinessToken = token;
  currentBusinessRole = validation.role || "user";
  // Load profile if needed, or use validation data
  
  // Clear any previous business files for security
  clearAllBusinessFiles();

  console.log(
    `🔒 Business session started: ${validation.user?.business_name} (${currentBusinessRole})`
  );
  return true;
}

async function loadAllUsers() {
  console.log("=== LOAD ALL USERS FUNCTION STARTED ===");
  
  // Check for admin token
  const adminToken = prompt("Please enter Admin Token to view all users:");
  if (!adminToken) {
      console.log("No admin token provided, skipping loadAllUsers");
      return [];
  }

  console.log("Loading all users from:", `${apiUrl}/admin/business/users`);
  console.log("API URL being used:", apiUrl);

  try {
    console.log("Initiating fetch request to /admin/business/users...");
    const response = await fetch(`${apiUrl}/admin/business/users?admin_token=${encodeURIComponent(adminToken)}`);
    console.log("Fetch request completed");

    console.log("Response status:", response.status);
    
    if (response.ok) {
      allUsers = await response.json();
      return allUsers;
    } else {
      console.error("Failed to load users - Response not ok:", response.status);
      if (response.status === 401) {
          alert("Admin access required to view all users.");
      }
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }

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

  // Clear all business files when creating new profile for security
  clearAllBusinessFiles();

  currentMode = "create";
  document.getElementById("form-title").innerText = "Create New Client Profile";
  document.getElementById("form-submit-btn").innerText = "Create Profile";
  document.getElementById("client-form").reset();
  
  // Hide token field for creation (system generated)
  const tokenInput = document.getElementById("token");
  const tokenLabel = document.querySelector('label[for="token"]');
  if (tokenInput) {
      tokenInput.style.display = "none";
      tokenInput.required = false;
      tokenInput.value = "SYSTEM_GENERATED"; // Placeholder to satisfy HTML validation if needed
  }
  if (tokenLabel) tokenLabel.style.display = "none";

  document.getElementById("client-form-container").style.display = "flex";
}

async function showEditForm(token) {
  currentMode = "edit";
  editToken = token;
  document.getElementById("form-title").innerText = "Edit Client Profile";
  document.getElementById("form-submit-btn").innerText = "Update Profile";
  
  // Show and lock token field for editing
  const tokenInput = document.getElementById("token");
  const tokenLabel = document.querySelector('label[for="token"]');
  if (tokenInput) {
      tokenInput.style.display = "block";
      tokenInput.readOnly = true;
      tokenInput.disabled = true;
      tokenInput.style.backgroundColor = "#eee";
      tokenInput.value = token;
  }
  if (tokenLabel) tokenLabel.style.display = "block";

  document.getElementById("client-form-container").style.display = "flex";

  // Fetch user data
  try {
    const response = await fetch(`${apiUrl}/business/user/${token}`);
    if (response.ok) {
      const user = await response.json();
      // Populate form
      document.getElementById("owner_name").value = user.owner_name || "";
      document.getElementById("business_name").value = user.business_name || "";
      document.getElementById("sector").value = user.sector || "";
      document.getElementById("challenges").value =
        (user.challenges || []).join(", ") || "";
      document.getElementById("goals").value =
        (user.goals || []).join(", ") || "";

      // Check for existing files in session
      const imageKey = `tempBusinessImage_${token}`;
      const pdfKey = `tempBusinessPdf_${token}`;
      const pdfNameKey = `tempBusinessPdfName_${token}`;

      if (window[imageKey]) {
          console.log("Found existing image in session");
          // Ideally we'd show a preview, but for now just a status
          // We can't set file input value, but we could add a label
      }
      if (window[pdfKey]) {
          console.log("Found existing PDF in session");
      }
      
      // Note: Since the backend doesn't return the file data in the GET /user response yet,
      // we can only show what's in the current browser session.
      // If the user refreshes, this will be lost until we implement file fetching.
      
    } else {
      alert("Failed to fetch user details");
      document.getElementById("client-form-container").style.display = "none";
    }
  } catch (error) {
    console.error("Error fetching user details:", error);
    alert("Error fetching user details");
    document.getElementById("client-form-container").style.display = "none";
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
  console.log("Setting up simple form handlers v3.1...");

  const form = document.getElementById("client-form");
  const formContainer = document.getElementById("client-form-container");
  const cancelBtn = document.getElementById("form-cancel-btn");
  const submitBtn = document.getElementById("form-submit-btn");
  const fileInput = document.getElementById("business_image");

  // 1. Stop Propagation Helper
  const stopAll = (e) => {
    e.stopPropagation();
    // We do NOT stopImmediatePropagation() here to allow internal form events to bubble up to the form itself
  };

  // 2. Container: Stop clicks from reaching Game
  if (formContainer) {
    ["click", "mousedown", "mouseup", "pointerdown", "pointerup"].forEach(
      (evt) => {
        formContainer.addEventListener(evt, stopAll);
      }
    );
  }

  // 3. Form: Handle Events
  if (form) {
    // Stop clicks on the form background
    ["click", "mousedown", "mouseup", "pointerdown", "pointerup"].forEach(
      (evt) => {
        form.addEventListener(evt, stopAll);
      }
    );

    // --- FILE INPUT CHANGE HANDLER (DIRECT BINDING) ---
    if (fileInput) {
      console.log("Found file input, binding CHANGE listener directly");

      fileInput.addEventListener("change", async (e) => {
        console.log("DIRECT CHANGE EVENT FIRED on file input");
        if (fileInput.files.length > 0) {
          const file = fileInput.files[0];
          console.log("File selected:", file.name, file.size);

          if (file.size > 5 * 1024 * 1024) {
            alert("Image size must be less than 5MB");
            fileInput.value = "";
            return;
          }

          try {
            const base64Image = await readFileAsBase64(file);
            // Get current business token for secure isolation
            const token = getCurrentBusinessToken();
            if (!token) {
              alert(
                "Please enter a business token first to secure this image."
              );
              fileInput.value = "";
              return;
            }
            // Store image with business token prefix for isolation
            window[`tempBusinessImage_${token}`] = base64Image;
            console.log(
              `SECURE: Image saved to business-specific variable (window.tempBusinessImage_${token})`
            );
            // Alert the user so they know it worked
            const action = currentMode === 'edit' ? 'Update Profile' : 'Create Profile';
            alert(`Image Ready! You can now click '${action}'.`);
          } catch (err) {
            console.error("Error processing image:", err);
            alert("Failed to process image.");
          }
        }
      });

      // Prevent game interference
      ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((evt) => {
        fileInput.addEventListener(evt, stopAll);
      });
    } else {
      console.error("CRITICAL: File input #business_image not found!");
    }

    // --- PDF INPUT CHANGE HANDLER (DIRECT BINDING) ---
    const pdfInput = document.getElementById("business_pdf");
    if (pdfInput) {
      console.log("Found PDF input, binding CHANGE listener directly");

      pdfInput.addEventListener("change", async (e) => {
        console.log("DIRECT CHANGE EVENT FIRED on PDF input");
        if (pdfInput.files.length > 0) {
          const file = pdfInput.files[0];
          console.log("PDF selected:", file.name, file.size);

          if (file.size > 5 * 1024 * 1024) {
            alert("PDF size must be less than 5MB");
            pdfInput.value = "";
            return;
          }

          try {
            const base64Pdf = await readFileAsBase64(file);
            // Get current business token for secure isolation
            const token = getCurrentBusinessToken();
            if (!token) {
              alert("Please enter a business token first to secure this PDF.");
              pdfInput.value = "";
              return;
            }
            // Store PDF with business token prefix for isolation
            window[`tempBusinessPdf_${token}`] = base64Pdf;
            window[`tempBusinessPdfName_${token}`] = file.name;
            console.log(
              `SECURE: PDF saved to business-specific variables (window.tempBusinessPdf_${token})`
            );
            // Alert the user so they know it worked
            const action = currentMode === 'edit' ? 'Update Profile' : 'Create Profile';
            alert(`PDF Ready! You can now click '${action}'.`);
          } catch (err) {
            console.error("Error processing PDF:", err);
            alert("Failed to process PDF.");
          }
        }
      });

      // Prevent game interference
      ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((evt) => {
        pdfInput.addEventListener(evt, stopAll);
      });
    } else {
      console.error("CRITICAL: PDF input #business_pdf not found!");
    }

    // --- SUBMIT BUTTON HANDLER ---
    if (submitBtn) {
      submitBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("Submit Clicked -> Calling handleSubmit");
        await handleSubmit();
      });
      // Prevent click bleed-through
      ["mousedown", "mouseup", "pointerdown", "pointerup"].forEach((evt) => {
        submitBtn.addEventListener(evt, (e) => e.stopPropagation());
      });
    }

    // --- INPUTS: Stop propagation for typing/clicking ---
    // We exclude the file input from "stopAll" on click so the browser can open the dialog.
    const inputs = form.querySelectorAll(
      "input:not(#business_image), textarea, select, button:not(#form-submit-btn)"
    );
    inputs.forEach((input) => {
      ["click", "mousedown", "mouseup", "pointerdown", "pointerup"].forEach(
        (evt) => {
          input.addEventListener(evt, stopAll);
        }
      );
    });
  }

  // 4. Cancel Button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideForm();
    });
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Remove data URL prefix (e.g. "data:image/jpeg;base64,")
      // and remove newlines
      const base64String = reader.result.split(",")[1];
      const cleanBase64 = base64String.replace(/[\n\r]/g, "");
      resolve(cleanBase64);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

function getCurrentBusinessToken() {
  // Extract token from the form
  const tokenField = document.getElementById("token");
  if (tokenField && tokenField.value.trim()) {
    return tokenField.value.trim();
  }

  // Fallback: try to get from URL parameters or other sources
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get("token") || urlParams.get("user_token");
  if (tokenFromUrl) {
    return tokenFromUrl;
  }

  // Fallback: try to get from global variable (if available)
  if (currentBusinessToken) {
    return currentBusinessToken;
  }
  
  if (window.selectedBusinessToken) {
    return window.selectedBusinessToken;
  }

  return null;
}

function clearBusinessFiles(token) {
  // Clear old global variables for security
  if (window.tempBusinessImage) {
    console.log("SECURITY: Clearing old global tempBusinessImage");
    window.tempBusinessImage = null;
  }
  if (window.tempBusinessPdf) {
    console.log("SECURITY: Clearing old global tempBusinessPdf");
    window.tempBusinessPdf = null;
    window.tempBusinessPdfName = null;
  }

  // Clear business-specific variables
  if (token) {
    const imageKey = `tempBusinessImage_${token}`;
    const pdfKey = `tempBusinessPdf_${token}`;
    const pdfNameKey = `tempBusinessPdfName_${token}`;

    if (window[imageKey]) {
      console.log(`SECURITY: Clearing business-specific ${imageKey}`);
      window[imageKey] = null;
    }
    if (window[pdfKey]) {
      console.log(
        `SECURITY: Clearing business-specific ${pdfKey} and ${pdfNameKey}`
      );
      window[pdfKey] = null;
      window[pdfNameKey] = null;
    }
  }
}

function clearAllBusinessFiles() {
  console.log("SECURITY: Clearing ALL business files for security");

  // Clear legacy variables
  if (window.tempBusinessImage) {
    console.log("SECURITY: Clearing legacy tempBusinessImage");
    window.tempBusinessImage = null;
  }
  if (window.tempBusinessPdf) {
    console.log(
      "SECURITY: Clearing legacy tempBusinessPdf and tempBusinessPdfName"
    );
    window.tempBusinessPdf = null;
    window.tempBusinessPdfName = null;
  }

  // Clear all business-specific variables
  Object.keys(window).forEach((key) => {
    if (
      key.startsWith("tempBusinessImage_") ||
      key.startsWith("tempBusinessPdf_") ||
      key.startsWith("tempBusinessPdfName_")
    ) {
      console.log(`SECURITY: Clearing business-specific variable ${key}`);
      window[key] = null;
    }
  });
}

function getCurrentBusinessToken() {
  // Extract token from the form
  const tokenField = document.getElementById("token");
  if (tokenField && tokenField.value.trim()) {
    return tokenField.value.trim();
  }

  // Fallback: try to get from URL parameters or other sources
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get("token") || urlParams.get("user_token");
  if (tokenFromUrl) {
    return tokenFromUrl;
  }

  // Fallback: try to get from global variable (if available)
  if (window.selectedBusinessToken) {
    return window.selectedBusinessToken;
  }

  return null;
}

function clearBusinessFiles(token) {
  // Clear old global variables for security
  if (window.tempBusinessImage) {
    console.log("SECURITY: Clearing old global tempBusinessImage");
    window.tempBusinessImage = null;
  }
  if (window.tempBusinessPdf) {
    console.log("SECURITY: Clearing old global tempBusinessPdf");
    window.tempBusinessPdf = null;
    window.tempBusinessPdfName = null;
  }

  // Clear business-specific variables
  if (token) {
    const imageKey = `tempBusinessImage_${token}`;
    const pdfKey = `tempBusinessPdf_${token}`;
    const pdfNameKey = `tempBusinessPdfName_${token}`;

    if (window[imageKey]) {
      console.log(`SECURITY: Clearing business-specific ${imageKey}`);
      window[imageKey] = null;
    }
    if (window[pdfKey]) {
      console.log(
        `SECURITY: Clearing business-specific ${pdfKey} and ${pdfNameKey}`
      );
      window[pdfKey] = null;
      window[pdfNameKey] = null;
    }
  }
}

async function handleSubmit() {
  console.log("=== FORM SUBMISSION STARTED ===");
  console.log("Current mode:", currentMode);
  console.log("Edit token:", editToken);
  console.log("API URL being used:", apiUrl);

  // Handle Image Upload - Store in global variable
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
      // Use global variable instead of localStorage to avoid size limits
      window.tempBusinessImage = base64Image;
      console.log("Image saved to global variable (window.tempBusinessImage)");
      alert("Image ready");
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

  // Handle PDF Upload - Store in global variable
  // pdfInput is already declared in setupFormHandlers, so we just use it here
  const pdfInputHandle = document.getElementById("business_pdf");
  if (pdfInputHandle && pdfInputHandle.files.length > 0) {
    const file = pdfInputHandle.files[0];
    // 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      alert("PDF size must be less than 5MB");
      return;
    }
    try {
      const base64Pdf = await readFileAsBase64(file);
      // Use global variable instead of localStorage to avoid size limits
      window.tempBusinessPdf = base64Pdf;
      window.tempBusinessPdfName = file.name;
      console.log("PDF saved to global variable (window.tempBusinessPdf)");
      alert("PDF ready");
    } catch (e) {
      console.error("Error reading PDF:", e);
      alert("Failed to process PDF file");
      return;
    }
  } else {
    console.log(
      "No new PDF selected, keeping existing global variable data if any"
    );
  }

  const formData = {
    // token: document.getElementById("token").value.trim(), // Token is now auto-generated or read-only
    owner_name: document.getElementById("owner_name").value.trim(),
    business_name: document.getElementById("business_name").value.trim(),
    sector: document.getElementById("sector").value.trim(),
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
  };

  if (currentMode === "create") {
      formData.token = generateSecureToken();
      formData.role = "user";
  } else {
      formData.token = document.getElementById("token").value.trim();
  }

  console.log("Form data collected:", JSON.stringify(formData, null, 2));

  try {
    if (currentMode === "create") {
      console.log("Creating new user...");
      const result = await createUser(formData);
      console.log("User creation result:", result);
      alert("Profile created successfully!");
      console.log("Profile created alert shown");
      
      // Only close and reset on create
      hideForm();
      document.getElementById("client-form").reset();
    } else if (currentMode === "edit" && editToken) {
      console.log("Updating existing user...");
      await updateUser(editToken, formData);
      alert("Profile updated successfully!");
      console.log("Profile updated alert shown");
      // Do NOT hide form on update
    } else {
      throw new Error("Invalid mode or missing token");
    }

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
