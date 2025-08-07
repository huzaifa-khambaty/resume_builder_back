# Use the official Node.js LTS image as the base
FROM node:20

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json (if exists)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 8000

# Command to run the Express.js application
CMD ["node", "src/index.js"]