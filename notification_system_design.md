# Campus Notification System

> Project ID: 2315000174

This document outlines the system architecture, REST API design, database schemas, query optimizations, and scaling strategies for the Campus Notification System.

---

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

---

# Stage 2

## Primary Database

PostgreSQL is selected as the primary database for the Campus Notification System.

## Why PostgreSQL

PostgreSQL is suitable because the system has structured data with clear relationships. Students, notifications, and read status records need reliable consistency, so a relational database is a practical choice.

PostgreSQL also supports constraints, foreign keys, indexing, transactions, JSONB fields, partitioning, and read replicas. These features are useful for production notification APIs where users need filtering, unread status, pagination, and reliable data storage.

## Relational Schema

The database contains three main tables:

* `students`
* `notifications`
* `notification_read_status`

The `students` table stores student information. The `notifications` table stores the notification content and targeting details. The `notification_read_status` table stores whether a specific student has read a specific notification.

## Table Relationships

One student can read many notifications, and one notification can be read by many students. This creates a many-to-many relationship between `students` and `notifications`.

The `notification_read_status` table resolves this relationship:

* `students.id` is referenced by `notification_read_status.student_id`
* `notifications.id` is referenced by `notification_read_status.notification_id`
* A unique constraint on `(student_id, notification_id)` ensures that a student can have only one read record for the same notification

Unread notifications are not stored as separate rows. If a notification has no matching read status row for a student, it is treated as unread.

## SQL CREATE TABLE Statements

```sql
CREATE TABLE students (
    id TEXT PRIMARY KEY,
    roll_number VARCHAR(30) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    department VARCHAR(50) NOT NULL,
    academic_year SMALLINT NOT NULL CHECK (academic_year BETWEEN 1 AND 5),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('PLACEMENT', 'EVENT', 'RESULT')),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'NORMAL'
        CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
    audience_scope VARCHAR(30) NOT NULL
        CHECK (audience_scope IN ('ALL_STUDENTS', 'DEPARTMENT')),
    audience_department VARCHAR(50),
    audience_year SMALLINT CHECK (audience_year IS NULL OR audience_year BETWEEN 1 AND 5),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by_id TEXT,
    created_by_role VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT notifications_department_required_check
        CHECK (audience_scope <> 'DEPARTMENT' OR audience_department IS NOT NULL)
);
```

```sql
CREATE TABLE notification_read_status (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT notification_read_status_student_notification_unique
        UNIQUE (student_id, notification_id)
);
```

## Indexing Strategy

### Student Lookup

```sql
CREATE INDEX idx_students_department_year
ON students (department, academic_year);
```
This index optimizes queries targeting notifications to students of a specific department and year.

```sql
CREATE INDEX idx_students_active
ON students (is_active);
```
This index helps retrieve active students quickly.

### Unread Notifications

```sql
CREATE INDEX idx_notification_read_status_student
ON notification_read_status (student_id);
```
This speeds up query filters locating notifications read by a specific student.

```sql
CREATE INDEX idx_notification_read_status_notification
ON notification_read_status (notification_id);
```
This helps retrieve read records associated with a specific notification.

```sql
CREATE UNIQUE INDEX idx_notification_read_status_student_notification
ON notification_read_status (student_id, notification_id);
```
This constraint/index ensures that a student registers at most one read status per notification, and facilitates fast join lookups to verify read/unread status.

### Notification Queries & Filters

```sql
CREATE INDEX idx_notifications_type
ON notifications (type);
```
This speeds up filtering notifications by type (`PLACEMENT`, `EVENT`, `RESULT`).

```sql
CREATE INDEX idx_notifications_created_at
ON notifications (created_at DESC);
```
This supports admin or audit panels that sort created notifications by creation date in descending order.

```sql
CREATE INDEX idx_notifications_published_at
ON notifications (published_at DESC);
```
This speeds up query feeds sorting notifications by publish date.

```sql
CREATE INDEX idx_notifications_type_published_active
ON notifications (type, published_at DESC)
WHERE deleted_at IS NULL;
```
This composite partial index optimizes the main user feed queries, which filter by type, exclude soft-deleted items, and order by publish date descending.

## Unread Notification Query

Unread notifications can be found using a `LEFT JOIN` because read status exists only after the student reads the notification.

```sql
SELECT n.*
FROM notifications n
LEFT JOIN notification_read_status rs
    ON rs.notification_id = n.id
   AND rs.student_id = $1
WHERE rs.id IS NULL
  AND n.deleted_at IS NULL
ORDER BY n.published_at DESC
LIMIT $2 OFFSET $3;
```

