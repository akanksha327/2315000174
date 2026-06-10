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
