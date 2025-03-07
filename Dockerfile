FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the app
COPY . .

# If you no longer need yt-dlp and ffmpeg binaries, you can remove this:
# RUN chmod +x bin/yt-dlp bin/ffmpeg

# Expose the port your app runs on
EXPOSE 3000

CMD ["npm", "start"]
