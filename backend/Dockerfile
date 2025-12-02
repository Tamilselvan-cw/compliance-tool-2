FROM node:20-slim
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --silent

# Copy app
COPY . .

# Default command for CI - run tests
CMD ["npm","test"]
