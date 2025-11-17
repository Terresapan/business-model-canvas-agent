class ApiService {
  constructor() {
    // This variable is defined by webpack.DefinePlugin
    // In webpack/config.js for development, and passed as a build-arg for production
    this.apiUrl = typeof API_URL !== 'undefined' ? API_URL : 'http://localhost:8000';
    console.log("ApiService initialized with API URL:", this.apiUrl);
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
        method: 'GET',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to fetch users');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching all business users:', error);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create user');
      }
      return await response.json();
    } catch (error) {
      console.error('Error creating business user:', error);
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
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update user');
      }
      return await response.json();
    } catch (error) {
      console.error('Error updating business user:', error);
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
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to delete user');
      }
      return await response.json();
    } catch (error) {
      console.error('Error deleting business user:', error);
      throw error;
    }
  }
}

const apiServiceInstance = new ApiService();
export default apiServiceInstance;
export { ApiService };
