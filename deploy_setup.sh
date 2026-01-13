#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Setup Firewall
sudo ufw allow 'Nginx Full'
sudo ufw allow 22
sudo ufw --force enable

# Create boilerplate Nginx config
NGINX_CONF="/etc/nginx/sites-available/asesoria"
sudo bash -c "cat > $NGINX_CONF <<EOF
server {
    listen 80;
    server_name _; 

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\\$host;
        proxy_cache_bypass \\\$http_upgrade;
    }
}
EOF"

# Enable the site and restart Nginx
sudo ln -s /etc/nginx/sites-available/asesoria /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

# Clone instruction (placeholder)
echo "===================================================="
echo "Servidor configurado. Pasos siguientes:"
echo "1. Clonar repo: git clone <REPO_URL>"
echo "2. Entrar a backend: cd asesoria_app/backend"
echo "3. Instalar deps: npm install"
echo "4. Crear .env basándose en secreto local"
echo "5. Iniciar PM2: pm2 start ecosystem.config.js"
echo "6. Guardar config: pm2 save && pm2 startup"
echo "===================================================="
