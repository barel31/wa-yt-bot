FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip ffmpeg

# Create and activate a Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install yt-dlp within virtual environment
RUN pip install --upgrade pip && \
    pip install yt-dlp

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
