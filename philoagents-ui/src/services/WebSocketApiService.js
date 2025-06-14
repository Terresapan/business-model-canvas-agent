class WebSocketApiService {
  constructor() {
    // Initialize connection-related properties
    this.initializeConnectionProperties();

    // Set up WebSocket URL based on environment
    if (process.env.NODE_ENV === "production") {
      this.baseUrl = process.env.API_URL; // Re-use the http API URL from environment
      this.wsUrl = this.baseUrl.replace(/^http/, "ws"); // Convert to WebSocket URL
    } else {
      const isHttps = window.location.protocol === "https:";
      if (isHttps) {
        const currentHostname = window.location.hostname;
        this.baseUrl = `https://${currentHostname.replace("8080", "8000")}`;
        this.wsUrl = `wss://${currentHostname.replace("8080", "8000")}`;
      } else {
        this.baseUrl = "http://localhost:8000";
        this.wsUrl = "ws://localhost:8000";
      }
    }
    console.log("Using WebSocket Base URL:", this.baseUrl);
    console.log("Using WebSocket URL:", this.wsUrl);
  }

  initializeConnectionProperties() {
    this.socket = null;
    this.messageCallbacks = new Map();
    this.connected = false;
    this.connectionPromise = null;
    this.connectionTimeout = 10000;
  }

  determineWebSocketBaseUrl() {
    const isHttps = window.location.protocol === "https:";

    if (isHttps) {
      console.log("Using GitHub Codespaces");
      const currentHostname = window.location.hostname;
      return `wss://${currentHostname.replace("8080", "8000")}`;
    }

    return "ws://localhost:8000";
  }

  connect(endpoint = "/ws/chat") {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        if (this.socket) {
          this.socket.close();
        }
        this.connectionPromise = null;
        reject(new Error("WebSocket connection timeout"));
      }, this.connectionTimeout);

      this.socket = new WebSocket(`${this.baseUrl}${endpoint}`);

      this.socket.onopen = () => {
        console.log(`WebSocket connection established to ${endpoint}`);
        this.connected = true;
        clearTimeout(timeoutId);
        resolve();
      };

      this.socket.onmessage = this.handleMessage.bind(this);

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        clearTimeout(timeoutId);
        this.connectionPromise = null;
        reject(error);
      };

      this.socket.onclose = () => {
        console.log("WebSocket connection closed");
        this.connected = false;
        this.connectionPromise = null;
      };
    });

    return this.connectionPromise;
  }

  handleMessage(event) {
    console.log("Received WebSocket message:", event.data);
    const data = JSON.parse(event.data);
    console.log("Parsed WebSocket data:", data);

    if (data.error) {
      console.error("WebSocket error:", data.error);
      return;
    }

    if (data.streaming !== undefined) {
      console.log("Streaming update:", data.streaming);
      this.handleStreamingUpdate(data.streaming);
      return;
    }

    if (data.chunk) {
      console.log("Received chunk:", data.chunk);
      this.triggerCallback("chunk", data.chunk);
      return;
    }

    if (data.response) {
      console.log("Received response:", data.response);
      this.triggerCallback("message", data.response);
    }
  }

  handleStreamingUpdate(isStreaming) {
    const streamingCallback = this.messageCallbacks.get("streaming");
    if (streamingCallback) {
      streamingCallback(isStreaming);
    }
  }

  triggerCallback(type, data) {
    const callback = this.messageCallbacks.get(type);
    if (callback) {
      callback(data);
    }
  }

  async sendBusinessMessage(expert, message, userToken, callbacks = {}) {
    try {
      console.log("Attempting to send business message:", {
        expert,
        message,
        userToken,
      });

      if (!this.connected) {
        console.log(
          "Not connected, attempting to connect to /ws/chat/business"
        );
        await this.connect("/ws/chat/business");
      }

      this.registerCallbacks(callbacks);

      const payload = {
        message: message,
        expert_id: expert.id,
        user_token: userToken,
      };

      console.log("Sending WebSocket message:", payload);
      this.socket.send(JSON.stringify(payload));
    } catch (error) {
      console.error("Error sending business message via WebSocket:", error);
      return this.getFallbackResponse(expert);
    }
  }

  async sendMessage(philosopher, message, callbacks = {}) {
    try {
      if (!this.connected) {
        await this.connect("/ws/chat");
      }

      this.registerCallbacks(callbacks);

      this.socket.send(
        JSON.stringify({
          message: message,
          philosopher_id: philosopher.id,
        })
      );
    } catch (error) {
      console.error("Error sending message via WebSocket:", error);
      return this.getFallbackResponse(philosopher);
    }
  }

  registerCallbacks(callbacks) {
    if (callbacks.onMessage) {
      this.messageCallbacks.set("message", callbacks.onMessage);
    }

    if (callbacks.onStreamingStart) {
      this.messageCallbacks.set("streaming", (isStreaming) => {
        if (isStreaming) {
          callbacks.onStreamingStart();
        } else if (callbacks.onStreamingEnd) {
          callbacks.onStreamingEnd();
        }
      });
    }

    if (callbacks.onChunk) {
      this.messageCallbacks.set("chunk", callbacks.onChunk);
    }
  }

  getFallbackResponse(character) {
    const type = character.domain ? "business expert" : "philosopher";
    return `I'm so tired right now, I can't talk. I'm going to sleep now. - ${
      character.name || `the ${type}`
    }`;
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.connected = false;
      this.connectionPromise = null;
      this.messageCallbacks.clear();
    }
  }
}

export default new WebSocketApiService();
