# Stage 1

## Scenario

The Campus Notification System sends notifications to students for:

* Placements
* Events
* Results

The platform exposes a REST API for clients such as web apps, mobile apps, and admin dashboards. The API is designed for production use with authentication, pagination, filtering, consistent response formats, and real-time delivery.

## Supported User Actions

| Action | Description |
| --- | --- |
| Get notifications | Retrieve a paginated list of notifications for the authenticated student |
| Get single notification | Retrieve details of one notification |
| Mark notification as read | Mark one notification as read for the authenticated student |
| Mark all notifications as read | Mark all unread notifications as read for the authenticated student |
| Create notification | Create and publish a notification through an authorized admin or system account |
| Delete notification | Soft-delete a notification when an authorized admin needs to remove it |

## Base URL

```text
https://api.campus.example.com/v1
```

## Required Request Headers

All authenticated endpoints require:

```http
Authorization: Bearer <access_token>
Accept: application/json
```

Endpoints with a JSON request body also require:

```http
Content-Type: application/json
```

Recommended production headers:

```http
X-Request-Id: 8f3f5e1d-9e3b-4fd1-93cf-52a7f71f44d2
Idempotency-Key: create-notification-2026-06-10-001
```

`Idempotency-Key` is required for notification creation to prevent duplicate notifications during retries.

## Notification Object Schema

```json
{
  "id": "ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D",
  "type": "PLACEMENT",
  "title": "Placement drive: Acme Technologies",
  "message": "Acme Technologies is conducting a placement drive for final-year CSE students.",
  "priority": "HIGH",
  "audience": {
    "scope": "DEPARTMENT",
    "department": "CSE",
    "year": 4
  },
  "metadata": {
    "companyName": "Acme Technologies",
    "applicationDeadline": "2026-06-20T18:00:00Z"
  },
  "createdBy": {
    "id": "usr_admin_102",
    "role": "PLACEMENT_OFFICER"
  },
  "createdAt": "2026-06-10T09:00:00Z",
  "updatedAt": "2026-06-10T09:00:00Z",
  "publishedAt": "2026-06-10T09:05:00Z",
  "expiresAt": "2026-06-20T18:00:00Z",
  "readAt": null,
  "isRead": false,
  "links": {
    "self": "/v1/notifications/ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D"
  }
}
```

### Field Rules

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | string | Yes | Unique notification identifier |
| `type` | string | Yes | One of `PLACEMENT`, `EVENT`, `RESULT` |
| `title` | string | Yes | Short notification title |
| `message` | string | Yes | Full notification message |
| `priority` | string | Yes | One of `LOW`, `NORMAL`, `HIGH`, `URGENT` |
| `audience` | object | Yes | Target students for the notification |
| `metadata` | object | No | Type-specific additional data |
| `createdBy` | object | Yes | User or service that created the notification |
| `createdAt` | string | Yes | ISO 8601 creation timestamp |
| `updatedAt` | string | Yes | ISO 8601 last update timestamp |
| `publishedAt` | string | Yes | ISO 8601 publish timestamp |
| `expiresAt` | string | No | ISO 8601 expiry timestamp |
| `readAt` | string or null | Yes | ISO 8601 read timestamp for the authenticated student |
| `isRead` | boolean | Yes | Whether the authenticated student has read the notification |
| `links` | object | Yes | API resource links |

## API Endpoints

### 1. Get Notifications

```http
GET /v1/notifications
```

Retrieves notifications visible to the authenticated student.

#### Query Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, starting from `1`. Default: `1` |
| `limit` | integer | No | Number of items per page. Default: `20`, maximum: `100` |
| `type` | string | No | Filter by `PLACEMENT`, `EVENT`, or `RESULT` |
| `isRead` | boolean | No | Filter read or unread notifications |
| `sort` | string | No | Sort field. Default: `-publishedAt` |

#### Sample Request

```http
GET /v1/notifications?type=PLACEMENT&isRead=false&page=1&limit=10 HTTP/1.1
Host: api.campus.example.com
Authorization: Bearer <access_token>
Accept: application/json
X-Request-Id: 8f3f5e1d-9e3b-4fd1-93cf-52a7f71f44d2
```

#### Sample Response