This design avoids creating unnecessary unread rows for every student.

## Pagination

The Stage 1 API uses page-based pagination:

```text
GET /v1/notifications?page=1&limit=20
```

This is simple for clients and works well for normal usage. For a larger system, cursor-based pagination can be added later using `published_at` and `id`.

Recommended ordering:

```sql
ORDER BY published_at DESC, id DESC
```

The second sort field keeps the order stable when two notifications have the same timestamp.

## Scaling Challenges

The main challenge is that a single notification may be visible to many students. Creating one notification copy for every student would increase storage quickly.

To avoid that, the notification is stored once in `notifications`, and the target audience is stored with it. The `notification_read_status` table stores only read actions. This keeps the schema smaller and easier to maintain.

Other challenges are:

* Fetching unread counts quickly
* Handling high traffic during result announcements
* Keeping notification lists fast as data grows
* Managing real-time notification delivery

## Partitioning

If the `notifications` table becomes very large, it can be partitioned by time using `published_at`. Monthly partitions are a practical option.

Example partitions:

* `notifications_2026_06`
* `notifications_2026_07`
* `notifications_2026_08`

This makes old notifications easier to archive and keeps recent notification queries faster.

## Caching With Redis

Redis can be used as a cache, but PostgreSQL remains the source of truth.

Useful Redis use cases:

* Unread notification count for each student
* Recently published notifications
* Rate limiting API requests
* Real-time delivery support for SSE connections

Redis should store short-lived data that can be rebuilt from PostgreSQL if needed.

## Read Replicas

Read replicas can be used when many students are reading notifications at the same time. Read-heavy endpoints can use replicas:

* Get notifications
* Get single notification
* Filter notifications by type
* Load notification history

Write operations should go to the primary database:

* Create notification
* Mark notification as read
* Mark all notifications as read
* Delete notification

For actions where the user expects immediate updated data, the system should read from the primary database to avoid replication delay.

## Assumptions

* Authentication is handled by the campus identity system.
* Student and notification IDs are stored as custom prefixed strings (e.g. `stu_1001`, `ntf_...`) using the `TEXT` type rather than native PostgreSQL `UUID` values.
* Notification types are `PLACEMENT`, `EVENT`, and `RESULT`.
* Read status is stored per student.
* A notification is unread if there is no row in `notification_read_status`.
* Deleting a notification is handled using soft delete with `deleted_at`.
* Notification metadata uses JSONB because each notification type may need different extra fields.
* All timestamps are stored in UTC using `TIMESTAMPTZ`.
* PostgreSQL is the permanent source of truth when configured.
* Memory fallback storage is used if a PostgreSQL database is not configured or reachable.
* Redis is used only for caching and performance improvement.

---

# Stage 3

## 1. Query Correctness & Analysis

The query currently proposed:
```sql
SELECT *
FROM notifications
WHERE studentID = 1042
AND isRead = false
ORDER BY createdAt ASC;
```

This query is **incorrect** and will fail to execute under the Stage 2 schema design for several reasons:

1. **Schema Column Mismatch**: The `notifications` table does not contain `student_id` (or `studentID`) and `is_read` (or `isRead`) columns. 
2. **Normalized Architecture Mismatch**: To prevent storage bloat and write amplification, notifications are stored once and targeted dynamically via `audience_scope`, `audience_department`, and `audience_year`. Read status is stored in a separate join table `notification_read_status` when a student reads a notification. A notification is considered unread if no corresponding record exists in the join table.
3. **Naming Conventions**: Stage 2 schema uses standard relational `snake_case` (e.g., `created_at`, `student_id`, `is_active`) rather than the `camelCase` column names used in the proposed query.

---

## 2. Scalability Problems at Scale

With **50,000 students** and **5,000,000 notifications**, the proposed query exhibits severe performance bottlenecks:

### Full Table Scans (Seq Scan)
Without indexes on columns used in the `WHERE` clause, the database engine must execute a sequential scan over all 5,000,000 rows. Every page on disk must be read into memory, leading to extremely high disk I/O and CPU usage, causing a simple lookup to take seconds.

### Sorting Cost
Sorting 5,000,000 records (or any large subset of them) by `created_at` requires high CPU overhead. If the sort dataset exceeds the database's configured working memory (`work_mem`), the database will spill the sort operation to disk (external merge sort), which is orders of magnitude slower than in-memory sorting.

