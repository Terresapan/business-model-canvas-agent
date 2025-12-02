import { Scene } from "phaser";
import apiService from "../services/ApiService.js";
import { AdminInterface } from "../services/AdminInterface.js";
import profileManager from "../services/ProfileManager.js";
import { Dropdown } from "../classes/Dropdown.js";
import { InstructionsPanel } from "../classes/InstructionsPanel.js";

export class MainMenu extends Scene {
  constructor() {
    super("MainMenu");
    this.selectedBusinessIndex = 0;
    this.userToken = null;
    this.businesses = [];
    this.databaseUsers = [];
    this.dropdown = null;
    this.instructionsPanel = null;
  }

  init(data) {
    if (data.mode === "admin") {
      this.currentMode = "admin";
      this.adminInterface = data.adminInterface;
    } else if (data.mode === "user") {
      this.currentMode = "user";
      this.userToken = data.userToken;
    } else {
      this.currentMode = "initial";
    }
  }

  async create() {
    this.add.image(0, 0, "background").setOrigin(0.1, -0.05).setScale(0.9);
    // this.add.image(510, 260, "logo").setScale(0.55);

    const centerX = this.cameras.main.width / 2;
    const buttonSpacing = 65;

    this.instructionsPanel = new InstructionsPanel(this);

    if (this.currentMode === "admin") {
      this.createAdminDashboard(centerX, 480, buttonSpacing);
    } else if (this.currentMode === "user") {
      this.createUserDashboard(centerX, 480, buttonSpacing);
    } else {
      this.createInitialMenu(centerX, 680, buttonSpacing);
    }

    this.setupKeyboardInput();

    // Hook up global refresh for ProfileManager
    window.refreshBusinessDropdown = () => {
      if (this.currentMode === "admin" && this.adminInterface) {
        this.loadUsersFromDatabase(this.adminInterface.adminToken);
      }
    };
  }