```json
{
  "success": true,
  "data": [
    {
      "id": "ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D",
      "type": "PLACEMENT",
      "title": "Placement drive: Acme Technologies",
      "message": "Acme Technologies is conducting a placement drive for final-year CSE students.",
      "priority": "HIGH",
      "audience": {
        "scope": "DEPARTMENT",
        "department": "CSE",
        "year": 4
      },
      "metadata": {
        "companyName": "Acme Technologies",
        "applicationDeadline": "2026-06-20T18:00:00Z"
      },
      "createdBy": {
        "id": "usr_admin_102",
        "role": "PLACEMENT_OFFICER"
      },
      "createdAt": "2026-06-10T09:00:00Z",
      "updatedAt": "2026-06-10T09:00:00Z",
      "publishedAt": "2026-06-10T09:05:00Z",
      "expiresAt": "2026-06-20T18:00:00Z",
      "readAt": null,
      "isRead": false,
      "links": {
        "self": "/v1/notifications/ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

### 2. Get Single Notification

```http
GET /v1/notifications/{notificationId}
```

Retrieves one notification if it is visible to the authenticated student.

#### Sample Request

```http
GET /v1/notifications/ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D HTTP/1.1
Host: api.campus.example.com
Authorization: Bearer <access_token>
Accept: application/json
X-Request-Id: 62aeb1f0-7c25-4e48-9e80-4ce2d4d037d0
```

#### Sample Response

```json
{
  "success": true,
  "data": {
    "id": "ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D",
    "type": "PLACEMENT",
    "title": "Placement drive: Acme Technologies",
    "message": "Acme Technologies is conducting a placement drive for final-year CSE students.",
    "priority": "HIGH",
    "audience": {
      "scope": "DEPARTMENT",
      "department": "CSE",
      "year": 4
    },
    "metadata": {
      "companyName": "Acme Technologies",
      "applicationDeadline": "2026-06-20T18:00:00Z"
    },
    "createdBy": {
      "id": "usr_admin_102",
      "role": "PLACEMENT_OFFICER"
    },
    "createdAt": "2026-06-10T09:00:00Z",
    "updatedAt": "2026-06-10T09:00:00Z",
    "publishedAt": "2026-06-10T09:05:00Z",
    "expiresAt": "2026-06-20T18:00:00Z",
    "readAt": null,
    "isRead": false,
    "links": {
      "self": "/v1/notifications/ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D"
    }
  }
}
```

### 3. Mark Notification As Read

```http
PATCH /v1/notifications/{notificationId}/read
```

Marks one notification as read for the authenticated student.

#### Sample Request Body

```json
{
  "readAt": "2026-06-10T10:15:00Z"
}
```

If `readAt` is not provided, the server uses the current server timestamp.

#### Sample Response

```json
{
  "success": true,
  "data": {
    "id": "ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D",
    "isRead": true,
    "readAt": "2026-06-10T10:15:00Z"
  }
}
```

### 4. Mark All Notifications As Read

```http
PATCH /v1/notifications/read-all
```

Marks all unread notifications visible to the authenticated student as read.

#### Sample Request Body

```json
{
  "type": "PLACEMENT"
}
```

The `type` field is optional. If omitted, all unread notifications are marked as read.

#### Sample Response

```json
{
  "success": true,
  "data": {
    "markedReadCount": 12,
    "readAt": "2026-06-10T10:20:00Z"
  }
}
```

### 5. Create Notification

```http
POST /v1/notifications
```

Creates and publishes a notification. This endpoint is restricted to authorized admin, faculty, placement, exam, or system roles.

#### Sample Request

```http
POST /v1/notifications HTTP/1.1
Host: api.campus.example.com
Authorization: Bearer <admin_access_token>
Content-Type: application/json
Accept: application/json
Idempotency-Key: create-notification-2026-06-10-001
X-Request-Id: c9e34e9d-68eb-4a02-8d26-29590b5d3276
```

#### Sample Request Body

```json
{
  "type": "EVENT",
  "title": "Technical symposium registration opens",
  "message": "Registrations are open for the annual technical symposium.",
  "priority": "NORMAL",
  "audience": {
    "scope": "ALL_STUDENTS"
  },
  "metadata": {
    "eventId": "evt_2026_041",
    "eventDate": "2026-06-25T09:30:00Z",
    "venue": "Main Auditorium"
  },
  "publishedAt": "2026-06-10T11:00:00Z",
  "expiresAt": "2026-06-25T09:30:00Z"
}
```

#### Sample Response

```json
{
  "success": true,
  "data": {
    "id": "ntf_01JZ92F2M7WQWBA8EV9RX4K41N",
    "type": "EVENT",
    "title": "Technical symposium registration opens",
    "message": "Registrations are open for the annual technical symposium.",
    "priority": "NORMAL",
    "audience": {
      "scope": "ALL_STUDENTS"
    },
    "metadata": {
      "eventId": "evt_2026_041",
      "eventDate": "2026-06-25T09:30:00Z",
      "venue": "Main Auditorium"
    },
    "createdBy": {
      "id": "usr_admin_204",
      "role": "EVENT_COORDINATOR"
    },
    "createdAt": "2026-06-10T10:58:00Z",
    "updatedAt": "2026-06-10T10:58:00Z",
    "publishedAt": "2026-06-10T11:00:00Z",
    "expiresAt": "2026-06-25T09:30:00Z",
    "readAt": null,
    "isRead": false,
    "links": {
      "self": "/v1/notifications/ntf_01JZ92F2M7WQWBA8EV9RX4K41N"
    }
  }
}
```

### 6. Delete Notification

```http
DELETE /v1/notifications/{notificationId}
```

Soft-deletes a notification. This is needed for moderation, incorrect announcements, duplicate notices, or compliance requests. This endpoint is restricted to authorized admin or system roles.

#### Sample Request

```http
DELETE /v1/notifications/ntf_01JZ92F2M7WQWBA8EV9RX4K41N HTTP/1.1
Host: api.campus.example.com
Authorization: Bearer <admin_access_token>
Accept: application/json
X-Request-Id: 5cb14cc2-4d2d-4b22-8b94-3261ba32f247
```

#### Sample Response

```json
{
  "success": true,
  "data": {
    "id": "ntf_01JZ92F2M7WQWBA8EV9RX4K41N",
    "deleted": true,
    "deletedAt": "2026-06-10T11:30:00Z"
  }
}
```

## Pagination Design

The list endpoint uses page-based pagination:

```http
GET /v1/notifications?page=1&limit=20
```

Pagination response format:

```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 125,
    "totalPages": 7,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

