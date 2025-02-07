# Use the latest Node.js version
FROM node:18

# Set the working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all project files
COPY . .

# Expose port 3000
EXPOSE 3000

# Start your server
CMD ["node", "schiphol_api.js"]
