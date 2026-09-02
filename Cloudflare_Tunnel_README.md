# Cloudflare Tunnel（`sclemon1013.com` + `*.sclemon1013.com`）完整流程

適用：

- Windows + Docker
- Cloudflare
- HTTPS service (`443`)
- CGNAT
- Root domain + wildcard subdomain

支援：

```text
https://sclemon1013.com
https://www.sclemon1013.com
https://api.sclemon1013.com
https://*.sclemon1013.com
```

---

## 1. Cloudflare Tunnel Login（第一步）

建立資料夾：

```powershell
mkdir cloudflared
```

登入：

```powershell
docker run --rm -it `
-v ${PWD}/cloudflared:/home/nonroot/.cloudflared `
cloudflare/cloudflared:latest `
tunnel login
```

登入完成確認：

```powershell
dir .\cloudflared
```

應看到：

```text
cert.pem
```

---

## 2. 建立 Tunnel

```powershell
docker run --rm -it `
-v ${PWD}/cloudflared:/home/nonroot/.cloudflared `
cloudflare/cloudflared:latest `
tunnel create sclemon
```

記下：

```text
Tunnel ID
```

例如：

```text
7d36d152-f337-4728-953e-c6acc2e335ef
```

---

## 3. 建立 `config.yml`

建立：

```text
cloudflared/config.yml
```

內容：

```yaml
tunnel: TUNNEL_ID
credentials-file: /home/nonroot/.cloudflared/TUNNEL_ID.json

ingress:

  - hostname: sclemon1013.com
    service: https://host.docker.internal:443
    originRequest:
      noTLSVerify: true

  - hostname: "*.sclemon1013.com"
    service: https://host.docker.internal:443
    originRequest:
      noTLSVerify: true

  - service: http_status:404
```

替換：

```text
TUNNEL_ID
```

成實際 Tunnel ID。

---

## 4. 綁 Root Domain

建立：

```powershell
docker run --rm -it `
-v ${PWD}/cloudflared:/home/nonroot/.cloudflared `
cloudflare/cloudflared:latest `
tunnel route dns sclemon sclemon1013.com
```

成功：

```text
Added CNAME
```

---

## 5. 綁 Wildcard DNS

建立：

```powershell
docker run --rm -it `
-v ${PWD}/cloudflared:/home/nonroot/.cloudflared `
cloudflare/cloudflared:latest `
tunnel route dns sclemon *.sclemon1013.com
```

成功：

```text
Added CNAME
```

Cloudflare DNS 應看到：

```text
CNAME
sclemon1013.com
↓

Tunnel

CNAME
*.sclemon1013.com
↓

Tunnel
```

---

## 6. 啟動 Tunnel

```powershell
docker stop cloudflared
docker rm cloudflared

docker run -d `
--name cloudflared `
--restart unless-stopped `
-v ${PWD}/cloudflared:/home/nonroot/.cloudflared `
cloudflare/cloudflared:latest `
tunnel --config /home/nonroot/.cloudflared/config.yml run
```

---

## 7. 查看 Log

```powershell
docker logs -f cloudflared
```

成功：

```text
Registered tunnel connection
```

例如：

```text
INF Registered tunnel connection
location=tpe01
protocol=quic
```

---

## 8. 測試

應成功：

```text
https://sclemon1013.com

https://www.sclemon1013.com

https://api.sclemon1013.com

https://xxx.sclemon1013.com
```

包含：

- 根網域
- 所有子網域
- 所有 URL path

例如：

```text
https://sclemon1013.com/blog

https://api.sclemon1013.com/user
```

不需額外設定。

---

## 常見錯誤

### Error 522

Cloudflare 找不到 origin。

改用 Tunnel。

---

### Error 1033

Tunnel 沒跑。

檢查：

```powershell
docker logs -f cloudflared
```

---

### `config.yml not found`

錯：

```text
config.yaml
```

對：

```text
config.yml
```

---

### DNS already exists

原因：

舊：

```text
A → public IP
```

沒刪。

刪除舊 A record。

---

## 最終效果

不需要：

❌ Public IP  
❌ DDNS  
❌ Port Forward  
❌ 固定 IP  
❌ 擔心 CGNAT