Rules:

* `page` starts at `1`.
* Default `limit` is `20`.
* Maximum `limit` is `100`.
* Default sorting is newest first using `publishedAt`.
* Invalid pagination values return `400 Bad Request`.

## Filtering By Notification Type

Clients can filter notifications by type:

```http
GET /v1/notifications?type=PLACEMENT
GET /v1/notifications?type=EVENT
GET /v1/notifications?type=RESULT
```

Only these values are accepted:

```text
PLACEMENT, EVENT, RESULT
```

Invalid values return `400 Bad Request`.

## Filtering Unread Notifications

Clients can fetch only unread notifications:

```http
GET /v1/notifications?isRead=false
```

Clients can combine unread filtering with type filtering:

```http
GET /v1/notifications?type=RESULT&isRead=false&page=1&limit=20
```

## Error Response Format

All errors use a consistent JSON structure:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more request parameters are invalid.",
    "details": [
      {
        "field": "type",
        "message": "type must be one of PLACEMENT, EVENT, RESULT"
      }
    ],
    "requestId": "8f3f5e1d-9e3b-4fd1-93cf-52a7f71f44d2"
  }
}
```

### Common Error Codes

| HTTP Status | Code | Description |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid request parameters or body |
| `401` | `UNAUTHORIZED` | Missing, expired, or invalid access token |
| `403` | `FORBIDDEN` | Authenticated user does not have permission |
| `404` | `NOT_FOUND` | Notification does not exist or is not visible to the user |
| `409` | `CONFLICT` | Duplicate request or conflicting state |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many requests |
| `500` | `INTERNAL_SERVER_ERROR` | Unexpected server error |

## Real-Time Notification Architecture

### Chosen Approach: Server-Sent Events (SSE)

```http
GET /v1/notifications/stream
```

SSE is chosen over WebSocket for this notification platform.

### Justification

SSE is a strong fit because notification delivery is primarily one-way: the server pushes new placement, event, and result notifications to authenticated students. Clients do not need continuous bidirectional communication for the core notification use case.

Benefits of SSE:

* Simpler than WebSocket for server-to-client event streams.
* Works over standard HTTP.
* Supports automatic browser reconnection.
* Easier to operate behind common proxies and load balancers.
* Lower implementation complexity for web and mobile clients.

WebSocket would be more appropriate if the system required bidirectional features such as live chat, collaborative editing, or real-time acknowledgement flows. For this assessment, read status updates and notification actions are handled through REST endpoints, while new notification delivery is handled through SSE.

### SSE Request

```http
GET /v1/notifications/stream HTTP/1.1
Host: api.campus.example.com
Authorization: Bearer <access_token>
Accept: text/event-stream
X-Request-Id: f3c99ed6-a5d1-4654-9ea6-52209f439e2a
```

### SSE Event Example

```text
event: notification.created
id: ntf_01JZ92F2M7WQWBA8EV9RX4K41N
data: {"id":"ntf_01JZ92F2M7WQWBA8EV9RX4K41N","type":"EVENT","title":"Technical symposium registration opens","message":"Registrations are open for the annual technical symposium.","priority":"NORMAL","publishedAt":"2026-06-10T11:00:00Z","isRead":false}
```

### Real-Time Delivery Flow

1. Student client authenticates and opens `/v1/notifications/stream`.
2. Server validates the access token and keeps the HTTP stream open.
3. When a notification is published, the server checks audience eligibility.
4. Eligible connected students receive a `notification.created` event.
5. Client displays the notification and may call REST endpoints to fetch details or mark it as read.
6. If the stream disconnects, the client reconnects and fetches missed notifications through `GET /v1/notifications`.

## Assumptions

* Authentication is handled using bearer access tokens issued by the campus identity system.
* Students can only access notifications targeted to them.
* Admin users can create and delete notifications based on role-based access control.
* Delete means soft delete, so audit history can be retained.
* Read state is stored per student, not globally on the notification.
* Notification IDs are globally unique and opaque.
* All timestamps use UTC in ISO 8601 format.
* The system supports rate limiting, request logging, and audit logging in production.
* Expired notifications are hidden from normal student lists unless an admin endpoint explicitly requests them.
* Result notifications do not expose sensitive marks directly unless the authenticated student is authorized to view them.
