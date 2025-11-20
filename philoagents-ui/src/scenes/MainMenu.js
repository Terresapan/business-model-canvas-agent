import { Scene } from "phaser";
import apiService from "../services/ApiService.js";
import { AdminInterface } from "../services/AdminInterface.js";

export class MainMenu extends Scene {
  constructor() {
    super("MainMenu");
    this.selectedBusinessIndex = 0;
    this.isDropdownOpen = false;
    this.dropdownText = null;
    this.userToken = null;
    this.businesses = []; // Will be populated from database
    this.dropdownElements = [];
    this.databaseUsers = []; // Users from MongoDB
  }

  async create() {
    this.add.image(0, 0, "background").setOrigin(0, 0);
    this.add.image(510, 260, "logo").setScale(0.55);

    const centerX = this.cameras.main.width / 2;
    const startY = 480;
    const buttonSpacing = 65;

    // Add title for business canvas mode
    this.add
      .text(centerX, 360, "Business Model Canvas", {
        fontSize: "64px",
        fontFamily: "Arial",
        color: "#47a8c9",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    // Initial State: Show only two options
    this.createInitialMenu(centerX, startY, buttonSpacing);

    // Setup keyboard input
    this.setupKeyboardInput();

    // Expose refresh function globally for the form
    window.refreshBusinessDropdown = () => {
      if (this.adminInterface && this.adminInterface.adminToken) {
          this.loadUsersFromDatabase(this.adminInterface.adminToken);
      }
    };
  }

  createInitialMenu(centerX, startY, buttonSpacing) {
      // Clear any existing elements if returning to menu
      this.clearMenuElements();

      this.add.text(centerX, startY - 50, "Select Access Mode:", {
          fontSize: "24px",
          fontFamily: "Arial",
          color: "#ffffff",
          stroke: "#000000",
          strokeThickness: 2
      }).setOrigin(0.5);

      // 1. Admin Access
      this.createButton(centerX - 180, startY + 20, "Admin Access", () => {
          this.handleAdminAccess();
      });

      // 2. User Access (Token Entry)
      this.createButton(centerX + 180, startY + 20, "Enter Token", () => {
          this.handleUserAccess();
      });
  }

  clearMenuElements() {
      // Helper to clear UI elements when switching views
      // (In a real Phaser game we might use Groups, but here we'll just rely on scene restart or careful management)
      // For simplicity, we'll just restart the scene if we need a full reset, 
      // but for sub-menus we might want to just hide/destroy specific buttons.
      // For now, let's assume we build the UI additively or restart.
      // Actually, let's implement a simple cleanup if we were storing references.
      if (this.tokenDisplay) this.tokenDisplay.destroy();
      if (this.dropdownText) this.dropdownText.destroy();
      // ... (clearing buttons is harder without references, but we can just restart scene)
  }

  async handleAdminAccess() {
      const password = prompt("Enter Admin Password:");
      if (!password) return;

      const adminInterface = new AdminInterface(apiService.apiUrl);
      const success = await adminInterface.login(password);
      
      if (success) {
          this.adminInterface = adminInterface;
          this.showMessage("Admin Logged In!", "#00ff00");
          this.showAdminDashboard();
      }
  }

  async handleUserAccess() {
      const token = prompt("Enter your Business Token:");
      if (token && token.trim()) {
          // Validate token
          const validation = await apiService.validateToken(token.trim());
          if (validation.valid) {
              this.userToken = token.trim();
              this.showMessage(`Welcome, ${validation.user.business_name}!`, "#00ff00");
              this.showUserDashboard();
          } else {
              this.showMessage("Invalid Token", "#ff0000");
          }
      }
  }

  showAdminDashboard() {
      // Restart scene to clear initial buttons, but pass data to maintain state?
      // Or just clear and rebuild. Let's clear and rebuild for smoother UX.
      this.scene.restart({ mode: 'admin', adminInterface: this.adminInterface });
  }

  showUserDashboard() {
      this.scene.restart({ mode: 'user', userToken: this.userToken });
  }

  // Handle scene restart with data
  init(data) {
      if (data.mode === 'admin') {
          this.currentMode = 'admin';
          this.adminInterface = data.adminInterface;
          // We'll handle UI creation in create() based on this mode
      } else if (data.mode === 'user') {
          this.currentMode = 'user';
          this.userToken = data.userToken;
      } else {
          this.currentMode = 'initial';
      }
  }

  // OVERRIDE create to handle modes
  async create() {
    this.add.image(0, 0, "background").setOrigin(0, 0);
    this.add.image(510, 260, "logo").setScale(0.55);

    const centerX = this.cameras.main.width / 2;
    const startY = 580;
    const buttonSpacing = 65;

    this.add
      .text(centerX, 360, "Business Model Canvas", {
        fontSize: "64px",
        fontFamily: "Arial",
        color: "#47a8c9",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 2,
      })
      .setOrigin(0.5);

    if (this.currentMode === 'admin') {
        // Admin dashboard has more rows, so it needs to start higher
        this.createAdminDashboard(centerX, 480, buttonSpacing);
    } else if (this.currentMode === 'user') {
        // User dashboard also has multiple rows
        this.createUserDashboard(centerX, 480, buttonSpacing);
    } else {
        // Initial menu needs to be lower to avoid background graph
        this.createInitialMenu(centerX, 580, buttonSpacing);
    }

    this.setupKeyboardInput();

    window.refreshBusinessDropdown = () => {
      if (this.currentMode === 'admin' && this.adminInterface) {
          this.loadUsersFromDatabase(this.adminInterface.adminToken);
      }
    };
  }

  async createAdminDashboard(centerX, startY, buttonSpacing) {
      // Dropdown
      this.createDropdownButton(centerX, startY - 30, 350, 40);
      await this.loadUsersFromDatabase(this.adminInterface.adminToken);

      // Buttons
      const firstLineY = startY + 40;
      const secondLineY = firstLineY + buttonSpacing;

      // Row 1: Enter Game, Instructions
      this.createButton(centerX - 180, firstLineY, "Enter Game", () => this.validateAndEnterGame());
      this.createButton(centerX + 180, firstLineY, "Instructions", () => this.showInstructions());

      // Row 2: Create Profile, Edit Profile
      this.createButton(centerX - 180, secondLineY, "Create Profile", () => {
          if (window.showCreateForm) {
              window.showCreateForm();
          } else {
              alert("Error: Profile form module not loaded.");
          }
      });
      this.createButton(centerX + 180, secondLineY, "Edit Profile", () => this.showEditProfile());
      
      // Back Button
      this.createButton(centerX, secondLineY + buttonSpacing, "Logout", () => {
          this.adminInterface = null;
          this.scene.restart({ mode: 'initial' });
      });
  }

  createUserDashboard(centerX, startY, buttonSpacing) {
      this.add.text(centerX, startY, `Token: ${this.userToken}`, { fontSize: "16px", color: "#ffffff", backgroundColor: "#333" }).setOrigin(0.5);

      const firstLineY = startY + 60;
      const secondLineY = firstLineY + buttonSpacing;
      
      // Row 1: Enter Game, Instructions
      this.createButton(centerX - 180, firstLineY, "Enter Game", () => this.validateAndEnterGame());
      this.createButton(centerX + 180, firstLineY, "Instructions", () => this.showInstructions());

      // Row 2: Edit Profile, Back
      this.createButton(centerX - 180, secondLineY, "Edit Profile", () => {
          if (window.showEditForm) window.showEditForm(this.userToken);
      });
      this.createButton(centerX + 180, secondLineY, "Back", () => {
          this.userToken = null;
          this.scene.restart({ mode: 'initial' });
      });
  }

  async loadUsersFromDatabase(adminToken = null) {
    try {
      console.log("Loading users from database...");
      // Use the new method that supports admin token
      this.databaseUsers = await apiService.getAllBusinessUsers(adminToken);
      console.log("Loaded database users:", this.databaseUsers);

      // If we have database users, use them
      if (this.databaseUsers && this.databaseUsers.length > 0) {
        this.businesses = this.databaseUsers.map(user => user.business_name);
        console.log("Updated businesses list:", this.businesses);

        // Update dropdown if it's currently showing
        if (this.dropdownText) {
          const currentSelection = this.businesses[this.selectedBusinessIndex];
          this.dropdownText.setText(currentSelection || "Select a business...");
        }
        
        // Show success message
        this.showMessage(`Loaded ${this.businesses.length} profiles.`, "#000000");
      } else {
        // No users in database yet - show helpful message
        console.log("No users found in database.");
        this.businesses = [];
        if (this.dropdownText) {
          this.dropdownText.setText("No profiles found");
        }
      }
    } catch (error) {
      console.error("Error loading users from database:", error);
      // Fall back to empty list
      this.businesses = [];
      if (this.dropdownText) {
        this.dropdownText.setText("Error loading");
      }
      this.showMessage("Failed to load profiles. Admin access required?", "#ff0000");
    }
  }

  createTokenEntryUI(centerX, y) {
      // Label
      this.add.text(centerX, y - 35, "Enter Your Business Token:", {
          fontSize: "18px",
          fontFamily: "Arial",
          color: "#2b97bd",
          stroke: "#000000",
          strokeThickness: 1,
      }).setOrigin(0.5);

      // Display current token or placeholder
      const tokenDisplay = this.add.text(centerX, y, "Click to Enter Token", {
          fontSize: "20px",
          fontFamily: "Monospace",
          color: "#ffffff",
          backgroundColor: "#333333",
          padding: { x: 10, y: 5 }
      }).setOrigin(0.5).setInteractive();

      this.tokenDisplay = tokenDisplay;

      tokenDisplay.on('pointerdown', () => {
          const token = prompt("Enter your Business Token:");
          if (token) {
              this.userToken = token.trim();
              this.tokenDisplay.setText(this.userToken);
              this.selectedBusinessIndex = -1; // Clear dropdown selection
          }
      });
      
      // Also create the dropdown (hidden initially or empty) for Admin use
      this.createDropdownButton(centerX, y + 60, 350, 40);
      // Hide it initially if empty? No, just leave it empty.
      this.dropdownText.setText("Admin: Load Profiles first");
  }

  async handleAdminAccess() {
      const adminInterface = new AdminInterface(apiService.apiUrl);
      // Login handles the prompting now
      const success = await adminInterface.login();
      
      if (success) {
          this.showMessage("Admin Logged In!", "#00ff00");
          // Load users using the admin token (which is now stored in adminInterface)
          // Note: validateToken in login() already fetched the users into adminInterface.businesses
          // We should use that or reload.
          // Let's reload to be consistent with the MainMenu logic
          await this.loadUsersFromDatabase(adminInterface.adminToken);
          
          this.adminInterface = adminInterface; // Store it
          this.showAdminDashboard();
      }
  }

  createDropdownButton(centerX, y, width, height) {
    // Create dropdown background
    const dropdownBg = this.add.graphics();
    dropdownBg.fillStyle(0xffffff, 1);
    dropdownBg.fillRoundedRect(
      centerX - width / 2,
      y - height / 2,
      width,
      height,
      8
    );
    dropdownBg.lineStyle(2, 0x000000, 1);
    dropdownBg.strokeRoundedRect(
      centerX - width / 2,
      y - height / 2,
      width,
      height,
      8
    );

    // Create dropdown text
    const dropdownValue = this.businesses[this.selectedBusinessIndex] || "Loading...";
    this.dropdownText = this.add
      .text(
        centerX - width / 2 + 15,
        y,
        dropdownValue,
        {
          fontSize: "16px",
          fontFamily: "Arial",
          color: "#000000",
        }
      )
      .setOrigin(0, 0.5);

    // Create dropdown arrow
    const arrowSize = 8;
    const arrow = this.add.graphics();
    arrow.fillStyle(0x000000, 1);
    arrow.fillTriangle(
      centerX + width / 2 - 25,
      y - arrowSize / 2,
      centerX + width / 2 - 25 + arrowSize,
      y - arrowSize / 2,
      centerX + width / 2 - 25 + arrowSize / 2,
      y + arrowSize / 2
    );

    // Make dropdown clickable
    const dropdownArea = this.add.rectangle(
      centerX,
      y,
      width,
      height,
      0x000000,
      0
    );
    dropdownArea.setInteractive();
    dropdownArea.on("pointerdown", () => {
      this.toggleDropdown(centerX, y, width, height);
    });

    // Store references
    this.dropdownBg = dropdownBg;
    this.dropdownArrow = arrow;
    this.dropdownArea = dropdownArea;
  }

  toggleDropdown(centerX, y, width, height) {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown(centerX, y, width, height);
    }
  }

  openDropdown(centerX, y, width, height) {
    this.isDropdownOpen = true;
    const itemHeight = 35;
    const dropdownHeight = this.businesses.length * itemHeight;

    // Create dropdown list background
    const listBg = this.add.graphics();
    listBg.fillStyle(0xffffff, 1);
    listBg.fillRoundedRect(
      centerX - width / 2,
      y + height / 2,
      width,
      dropdownHeight,
      8
    );
    listBg.lineStyle(2, 0x000000, 1);
    listBg.strokeRoundedRect(
      centerX - width / 2,
      y + height / 2,
      width,
      dropdownHeight,
      8
    );

    this.dropdownElements.push(listBg);

    // Create list items
    this.businesses.forEach((business, index) => {
      const itemY = y + height / 2 + index * itemHeight + itemHeight / 2;

      // Create item background
      const itemBg = this.add.graphics();
      if (index === this.selectedBusinessIndex) {
        itemBg.fillStyle(0xe6f3ff, 1);
      } else {
        itemBg.fillStyle(0xffffff, 1);
      }
      itemBg.fillRect(
        centerX - width / 2 + 2,
        y + height / 2 + index * itemHeight + 2,
        width - 4,
        itemHeight - 2
      );

      // Create item text
      const itemText = this.add
        .text(centerX - width / 2 + 15, itemY, business, {
          fontSize: "16px",
          fontFamily: "Arial",
          color: "#000000",
        })
        .setOrigin(0, 0.5);

      // Make item clickable
      const itemArea = this.add.rectangle(
        centerX,
        itemY,
        width,
        itemHeight,
        0x000000,
        0
      );
      itemArea.setInteractive();
      itemArea.on("pointerdown", () => {
        this.selectBusiness(index);
      });

      // Add hover effect
      itemArea.on("pointerover", () => {
        itemBg.clear();
        itemBg.fillStyle(0xd4edda, 1);
        itemBg.fillRect(
          centerX - width / 2 + 2,
          y + height / 2 + index * itemHeight + 2,
          width - 4,
          itemHeight - 2
        );
      });

      itemArea.on("pointerout", () => {
        itemBg.clear();
        if (index === this.selectedBusinessIndex) {
          itemBg.fillStyle(0xe6f3ff, 1);
        } else {
          itemBg.fillStyle(0xffffff, 1);
        }
        itemBg.fillRect(
          centerX - width / 2 + 2,
          y + height / 2 + index * itemHeight + 2,
          width - 4,
          itemHeight - 2
        );
      });

      this.dropdownElements.push(itemBg, itemText, itemArea);
    });
  }

  closeDropdown() {
    this.isDropdownOpen = false;
    this.dropdownElements.forEach((element) => element.destroy());
    this.dropdownElements = [];
  }

  selectBusiness(index) {
    this.selectedBusinessIndex = index;
    this.dropdownText.setText(this.businesses[index]);
    this.closeDropdown();
  }

  setupKeyboardInput() {
    // Handle keyboard navigation for dropdown
    this.input.keyboard.on("keydown", (event) => {
      if (event.key === "Enter") {
        this.validateAndEnterGame();
      } else if (event.key === "ArrowDown") {
        if (this.isDropdownOpen) {
          this.selectedBusinessIndex =
            (this.selectedBusinessIndex + 1) % this.businesses.length;
          this.dropdownText.setText(
            this.businesses[this.selectedBusinessIndex]
          );
          this.closeDropdown();
        }
      } else if (event.key === "ArrowUp") {
        if (this.isDropdownOpen) {
          this.selectedBusinessIndex =
            this.selectedBusinessIndex === 0
              ? this.businesses.length - 1
              : this.selectedBusinessIndex - 1;
          this.dropdownText.setText(
            this.businesses[this.selectedBusinessIndex]
          );
          this.closeDropdown();
        }
      }
    });
  }

  showEditProfile() {
    if (!this.databaseUsers || this.databaseUsers.length === 0) {
      this.showMessage("No profiles to edit. Create a profile first.", "#ff0000");
      return;
    }

    // Show selection UI or use the currently selected one
    const selectedBusiness = this.businesses[this.selectedBusinessIndex];
    if (!selectedBusiness) {
      this.showMessage("Please select a profile to edit from the dropdown.", "#ff0000");
      return;
    }

    const user = this.databaseUsers.find(u => u.business_name === selectedBusiness);
    if (user && window.showEditForm) {
      window.showEditForm(user.token);
    } else {
      this.showMessage("Selected profile not found in database.", "#ff0000");
    }
  }

  validateAndEnterGame() {
    if (this.currentMode === 'user' && this.userToken) {
        this.registry.set("gameMode", "business");
        this.registry.set("userToken", this.userToken);
        this.scene.start("Game");
        return;
    }

    if (this.currentMode === 'admin') {
        if (this.businesses && this.businesses.length > 0 && this.selectedBusinessIndex >= 0) {
            const selectedBusiness = this.businesses[this.selectedBusinessIndex];
            const user = this.databaseUsers.find(u => u.business_name === selectedBusiness);
            
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

  showMessage(text, color = "#ffffff") {
    // Remove existing message
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

    // Auto-remove after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.messageText) {
        this.messageText.destroy();
        this.messageText = null;
      }
    });
  }

  destroy() {
    this.closeDropdown();
    super.destroy();
  }

  createButton(x, y, text, callback) {
    const buttonWidth = 300;
    const buttonHeight = 40;
    const cornerRadius = 20;
    const maxFontSize = 20;
    const padding = 10;

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
    button.setInteractive(
      new Phaser.Geom.Rectangle(
        x - buttonWidth / 2,
        y - buttonHeight / 2,
        buttonWidth,
        buttonHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    let fontSize = maxFontSize;
    let buttonText;
    do {
      if (buttonText) buttonText.destroy();

      buttonText = this.add
        .text(x, y, text, {
          fontSize: `${fontSize}px`,
          fontFamily: "Arial",
          color: "#000000",
          fontStyle: "bold",
        })
        .setOrigin(0.5);

      fontSize -= 1;
    } while (buttonText.width > buttonWidth - padding && fontSize > 10);

    button.on("pointerover", () => {
      this.updateButtonStyle(
        button,
        shadow,
        x,
        y,
        buttonWidth,
        buttonHeight,
        cornerRadius,
        true
      );
      buttonText.y -= 2;
    });

    button.on("pointerout", () => {
      this.updateButtonStyle(
        button,
        shadow,
        x,
        y,
        buttonWidth,
        buttonHeight,
        cornerRadius,
        false
      );
      buttonText.y += 2;
    });

    button.on("pointerdown", callback);

    return { button, shadow, text: buttonText };
  }

  updateButtonStyle(button, shadow, x, y, width, height, radius, isHover) {
    button.clear();
    shadow.clear();

    if (isHover) {
      button.fillStyle(0x87ceeb, 1);
      shadow.fillStyle(0x888888, 1);
      shadow.fillRoundedRect(
        x - width / 2 + 2,
        y - height / 2 + 2,
        width,
        height,
        radius
      );
    } else {
      button.fillStyle(0xffffff, 1);
      shadow.fillStyle(0x666666, 1);
      shadow.fillRoundedRect(
        x - width / 2 + 4,
        y - height / 2 + 4,
        width,
        height,
        radius
      );
    }

    button.fillRoundedRect(
      x - width / 2,
      y - height / 2,
      width,
      height,
      radius
    );
  }

  showInstructions() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const elements = this.createInstructionPanel(centerX, centerY);

    const instructionContent = this.addInstructionContent(
      centerX,
      centerY,
      elements.panel
    );
    elements.title = instructionContent.title;
    elements.textElements = instructionContent.textElements;

    const closeElements = this.addCloseButton(centerX, centerY + 79, () => {
      this.destroyInstructionElements(elements);
    });
    elements.closeButton = closeElements.button;
    elements.closeText = closeElements.text;

    elements.overlay.on("pointerdown", () => {
      this.destroyInstructionElements(elements);
    });
  }

  createInstructionPanel(centerX, centerY) {
    const overlay = this.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(
        0,
        0,
        this.cameras.main.width,
        this.cameras.main.height
      ),
      Phaser.Geom.Rectangle.Contains
    );

    const panel = this.add.graphics();
    panel.fillStyle(0xffffff, 1);
    panel.fillRoundedRect(centerX - 200, centerY - 150, 400, 300, 20);
    panel.lineStyle(4, 0x000000, 1);
    panel.strokeRoundedRect(centerX - 200, centerY - 150, 400, 300, 20);

    return { overlay, panel };
  }

  addInstructionContent(centerX, centerY, panel) {
    const title = this.add
      .text(centerX, centerY - 110, "INSTRUCTIONS", {
        fontSize: "20px",
        fontFamily: "Arial",
        color: "#000000",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    const instructions = [
      "Arrow keys for moving",
      "SPACE for talking to business experts",
      "ESC for closing the dialogue",
    ];

    const textElements = [];
    let yPos = centerY - 59;
    instructions.forEach((instruction) => {
      textElements.push(
        this.add
          .text(centerX, yPos, instruction, {
            fontSize: "20px",
            fontFamily: "Arial",
            color: "#000000",
          })
          .setOrigin(0.5)
      );
      yPos += 40;
    });

    return { title, textElements };
  }

  addCloseButton(x, y, callback) {
    const adjustedY = y + 10;

    const buttonWidth = 100;
    const buttonHeight = 40;
    const cornerRadius = 10;

    const closeButton = this.add.graphics();
    closeButton.fillStyle(0x87ceeb, 1);
    closeButton.fillRoundedRect(
      x - buttonWidth / 2,
      adjustedY - buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      cornerRadius
    );
    closeButton.lineStyle(2, 0x000000, 1);
    closeButton.strokeRoundedRect(
      x - buttonWidth / 2,
      adjustedY - buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      cornerRadius
    );

    const closeText = this.add
      .text(x, adjustedY, "Close", {
        fontSize: "16px",
        fontFamily: "Arial",
        color: "#000000",
        fontStyle: "bold",
      })
      .setOrigin(0.5);

    closeButton.setInteractive(
      new Phaser.Geom.Rectangle(
        x - buttonWidth / 2,
        adjustedY - buttonHeight / 2,
        buttonWidth,
        buttonHeight
      ),
      Phaser.Geom.Rectangle.Contains
    );

    closeButton.on("pointerover", () => {
      closeButton.clear();
      closeButton.fillStyle(0x5cacee, 1);
      closeButton.fillRoundedRect(
        x - buttonWidth / 2,
        adjustedY - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
      closeButton.lineStyle(2, 0x000000, 1);
      closeButton.strokeRoundedRect(
        x - buttonWidth / 2,
        adjustedY - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
    });

    closeButton.on("pointerout", () => {
      closeButton.clear();
      closeButton.fillStyle(0x87ceeb, 1);
      closeButton.fillRoundedRect(
        x - buttonWidth / 2,
        adjustedY - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
      closeButton.lineStyle(2, 0x000000, 1);
      closeButton.strokeRoundedRect(
        x - buttonWidth / 2,
        adjustedY - buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        cornerRadius
      );
    });

    closeButton.on("pointerdown", callback);

    return { button: closeButton, text: closeText };
  }

  destroyInstructionElements(elements) {
    elements.overlay.destroy();
    elements.panel.destroy();
    elements.title.destroy();

    elements.textElements.forEach((text) => text.destroy());

    elements.closeButton.destroy();
    elements.closeText.destroy();
  }
}
