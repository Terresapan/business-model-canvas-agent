class ApiService {
  constructor() {
    const isHttps = window.location.protocol === "https:";

    if (isHttps) {
      console.log("Using GitHub Codespaces");
      const currentHostname = window.location.hostname;
      this.apiUrl = `https://${currentHostname.replace("8080", "8000")}`;
    } else {
      this.apiUrl = "process.env.API_URL";
    }
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
}

export default new ApiService();
