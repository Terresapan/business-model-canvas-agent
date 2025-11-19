class ApiService {
  constructor() {
    console.log("=== API SERVICE INIT DEBUG ===");

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

      this.apiUrl = "http://localhost:8000";
      console.log("Set API URL to:", this.apiUrl);
    } else {
      console.log("Production mode detected");
      // Use window.location to determine API URL in production
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;

      // If API_URL is defined via webpack env, use it
      if (typeof API_URL !== "undefined" && API_URL) {
        this.apiUrl = API_URL;
        console.log("Using API_URL from build environment:", API_URL);
      } else {
        // Detect Cloud Run service and route to correct API service
        console.log("Current hostname:", hostname);

        if (hostname.includes("philoagents-ui-")) {
          // We're on the UI service, switch to API service
          const apiHostname = hostname.replace(
            "philoagents-ui-",
            "philoagents-api-"
          );
          this.apiUrl = `${protocol}//${apiHostname}`;
          console.log(
            "Detected UI service, using API service URL:",
            this.apiUrl
          );
        } else if (hostname.includes("philoagents-api-")) {
          // Already on API service
          console.log("Already on API service hostname:", hostname);
          this.apiUrl = `${protocol}//${hostname}`;
        } else {
          // Fallback for other production environments
          console.log("Unknown production hostname, using as-is:", hostname);
          this.apiUrl = `${protocol}//${hostname}`;
        }
      }
    }

    // Fallback if somehow still undefined
    if (!this.apiUrl) {
      console.warn("API URL is undefined, using fallback!");
      this.apiUrl = "http://localhost:8000";
      console.log("Fallback API URL:", this.apiUrl);
    }

    console.log("=== API SERVICE INIT COMPLETE ===");
    console.log("Final API URL:", this.apiUrl);
  }

  async request(endpoint, method, data) {
    const url = `${this.apiUrl}${endpoint}`;
    console.log("Making request to:", url);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: data ? JSON.stringify(data) : undefined,
    };

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async sendBusinessMessage(expert, message, userToken) {
    try {
      console.log("Sending business message:", { expert, message, userToken });

      const payload = {
        message,
        expert_id: expert.id,
        user_token: userToken,
      };

      // Check for shared business image in global variable (persists across expert switches)
      const tempImage = window.tempBusinessImage;
      if (tempImage) {
        console.log("DEBUG: Found shared tempBusinessImage in global variable");
        console.log("DEBUG: Image string length:", tempImage.length);
        console.log("DEBUG: First 50 chars:", tempImage.substring(0, 50));

        payload.image_base64 = tempImage;

        // Image data persists across all business expert conversations for better UX
        // Users upload once and can discuss with any expert
        console.log(
          "DEBUG: Shared image attached to payload and retained for cross-expert conversations"
        );
      } else {
        console.log(
          "DEBUG: No shared tempBusinessImage found in global variable"
        );
      }

      // Check for shared business PDF in global variable (persists across expert switches)
      const tempPdf = window.tempBusinessPdf;
      const tempPdfName = window.tempBusinessPdfName;
      if (tempPdf) {
        console.log("DEBUG: Found shared tempBusinessPdf in global variable");
        console.log("DEBUG: PDF string length:", tempPdf.length);
        console.log("DEBUG: PDF name:", tempPdfName);

        payload.pdf_base64 = tempPdf;
        payload.pdf_name = tempPdfName;

        // PDF data persists across all business expert conversations for better UX
        // Users upload once and can discuss with any expert
        console.log(
          "DEBUG: Shared PDF attached to payload and retained for cross-expert conversations"
        );
      } else {
        console.log(
          "DEBUG: No shared tempBusinessPdf found in global variable"
        );
      }

      const data = await this.request("/chat/business", "POST", payload);

      console.log("API response:", data);
      return data.response;
    } catch (error) {
      console.error("Error sending business message to API:", error);
      console.error("Error details:", error.message, error.stack);
      return this.getFallbackResponse(expert);
    }
  }

  async sendMessage(philosopher, message) {
    try {
      const data = await this.request("/chat", "POST", {
        message,
        philosopher_id: philosopher.id,
      });

      return data.response;
    } catch (error) {
      console.error("Error sending message to API:", error);
      return this.getFallbackResponse(philosopher);
    }
  }

  async validateToken(token) {
    try {
      const url = `${
        this.apiUrl
      }/business/tokens/validate?token=${encodeURIComponent(token)}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to validate token");
      }

      return await response.json();
    } catch (error) {
      console.error("Error validating token:", error);
      return { valid: false };
    }
  }

  async getBusinessExperts() {
    try {
      const data = await this.request("/business/experts", "GET");
      return data.experts;
    } catch (error) {
      console.error("Error fetching business experts:", error);
      return [];
    }
  }

  getFallbackResponse(character) {
    const type = character.domain ? "business expert" : "philosopher";
    return `I'm sorry, ${
      character.name || `the ${type}`
    } is unavailable at the moment. Please try again later.`;
  }

  async resetMemory() {
    try {
      const response = await fetch(`${this.apiUrl}/reset-memory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to reset memory");
      }

      return await response.json();
    } catch (error) {
      console.error("Error resetting memory:", error);
      throw error;
    }
  }

  // --- NEW CRUD FUNCTIONS ---

  /**
   * Fetches all business user profiles from the server.
   * @returns {Promise<Array<Object>>} A list of user profiles.
   */
  async getAllBusinessUsers() {
    try {
      console.log("=== getAllBusinessUsers DEBUG ===");
      console.log("API URL being used:", this.apiUrl);
      const url = `${this.apiUrl}/business/users`;
      console.log("Full URL:", url);

      const response = await fetch(url, {
        method: "GET",
      });

      console.log("Response status:", response.status);
      console.log("Response ok:", response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error response data:", errorData);
        throw new Error(errorData.detail || "Failed to fetch users");
      }

      const data = await response.json();
      console.log("Users data received:", data);
      return data;
    } catch (error) {
      console.error("Error fetching all business users:", error);
      throw error;
    }
  }

  /**
   * Creates a new business user profile.
   * @param {Object} userData - The user profile object matching the BusinessUser model.
   * @returns {Promise<Object>} The server response.
   */
  async createBusinessUser(userData) {
    try {
      const response = await fetch(`${this.apiUrl}/business/user`, {
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
      console.error("Error creating business user:", error);
      throw error;
    }
  }

  /**
   * Updates an existing business user profile.
   * @param {string} token - The unique token of the user to update.
   * @param {Object} userData - The full, updated user profile object.
   * @returns {Promise<Object>} The server response.
   */
  async updateBusinessUser(token, userData) {
    try {
      const response = await fetch(`${this.apiUrl}/business/user/${token}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update user");
      }
      return await response.json();
    } catch (error) {
      console.error("Error updating business user:", error);
      throw error;
    }
  }

  /**
   * Deletes a business user profile.
   * @param {string} token - The unique token of the user to delete.
   * @returns {Promise<Object>} The server response.
   */
  async deleteBusinessUser(token) {
    try {
      const response = await fetch(`${this.apiUrl}/business/user/${token}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to delete user");
      }
      return await response.json();
    } catch (error) {
      console.error("Error deleting business user:", error);
      throw error;
    }
  }
}

const apiServiceInstance = new ApiService();
export default apiServiceInstance;
export { ApiService };
