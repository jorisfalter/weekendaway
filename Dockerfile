# Use the latest Node.js version
FROM node:18

# Set the working directory inside the container
WORKDIR /app

# Copy package.json first to leverage Docker caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all project files
COPY . .

# Ensure schiphol_arrivals.html is explicitly copied
COPY schiphol_arrivals.html /app/

# Expose port 8080 (Fly.io default)
EXPOSE 8080

# Start the server
CMD ["node", "schiphol_api.js"]