### Select *
Retrieving all columns (`SELECT *`) is a major anti-pattern in high-throughput applications. It pulls large text fields (`message`) and heavy JSONB structures (`metadata`) off the disk. This increases memory consumption, occupies larger chunks of the database buffer cache, and balloons network transmission overhead between the database and application server. It also prevents the query planner from using efficient **Index-Only Scans**.

### Missing Indexes
A complete lack of indexes forces the database to evaluate query conditions line-by-line. The database cannot seek directly to matching blocks, making the query execution time grow linearly ($O(N)$) with the number of notifications.

---

## 3. Indexing Strategy & Tradeoffs

### Is indexing every column a good idea?
**No.** Creating indexes on every column is a bad design practice for production systems:
* **Write Overhead**: Every `INSERT`, `UPDATE`, or `DELETE` operation must also write updates to all affected indexes. This increases write latency and decreases API throughput.
* **Storage Bloat**: Indexes consume substantial disk space and RAM. If index sizes exceed the database's available buffer cache (`shared_buffers`), the database must swap index pages in and out of disk, degrading overall system performance.
* **Planner Suboptimization**: Having too many indexes can cause the query optimizer to choose inefficient query plans.

### Tradeoffs of Excessive Indexing
* **Read vs. Write Performance**: Heavy indexing speeds up read queries but slows down write operations. For a system with high-frequency notification generation or massive read-status updates, excessive indexing will choke the write pipeline.
* **Disk I/O and Cache Eviction**: Large indexes compete with active data tables for space in system RAM.

### Recommended Indexing Strategy for Stage 2 Schema
1. **Unique Index on Read Status**:
   ```sql
   CREATE UNIQUE INDEX idx_notification_read_status_student_notification
   ON notification_read_status (student_id, notification_id);
   ```
   *Reasoning*: Enforces one read record per student per notification and makes join operations for unread checks extremely fast.
2. **Foreign Key Indexes**:
   ```sql
   CREATE INDEX idx_notification_read_status_student ON notification_read_status (student_id);
   CREATE INDEX idx_notification_read_status_notification ON notification_read_status (notification_id);
   ```
   *Reasoning*: Accelerates cascading deletes and index-joins from either direction.
3. **Targeting & Pagination Composite Index**:
   ```sql
   CREATE INDEX idx_notifications_type_published_active
   ON notifications (type, published_at DESC)
   WHERE deleted_at IS NULL;
   ```
   *Reasoning*: Uses a partial index to skip soft-deleted notifications, and indexes type and published timestamp together to allow fast filtered retrievals without an explicit sort step.

---

## 4. Optimized Queries

### 4.1. Fetching Unread Notifications for a Student
To find all active, unexpired, and unread notifications targeted to a specific student (e.g., student ID `stu_1042`, department `CSE`, year `4`), we use a `LEFT JOIN` and filter where the read status record is `NULL`:

```sql
SELECT 
    n.id, 
    n.type, 
    n.title, 
    n.priority, 
    n.published_at,
    n.metadata
FROM notifications n
LEFT JOIN notification_read_status rs
    ON rs.notification_id = n.id
   AND rs.student_id = $1 -- 'stu_1042'
WHERE rs.id IS NULL
  AND n.deleted_at IS NULL
  AND (n.expires_at IS NULL OR n.expires_at > NOW())
  AND (
      n.audience_scope = 'ALL_STUDENTS'
      OR (
          n.audience_scope = 'DEPARTMENT'
          AND n.audience_department = $2 -- 'CSE'
          AND (n.audience_year IS NULL OR n.audience_year = $3) -- 4
      )
  )
ORDER BY n.published_at ASC;
```

#### Expected Performance Improvements:
* **Nested Loop Join / Hash Anti-Join**: The optimizer joins `notifications` with `notification_read_status` using the unique index.
* **No Table Scan**: The engine filters out read notifications instantly using index lookups.
* **Zero Sorting Cost**: If the index is built on `published_at ASC`, the database retrieves the rows in pre-sorted order, avoiding CPU sort overhead entirely.
* **Reduced I/O**: Selecting only required fields prevents fetching the full `message` body or unnecessary columns.

### 4.2. Students Receiving a Placement Notification in the Last 7 Days
To identify all active students targeted by a `PLACEMENT` notification published during the last 7 days:

