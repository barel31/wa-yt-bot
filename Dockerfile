FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip ffmpeg
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --upgrade pip && \
    pip install yt-dlp

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Fix permissions explicitly (if using local binaries)
RUN chmod +x bin/yt-dlp bin/ffmpeg

EXPOSE 3000
CMD ["npm", "start"]
