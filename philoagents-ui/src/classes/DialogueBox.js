class DialogueBox {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.awaitingInput = false;
        
        // Set default configuration values
        const {
            x = 512, // Centered horizontally (1024/2)
            y = 600, // Positioned towards bottom
            width = 824,
            height = 200,
            depth = 30
        } = config;
        
        this.width = width;
        this.height = height;

        // Create DOM element
        this.domElement = scene.add.dom(x, y).createFromHTML(`
            <div class="chat-box-container" style="width: ${width}px; height: ${height}px;">
                <div class="chat-box-content"></div>
            </div>
        `);

        this.domElement.setDepth(depth);
        this.domElement.setScrollFactor(0);
        
        // Store reference to the content div for updating text
        this.contentDiv = this.domElement.node.querySelector('.chat-box-content');
        this.containerDiv = this.domElement.node.querySelector('.chat-box-container');
        
        this.hide();
    }
    
    show(message, awaitInput = false) {
        if (this.contentDiv) {
            // Handle newlines and preserve whitespace
            this.contentDiv.innerText = message;
            
            // Auto-scroll to bottom
            if (this.containerDiv) {
                this.containerDiv.scrollTop = this.containerDiv.scrollHeight;
            }
        }
        
        this.domElement.setVisible(true);
        this.awaitingInput = awaitInput;
    }
    
    hide() {
        this.domElement.setVisible(false);
        this.awaitingInput = false;
    }
    
    isVisible() {
        return this.domElement.visible;
    }

    isAwaitingInput() {
        return this.awaitingInput;
    }
}

export default DialogueBox; 