# 2315000174

Campus Notification System backend API for managing student notifications related to placements, events, and results.

## Project Structure

```text
AffordM/
├─ backend/
│  └─ server.js
├─ notification_system_design.md
├─ package.json
├─ package-lock.json
└─ README.md
```

## Run Locally

```bash
npm install
npm start
```

The server runs on:

```text
http://localhost:3000
```

## API Base Path

```text
/v1
```

Main endpoints include:

```text
GET    /v1/notifications
GET    /v1/notifications/:notificationId
PATCH  /v1/notifications/:notificationId/read
PATCH  /v1/notifications/read-all
POST   /v1/notifications
DELETE /v1/notifications/:notificationId
GET    /v1/notifications/stream
```
