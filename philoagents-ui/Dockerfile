#  --- Build Stage ---
# Use a Node.js image with more tools for building
FROM node:18 AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy all project files for the build
# The .dockerignore file will exclude node_modules and other unnecessary files
COPY . .

# Build the application for production
# This command runs your webpack/config.prod.js
RUN npm run build

# --- Production Stage ---
# Use a minimal Nginx or Alpine Node.js image for the final serving environment
# Here we'll use node:18-alpine again, but only install 'serve' globally.
FROM node:18-alpine

# Install 'serve' globally to serve static files
RUN npm install -g serve

WORKDIR /app

# Copy the built application from the 'builder' stage
# Assuming `npm run build` outputs to a 'dist' directory.
# If your build output is elsewhere (e.g., 'build', 'public'), adjust this path.
COPY --from=builder /app/dist ./

# Expose the port that 'serve' will listen on
EXPOSE 8080

# Command to run the static file server
# --no-clipboard: prevents 'serve' from trying to open a browser
# -l 8080: tells 'serve' to listen on port 8080
# -s: serves static files from the current directory
CMD ["serve", "-s", "-l", "8080"]