# Use Node.js 18 as the base image
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# npm is already included with Node.js

# Copy package.json and package-lock.json first (to leverage Docker caching)
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Expose port 3000 for the application
EXPOSE 3000

# Start the application in development mode
CMD ["npm", "run", "start:dev"]