  createInitialMenu(centerX, startY, buttonSpacing) {
    this.add
      .text(centerX, startY - 35, "Select Access Mode:", {
        fontSize: "24px",
        fontFamily: "Arial",
        color: "#ffffff",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    this.createButton(centerX - 180, startY + 20, "Admin Access", () =>
      this.handleAdminAccess()
    );
    this.createButton(centerX + 180, startY + 20, "User Access", () =>
      this.handleUserAccess()
    );
  }

  async createAdminDashboard(centerX, startY, buttonSpacing) {
    // Dropdown
    this.dropdown = new Dropdown(
      this,
      centerX,
      startY - 30,
      350,
      40,
      [],
      (index, item) => {
        this.selectedBusinessIndex = index;
      }
    );

    await this.loadUsersFromDatabase(this.adminInterface.adminToken);

    const firstLineY = startY + 40;
    const secondLineY = firstLineY + buttonSpacing;

    this.createButton(centerX - 180, firstLineY, "Enter Game", () =>
      this.validateAndEnterGame()
    );
    this.createButton(centerX + 180, firstLineY, "Instructions", () =>
      this.instructionsPanel.show()
    );

    this.createButton(centerX - 180, secondLineY, "Create Profile", () => {
      profileManager.showCreateForm();
    });
    this.createButton(centerX + 180, secondLineY, "Edit Profile", () =>
      this.showEditProfile()
    );

    this.createButton(centerX, secondLineY + buttonSpacing, "Logout", () => {
      this.adminInterface = null;
      this.scene.restart({ mode: "initial" });
    });
  }

  createUserDashboard(centerX, startY, buttonSpacing) {
    this.add
      .text(centerX, startY, `Token: ${this.userToken}`, {
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "#333",
      })
      .setOrigin(0.5);

    const firstLineY = startY + 60;
    const secondLineY = firstLineY + buttonSpacing;

    this.createButton(centerX - 180, firstLineY, "Enter Game", () =>
      this.validateAndEnterGame()
    );
    this.createButton(centerX + 180, firstLineY, "Instructions", () =>
      this.instructionsPanel.show()
    );

    this.createButton(centerX - 180, secondLineY, "Edit Profile", () => {
      profileManager.showEditForm(this.userToken);
    });
    this.createButton(centerX + 180, secondLineY, "Back", () => {
      this.userToken = null;
      this.scene.restart({ mode: "initial" });
    });
  }

  async handleAdminAccess() {
    const adminInterface = new AdminInterface(apiService.apiUrl);
    const success = await adminInterface.login();

    if (success) {
      this.showMessage("Admin Logged In!", "#00ff00");
      this.adminInterface = adminInterface;
      this.showAdminDashboard();
    }
  }

  async handleUserAccess() {
    const token = prompt("Enter your Business Token:");
    if (token && token.trim()) {
      const validation = await apiService.validateToken(token.trim());
      if (validation.valid) {
        this.userToken = token.trim();
        this.showMessage(
          `Welcome, ${validation.user.business_name}!`,
          "#00ff00"
        );
        this.showUserDashboard();
      } else {
        this.showMessage("Invalid Token", "#ff0000");
      }
    }
  }

  showAdminDashboard() {
    this.scene.restart({ mode: "admin", adminInterface: this.adminInterface });
  }

  showUserDashboard() {
    this.scene.restart({ mode: "user", userToken: this.userToken });
  }

  async loadUsersFromDatabase(adminToken = null) {
    try {
      this.databaseUsers = await apiService.getAllBusinessUsers(adminToken);

      if (this.databaseUsers && this.databaseUsers.length > 0) {
        this.businesses = this.databaseUsers.map((user) => user.business_name);
        if (this.dropdown) {
          this.dropdown.updateItems(this.businesses);
        }
        this.showMessage(
          `Loaded ${this.businesses.length} profiles.`,
          "#000000"
        );
      } else {
        this.businesses = [];
        if (this.dropdown) {
          this.dropdown.updateItems([]);
        }
      }
    } catch (error) {
      console.error("Error loading users:", error);
      this.businesses = [];
      if (this.dropdown) {
        this.dropdown.updateItems([]);
      }
      this.showMessage("Failed to load profiles.", "#ff0000");
    }
  }

  showEditProfile() {
    if (!this.databaseUsers || this.databaseUsers.length === 0) {
      this.showMessage(
        "No profiles to edit. Create a profile first.",
        "#ff0000"
      );
      return;
    }

    const selectedBusiness = this.businesses[this.selectedBusinessIndex];
    if (!selectedBusiness) {
      this.showMessage(
        "Please select a profile to edit from the dropdown.",
        "#ff0000"
      );
      return;
    }

    const user = this.databaseUsers.find(
      (u) => u.business_name === selectedBusiness
    );
    if (user && user.token) {
      profileManager.showEditForm(user.token);
    } else {
      this.showMessage("Selected profile not found in database.", "#ff0000");
    }
  }

  validateAndEnterGame() {
    if (this.currentMode === "user" && this.userToken) {
      this.registry.set("gameMode", "business");
      this.registry.set("userToken", this.userToken);
      this.scene.start("Game");
      return;
    }

    if (this.currentMode === "admin") {
      if (
        this.businesses &&
        this.businesses.length > 0 &&
        this.selectedBusinessIndex >= 0
      ) {
        const selectedBusiness = this.businesses[this.selectedBusinessIndex];
        const user = this.databaseUsers.find(
          (u) => u.business_name === selectedBusiness
        );

        if (user && user.token) {
          this.registry.set("gameMode", "business");
          this.registry.set("userToken", user.token);
          this.scene.start("Game");
          return;
        }
      }
      this.showMessage("Please select a profile.", "#ff0000");
    }
  }

  setupKeyboardInput() {
    this.input.keyboard.on("keydown", (event) => {
      if (event.key === "Enter") {
        this.validateAndEnterGame();
      }
    });
  }

  showMessage(text, color = "#ffffff") {
    if (this.messageText) {
      this.messageText.destroy();
    }

    const centerX = this.cameras.main.width / 2;
    this.messageText = this.add
      .text(centerX, 400, text, {
        fontSize: "18px",
        fontFamily: "Arial",
        color: color,
        stroke: "#000000",
        strokeThickness: 1,
      })
      .setOrigin(0.5);

    this.time.delayedCall(3000, () => {
      if (this.messageText) {
        this.messageText.destroy();
        this.messageText = null;
      }
    });
  }

  createButton(x, y, text, callback) {
    const buttonWidth = 300;
    const buttonHeight = 40;
    const cornerRadius = 20;

    const shadow = this.add.graphics();
    shadow.fillStyle(0x666666, 1);
    shadow.fillRoundedRect(
      x - buttonWidth / 2 + 4,
      y - buttonHeight / 2 + 4,
      buttonWidth,
      buttonHeight,
      cornerRadius
    );

    const button = this.add.graphics();
    button.fillStyle(0xffffff, 1);
    button.fillRoundedRect(
      x - buttonWidth / 2,
      y - buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      cornerRadius
    );

    const buttonText = this.add
      .text(x, y, text, {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#000000",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const hitArea = this.add
      .rectangle(x, y, buttonWidth, buttonHeight, 0x000000, 0)
      .setInteractive();

    hitArea.on("pointerover", () => {
      button.clear();
      button.fillStyle(0x87ceeb, 1);
      button.fillRoundedRect(
        x - buttonWidth / 2,
        y - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
      buttonText.y -= 2;
    });

    hitArea.on("pointerout", () => {
      button.clear();
      button.fillStyle(0xffffff, 1);
      button.fillRoundedRect(
        x - buttonWidth / 2,
        y - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
      buttonText.y = y;
    });

    hitArea.on("pointerdown", callback);

    return { button, shadow, text: buttonText, hitArea };
  }
}
