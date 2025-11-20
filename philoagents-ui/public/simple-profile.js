// Simple profile management - no imports to avoid circular dependencies
console.log("=== SIMPLE PROFILE MANAGER v3.1 (Direct Binding) LOADED ===");

// Global state
let apiUrl = (() => {
  // Check if we're running in Docker container
  // When UI is accessed via localhost:8080 in browser but running in Docker,
  // we need to use the Docker service name, not localhost
  const hostname = window.location.hostname;
  const port = window.location.port;

  // If user is accessing via localhost:8080 (Docker dev setup)
  // but the UI is in a container, we need to use the Docker network
  if (hostname === "localhost" && port === "8080") {
    console.log(
      "Docker development environment detected, using container hostname"
    );
    return "http://philoagents-api:8000";
  }

  // Check if we're in local development (browser accessing localhost)
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("192.168.");

  if (isLocal) {
    // In local development, use localhost
    console.log("Local development detected, using localhost:8000");
    return "http://localhost:8000";
  }

  // Check if API_URL is defined globally (set by webpack build for production)
  if (typeof API_URL !== "undefined" && API_URL) {
    console.log("Using API_URL from build environment:", API_URL);
    return API_URL;
  }

  // In production/cloud, use dynamic detection
  const protocol = window.location.protocol;
  console.log("Current hostname:", hostname);

  if (hostname.includes("philoagents-ui-")) {
    // Cloud Run UI service - switch to API service
    const apiHostname = hostname.replace("philoagents-ui-", "philoagents-api-");
    const apiUrl = `${protocol}//${apiHostname}`;
    console.log(
      "Detected Cloud Run UI service, using API service URL:",
      apiUrl
    );
    return apiUrl;
  } else if (hostname.includes("philoagents-api-")) {
    // Already on API service (shouldn't happen for UI code, but just in case)
    console.log("Already on API service hostname:", hostname);
    return `${protocol}//${hostname}`;
  } else {
    // Fallback for other production environments
    console.log("Unknown production hostname, using as-is:", hostname);
    return `${protocol}//${hostname}`;
  }
})();

console.log("API URL determined as:", apiUrl);

let allUsers = [];
let currentMode = "create"; // 'create' or 'edit'
let editToken = null; // Token being edited

async function loadAllUsers() {
  console.log("Loading all users...");
  try {
    const response = await fetch(`${apiUrl}/business/users`);
    if (response.ok) {
      allUsers = await response.json();
      console.log("Loaded users:", allUsers);
      return allUsers;
    }
  } catch (error) {
    console.error("Error loading users:", error);
  }
  return [];
}

async function createUser(userData) {
  try {
    const response = await fetch(`${apiUrl}/business/user`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userData),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to create user");
    }
    return await response.json();
  } catch (error) {
    console.error("Error creating user:", error);
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
  currentMode = "create";
  editToken = null;
  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const tokenField = document.getElementById("token");

  if (formTitle) formTitle.textContent = "Create New Client Profile";
  if (submitBtn) submitBtn.textContent = "Create Profile";

  document.getElementById("client-form").reset();

  if (tokenField) {
    tokenField.readOnly = false;
    tokenField.style.backgroundColor = "#fff";
  }

  const formContainer = document.getElementById("client-form-container");
  if (formContainer) formContainer.style.display = "flex";
}

async function showEditForm(token) {
  currentMode = "edit";
  editToken = token;
  allUsers = await loadAllUsers();
  const user = allUsers.find((u) => u.token === token);

  if (!user) {
    alert("User not found.");
    return;
  }

  const formTitle = document.getElementById("form-title");
  const submitBtn = document.getElementById("form-submit-btn");
  const tokenField = document.getElementById("token");

  if (formTitle) formTitle.textContent = "Edit Client Profile";
  if (submitBtn) submitBtn.textContent = "Update Profile";

  document.getElementById("token").value = user.token;
  document.getElementById("owner_name").value = user.owner_name;
  document.getElementById("business_name").value = user.business_name;
  document.getElementById("sector").value = user.sector;
  document.getElementById("business_type").value = user.business_type;
  document.getElementById("size").value = user.size;
  document.getElementById("challenges").value = user.challenges.join(", ");
  document.getElementById("goals").value = user.goals.join(", ");
  document.getElementById("current_focus").value = user.current_focus;

  if (tokenField) {
    tokenField.readOnly = true;
    tokenField.style.backgroundColor = "#eee";
  }

  const formContainer = document.getElementById("client-form-container");
  if (formContainer) formContainer.style.display = "flex";
}

window.showCreateForm = showCreateForm;
window.showEditForm = showEditForm;

function hideForm() {
  const formContainer = document.getElementById("client-form-container");
  if (formContainer) formContainer.style.display = "none";
}

// --- MAIN SETUP FUNCTION ---
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
            // Use global variable instead of localStorage to avoid size limits
            window.tempBusinessImage = base64Image;
            console.log("SAVED TO GLOBAL VARIABLE (window.tempBusinessImage)");
            // Alert the user so they know it worked
            alert("Image Ready! You can now click 'Create Profile'.");
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
            // Use global variable instead of localStorage to avoid size limits
            window.tempBusinessPdf = base64Pdf;
            window.tempBusinessPdfName = file.name;
            console.log("SAVED TO GLOBAL VARIABLE (window.tempBusinessPdf)");
            // Alert the user so they know it worked
            alert("PDF Ready! You can now click 'Create Profile'.");
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

async function handleSubmit() {
  console.log("=== HANDLING SUBMIT ===");

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

  // Check global variables just to be sure
  const hasImage = !!window.tempBusinessImage;
  const hasPdf = !!window.tempBusinessPdf;
  console.log("Has image in global variable?", hasImage);
  console.log("Has PDF in global variable?", hasPdf);

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

  try {
    if (currentMode === "create") {
      await createUser(formData);
      alert("Profile created successfully!");
    } else if (currentMode === "edit" && editToken) {
      await updateUser(editToken, formData);
      alert("Profile updated successfully!");
    }

    // Cleanup
    const fileInput = document.getElementById("business_image");
    if (fileInput) fileInput.value = "";
    hideForm();
    document.getElementById("client-form").reset();

    if (window.onProfileCreated) window.onProfileCreated();
    if (window.refreshBusinessDropdown) window.refreshBusinessDropdown();
  } catch (error) {
    console.error("Submit failed:", error);
    alert(`Error: ${error.message}`);
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

// Initialize
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupFormHandlers);
} else {
  setupFormHandlers();
}
