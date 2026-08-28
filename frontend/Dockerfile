FROM nginx:alpine

# Copy frontend static files
COPY . /usr/share/nginx/html

# Custom nginx config: serve static files + proxy /api to backend
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