```sql
SELECT DISTINCT 
    s.id, 
    s.roll_number, 
    s.full_name, 
    s.email
FROM students s
JOIN notifications n
    ON n.type = 'PLACEMENT'
   AND n.published_at >= NOW() - INTERVAL '7 days'
   AND n.deleted_at IS NULL
   AND (
       n.audience_scope = 'ALL_STUDENTS'
       OR (
           n.audience_scope = 'DEPARTMENT'
           AND n.audience_department = s.department
           AND (n.audience_year IS NULL OR n.audience_year = s.academic_year)
       )
   )
WHERE s.is_active = TRUE;
```

#### Assumptions:
1. `students` table has columns `is_active` (boolean) to filter out suspended students, `department` (varchar), and `academic_year` (smallint) to match notification targets.
2. The `PLACEMENT` notification was published within the target range (`published_at >= NOW() - INTERVAL '7 days'`) and is not soft-deleted.

---

# Stage 4

## 1. Performance Bottlenecks & Architecture Review

At a scale of **1,000,000 students** and **5,000,000 notifications**, a naive relational architecture will fail. The primary bottlenecks are:
1. **Database Contention**: Querying the database on every home-screen load to calculate unread counts or list notifications leads to connection exhaustion and disk I/O bottlenecks.
2. **Synchronous Fan-out**: Processing SSE broadcasts or third-party mobile pushes directly in the HTTP request cycle blocks the web server.
3. **Offset Pagination Exhaustion**: Retrieving deep history pages forces the database to read and discard millions of rows.

---

## 2. Caching Strategy (Redis)

### What to Cache
1. **Unread Counts per Student**:
   * *Key*: `student:unread_count:{student_id}` (Data type: String)
   * *Justification*: This is the most frequently read endpoint (often hit on every page refresh or app launch). Retrieving a pre-calculated integer avoids executing a `LEFT JOIN` on `notification_read_status`.
2. **Recent Feed Caches**:
   * *Key*: `notifications:feed:{scope}:{scope_id}` (Data type: Sorted Set / ZSET)
   * *Score*: `published_at` (epoch timestamp)
   * *Value*: JSON string of the notification details.
   * *Justification*: Serves the top 20 notifications directly from memory.

### Cache Invalidation Strategy
To ensure consistency without overloading the database:
* **Write-Through / Eviction**:
  * When an admin creates a notification, push it into the appropriate Redis ZSETs (e.g., `notifications:feed:ALL_STUDENTS` or `notifications:feed:DEPARTMENT:CSE:4`). Trim the ZSET size to 100 items (`ZREMRANGEBYRANK`) to keep memory footprint low.
  * Increment the unread count for all target students. For `ALL_STUDENTS` scope, store a global sequence marker in Redis and compute individual student offsets lazily rather than performing 1,000,000 updates synchronously.
  * When a student reads a notification, invoke `DECR student:unread_count:{student_id}` and log the status in PostgreSQL.
* **Time-to-Live (TTL)**:
  * Apply a 1-day TTL to individual student unread count keys. If a key expires, rebuild it from the PostgreSQL database on the next read (lazy loading).

---

## 3. Pagination Design

### Returning All Notifications vs. Pagination
Returning the entire list of 5,000,000 notifications is impossible. It causes out-of-memory crashes on Node.js, saturates network bandwidth, and freezes the client browser.

### Page-Based vs. Cursor-Based Pagination

| Strategy | Pros | Cons | Scalability |
| --- | --- | --- | --- |
| **Page-Based** (`LIMIT 20 OFFSET X`) | Simple to implement, supports jumping to arbitrary page | Deep paging (`OFFSET 100000`) forces full index scan up to offset; inconsistent if records are added/deleted. | Poor ($O(N)$) |
| **Cursor-Based** (`WHERE id < $1 LIMIT 20`) | Constant-time database seeks; resilient to concurrent inserts/deletes | Cannot jump to arbitrary pages; requires sequential navigation | Excellent ($O(1)$) |

### Recommended Approach
Use **Cursor-Based Pagination** for the notification feed. The cursor is a composite value of `(published_at, id)`.
```sql
SELECT n.id, n.type, n.title, n.priority, n.published_at, n.metadata
FROM notifications n
WHERE (n.published_at, n.id) < ($1, $2) -- Cursor values
  AND n.deleted_at IS NULL
ORDER BY n.published_at DESC, n.id DESC
LIMIT 20;
```
This forces Postgres to perform an index-range scan on the composite index `(published_at, id)` and retrieve the next page instantly without skipping rows.

---

## 4. Real-Time Updates

### Technology Comparison

