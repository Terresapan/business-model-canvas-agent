class ApiService {
  constructor() {
    console.log("=== API SERVICE INIT DEBUG ===");

    // Check if NODE_ENV is defined (webpack defines it) - fallback to "production" for built apps
    const nodeEnv =
      typeof process !== "undefined" && process.env && process.env.NODE_ENV
        ? process.env.NODE_ENV
        : "production";
    console.log("NODE_ENV:", nodeEnv);

    const isProd = nodeEnv === "production";
    console.log("Is production build:", isProd);

    if (isProd) {
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
    } else {
      console.log("Development mode");
      const isHttps = window.location.protocol === "https:";
      console.log("Is HTTPS:", isHttps);
      console.log("Protocol:", window.location.protocol);
      console.log("Hostname:", window.location.hostname);

      if (isHttps) {
        console.log("Using GitHub Codespaces URL");
        const currentHostname = window.location.hostname;
        this.apiUrl = `https://${currentHostname.replace("8080", "8000")}`;
      } else {
        console.log("Using localhost URL");
        this.apiUrl = "http://localhost:8000";
      }
      console.log("Set API URL to:", this.apiUrl);
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
      const data = await this.request("/chat/business", "POST", {
        message,
        expert_id: expert.id,
        user_token: userToken,
      });

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
      const response = await fetch(`${this.apiUrl}/business/users`, {
        method: "GET",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch users");
      }
      return await response.json();
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
