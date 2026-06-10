# 2315000174

Campus Notification System backend API for managing student notifications related to placements, events, and results.

## Project Structure

```text
AffordM/
├─ backend/
│  └─ server.js
├─ package.json
├─ package-lock.json
└─ README.md
```

## Run Locally

Installing dependencies:
```bash
npm install
```

Running the server (production mode):
```bash
npm start
```

Running the server in development mode (hot reload):
```bash
npm run dev
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