* **Polling (Short/Long)**: High write load on backend to handle empty requests. Waste of mobile battery and client data. Not scalable.
* **WebSockets**: Bi-directional, stateful connections. Requires custom ping/pong handling, complex load balancers, and high RAM usage per server.
* **Server-Sent Events (SSE)**: Unidirectional stream over standard HTTP. Supports auto-reconnection out of the box, respects HTTP/2 multiplexing, and operates on standard ports without WebSocket protocol handshakes.

### Recommendation
Use **Server-Sent Events (SSE)**. Since notifications are strictly one-way (server to client), WebSockets are over-engineered. SSE is simpler, native to browsers, and highly performant behind standard HTTP/2 reverse proxies.

---

## 5. Database Performance at Scale

### Indexing & Query Optimizations
* **Partial Indexes**: Index only active notifications:
  ```sql
  CREATE INDEX idx_notifications_feed_active
  ON notifications (published_at DESC)
  WHERE deleted_at IS NULL;
  ```
* **Avoid Select \***: Retrieve only the columns required by the UI. Keep text bodies and metadata payloads out of index lookups to enable **Index-Only Scans**.

### Read Replicas
Deploy **Read Replicas** to offload read traffic.
* **Primary DB**: Handles write operations (`POST /v1/notifications`, marking notifications as read).
* **Read Replicas**: Serve feed queries (`GET /v1/notifications`) and count lookups.
* *Latency Handling*: When a student marks a notification as read, write to the Primary DB, and update their local UI state or Redis cache immediately so replication lag does not create user confusion.

### Connection Pooling
Always use a connection pooler like **PgBouncer** in transaction mode. Node.js applications spawn asynchronous events; opening a separate PostgreSQL connection per request is expensive because Postgres forks a process per connection. PgBouncer keeps a pool of warm connections, reducing query overhead.

---

## 6. Asynchronous Notification Delivery

### Background Workers & Message Queues
Never process notification fan-outs or mobile push deliveries synchronously in the HTTP request thread.
* **Worker Pipeline**:
  1. Admin hits `POST /v1/notifications`.
  2. The server writes the notification metadata to the database.
  3. The server pushes a lightweight job (e.g., `{"notification_id": "ntf_992"}`) to a message queue (e.g., Redis-backed **BullMQ** or **RabbitMQ**) and returns `202 Accepted` to the admin.
  4. Background workers dequeue the job, identify target audience criteria, push events to SSE clients, and send push notifications (APNS/FCM) in parallel.

### Batch Processing
When writing notification delivery records or read status inserts, batch them:
```sql
INSERT INTO notification_read_status (id, student_id, notification_id)
VALUES 
    ('uuid1', 'stu_1', 'ntf_9'),
    ('uuid2', 'stu_2', 'ntf_9')
ON CONFLICT DO NOTHING;
```
Batching reduces transaction commit overhead in PostgreSQL.

---

## 7. Monitoring & Observability

1. **Application Logs**: Standardize on structured JSON logs containing `request_id`, `user_id`, and `duration_ms`.
2. **Slow Query Detection**: Configure `log_min_duration_statement = 100` in `postgresql.conf` to log all queries taking longer than 100ms. Set up weekly audits using `pg_stat_statements`.
3. **Metrics Collection**: Use Prometheus to track:
   * Active SSE connections (`sse_active_clients`)
   * Database connection pool saturation (`db_pool_utilization`)
   * Redis cache hit/miss ratio (`redis_cache_hit_rate`)
4. **Alerting Rules**: Trigger PagerDuty alerts on:
   * High API error rates (5xx > 1% over 5 mins)
   * Queue length backlogs (jobs waiting > 1 min)
   * Database CPU utilization exceeding 85%

---

## 8. Scaling Path: 10,000 to 1,000,000 Students

To scale the architecture 100x without refactoring the core codebase:
1. **Stateless App Nodes**: Run multiple stateless Node.js containers behind an Application Load Balancer. Use a **Redis Pub/Sub** backplane to synchronize SSE broadcasts across all nodes.
2. **PostgreSQL Declarative Partitioning**: Partition the `notification_read_status` table by range on the `created_at` timestamp (e.g., monthly partitions). Detaching and archiving data older than 6 months keeps active partition indexes small enough to fit completely in RAM.
3. **Distributed Caching**: Scale Redis using Redis Sentinel or a Cluster configuration to handle millions of unread count queries.
4. **Rate Limiting**: Add rate-limiting layers at the API Gateway level (e.g., Kong, AWS API Gateway) using token bucket algorithms to prevent API abuse during result publication spikes.
