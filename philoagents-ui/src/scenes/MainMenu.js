import { Scene } from "phaser";
import apiService from "../services/ApiService.js";

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

    // Load users from database
    await this.loadUsersFromDatabase();

    // Setup keyboard input (needs to be before createTokenInput)
    this.setupKeyboardInput();

    // Add token input section (after database loads)
    this.createTokenInput(centerX, startY);

    // Create buttons in a 2x2 grid layout
    const firstLineY = startY + buttonSpacing;
    const secondLineY = firstLineY + buttonSpacing + 10; // Extra space between rows

    // First row: Enter and Instructions (side by side)
    this.createButton(centerX - 180, firstLineY, "Enter", () => {
      this.validateAndEnterGame();
    });

    this.createButton(centerX + 180, firstLineY, "Instructions", () => {
      this.showInstructions();
    });

    // Second row: Create Profile and Edit Profile (side by side)
    this.createButton(centerX - 180, secondLineY, "Create Profile", () => {
      // Call global function from simple-profile.js
      if (window.showCreateForm) {
        window.showCreateForm();
      } else {
        console.error('showCreateForm function not found');
      }
    });

    this.createButton(
      centerX + 180,
      secondLineY,
      "Edit Profile",
      () => {
        this.showEditProfile();
      }
    );

    // Expose refresh function globally for the form
    window.refreshBusinessDropdown = () => {
      this.loadUsersFromDatabase();
    };
  }

  async loadUsersFromDatabase() {
    try {
      console.log("Loading users from database...");
      this.databaseUsers = await apiService.getAllBusinessUsers();
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
      } else {
        // No users in database yet - show helpful message
        console.log("No users found in database. Please create a profile first.");
        this.businesses = [];
        if (this.dropdownText) {
          this.dropdownText.setText("No profiles - Create one!");
        }
      }
    } catch (error) {
      console.error("Error loading users from database:", error);
      // Fall back to empty list
      this.businesses = [];
      if (this.dropdownText) {
        this.dropdownText.setText("Error loading - Try again");
      }
    }
  }

  createTokenInput(centerX, y) {
    // Create dropdown field background
    const dropdownWidth = 350;
    const dropdownHeight = 40;

    // Add label
    this.add
      .text(centerX, y - 35, "Select Your Business:", {
        fontSize: "18px",
        fontFamily: "Arial",
        color: "#2b97bd",
        stroke: "#000000",
        strokeThickness: 1,
      })
      .setOrigin(0.5);

    // Create main dropdown button
    this.createDropdownButton(centerX, y, dropdownWidth, dropdownHeight);
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
    if (!this.businesses || this.businesses.length === 0) {
      this.showMessage("No profiles available. Create a profile first.", "#ff0000");
      return;
    }

    const selectedBusiness = this.businesses[this.selectedBusinessIndex];
    if (!selectedBusiness) {
      this.showMessage("Please select a business from the dropdown.", "#ff0000");
      return;
    }

    // Find the user in database to get their token
    const user = this.databaseUsers.find(u => u.business_name === selectedBusiness);

    if (user && user.token) {
      this.registry.set("gameMode", "business");
      this.registry.set("userToken", user.token);
      this.scene.start("Game");
    } else {
      // Fallback to old behavior
      this.registry.set("gameMode", "business");
      this.registry.set("userToken", selectedBusiness);
      this.scene.start("Game");
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
