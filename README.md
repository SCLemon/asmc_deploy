# Docker 環境與專案部署指南

## 目錄

* [建立 Docker Network](#建立-docker-network)
* [安裝 Docker Container](#安裝-docker-container)
* [操作容器](#操作容器)
* [匯出與匯入容器](#匯出與匯入容器)
* [設置主專案 Docker 環境](#設置主專案-docker-環境)
* [PORT 操作常用指令](#port-操作常用指令)
* [Windows 防火牆設定](#windows-防火牆設定)
* [路由器設定](#路由器設定)
* [Generate SSL Certification (HTTPS Environment)](#generate-ssl-certification-https-environment)
* [Modify SSL Certification Relative Path](#modify-ssl-certification-relative-path)

---

## 建立 Docker Network

```bash
docker network create sky_net
```

---

## 安裝 Docker Container

### Ubuntu 主容器

```bash
docker run -it --name sky --network sky_net -p 80:80 -p 443:443 -v C:\sky_docker_localDatabase:/mnt/sky_database ubuntu:22.04 bash
```

### MongoDB 容器

```bash
docker run -d --name sky_mongo --network sky_net -v C:\sky_docker_mongodb:/data/db mongo:8.0
```

---

## 操作容器

### 開啟容器

```bash
docker exec -it <container_id_or_name> bash
# 範例：
docker exec -it 5822f574cd79ca1b9556ca99139db6ebdd7ac7e7f408875c9d32079478761c4b bash
```

### 停止容器

```bash
docker stop <container_id_or_name>
```

### 離開容器

```bash
exit
```

---

## 匯出與匯入容器

### 匯出容器為 `.tar` 檔

```bash
docker commit <container_id_or_name> sky_image:latest
docker save -o sky_image.tar sky_image:latest
```

### 從 `.tar` 匯入成新容器

```bash
docker load -i sky_image.tar
```

### 以相同 network 與 volume 運行

```bash
docker network create sky_net
docker run -d --name sky_mongo --network sky_net -v C:\sky_docker_mongodb:/data/db mongo:8.0
docker run -it --name sky --network sky_net -p 80:80 -p 443:443 -v C:\sky_docker_localDatabase:/mnt/sky_database sky_image:latest
```

---

## 設置主專案 Docker 環境

### 更新系統

```bash
apt update && apt upgrade -y
```

### 安裝 Node.js 與 npm

```bash
apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 檢查版本
node -v
npm -v
```

### 安裝常用套件

```bash
apt update
apt install -y git nano lsof
```

### 下載專案

```bash
git clone https://github.com/SCLemon/web_deploy.git
```

### 安裝專案

```bash
bash setup.sh
```

### 啟動與關閉專案

```bash
bash start.sh
bash stop.sh
```

---

## PORT 操作常用指令

```bash
# 查詢指定 Port 的 PID
sudo lsof -i :80

# 強制停止程序
sudo kill -9 <PID>
```

---

## Windows 防火牆設定

1. 按 `Win + R` → 輸入 `wf.msc` → Enter
2. 左側選 **入站規則 (Inbound Rules)**
3. 右側選 **新增規則 (New Rule...)** → 選 **Port (連接埠)** → 下一步
4. 選 **TCP**，輸入特定本地端口：

   ```
   80, 443
   ```
5. 選 **允許連線 (Allow the connection)** → 下一步
6. 勾選 **Domain / Private / Public** → 下一步
7. 給規則取名字，例如：`Docker Web Ports` → 完成

---

## 路由器設定

* 設置 **Port Forwarding**
* 設置 **IP Reservation**

---

## Generate SSL Certification (HTTPS Environment)

```bash
// 獲取免費 Domain Name
https://my.noip.com/

// 安裝 Let's Encrypt
sudo apt update
sudo apt install certbot

// 手動獲取憑證
sudo certbot certonly --standalone

// 自動更新憑證
sudo certbot renew --dry-run
```

---

## Modify SSL Certification Relative Path

```bash
You should modify path for these files in sslPath.js
```


---

## 查看 Docker 中 mongodb 資料

```
docker exec -it <容器名稱> mongosh
show dbs
use <your_db>
show collections
db.<your_collection>.find().limit(10)
```