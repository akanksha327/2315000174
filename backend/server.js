import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import crypto from "node:crypto";
import pg from "pg";

const { Pool } = pg;

const app = express();
const port = Number(process.env.PORT ?? 3000);

const VALID_TYPES = new Set(["PLACEMENT", "EVENT", "RESULT"]);
const VALID_PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);
const ADMIN_ROLES = new Set([
  "ADMIN",
  "FACULTY",
  "PLACEMENT_OFFICER",
  "EVENT_COORDINATOR",
  "EXAM_CONTROLLER",
  "SYSTEM",
]);

const defaultStudents = [
  {
    id: "stu_1001",
    rollNumber: "1001",
    fullName: "Student One",
    email: "student.one@campus.example.com",
    role: "STUDENT",
    department: "CSE",
    year: 4,
  },
  {
    id: "stu_1002",
    rollNumber: "1002",
    fullName: "Student Two",
    email: "student.two@campus.example.com",
    role: "STUDENT",
    department: "ECE",
    year: 3,
  },
];

const students = new Map(defaultStudents.map((student) => [student.id, student]));
const readState = new Map();
const sseClients = new Map();
const idempotencyStore = new Map();

let pool = null;
let postgresEnabled = false;

let notifications = [
  {
    id: "ntf_01JZ8X4G9T6Q2P7V5M1A3B8C9D",
    type: "PLACEMENT",
    title: "Placement drive: Acme Technologies",
    message:
      "Acme Technologies is conducting a placement drive for final-year CSE students.",
    priority: "HIGH",
    audience: {
      scope: "DEPARTMENT",
      department: "CSE",
      year: 4,
    },
    metadata: {
      companyName: "Acme Technologies",
      applicationDeadline: "2026-06-20T18:00:00Z",
    },
    createdBy: {
      id: "usr_admin_102",
      role: "PLACEMENT_OFFICER",
    },
    createdAt: "2026-06-10T09:00:00Z",
    updatedAt: "2026-06-10T09:00:00Z",
    publishedAt: "2026-06-10T09:05:00Z",
    expiresAt: "2026-06-20T18:00:00Z",
    deletedAt: null,
  },
  {
    id: "ntf_01JZ8Y6NX7D8Q3XQVJQ9TYX2WM",
    type: "EVENT",
    title: "Technical symposium registration opens",
    message: "Registrations are open for the annual technical symposium.",
    priority: "NORMAL",
    audience: {
      scope: "ALL_STUDENTS",
    },
    metadata: {
      eventId: "evt_2026_041",
      eventDate: "2026-06-25T09:30:00Z",
      venue: "Main Auditorium",
    },
    createdBy: {
      id: "usr_admin_204",
      role: "EVENT_COORDINATOR",
    },
    createdAt: "2026-06-10T10:58:00Z",
    updatedAt: "2026-06-10T10:58:00Z",
    publishedAt: "2026-06-10T11:00:00Z",
    expiresAt: "2026-06-25T09:30:00Z",
    deletedAt: null,
  },
  {
    id: "ntf_01JZ8Z7Q5TJ6MY3S1Z6H82BG6F",
    type: "RESULT",
    title: "Semester result published",
    message: "Semester examination results are now available in the portal.",
    priority: "HIGH",
    audience: {
      scope: "DEPARTMENT",
      department: "ECE",
      year: 3,
    },
    metadata: {
      examSession: "APRIL_2026",
    },
    createdBy: {
      id: "usr_admin_301",
      role: "EXAM_CONTROLLER",
    },
    createdAt: "2026-06-09T15:30:00Z",
    updatedAt: "2026-06-09T15:30:00Z",
    publishedAt: "2026-06-09T15:45:00Z",
    expiresAt: null,
    deletedAt: null,
  },
];

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.use((req, res, next) => {
  req.requestId = req.header("X-Request-Id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

// Structured JSON request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: duration,
      userAgent: req.get("user-agent"),
      ip: req.ip,
      user: req.user ? { id: req.user.id, role: req.user.role } : null,
    }));
  });
  next();
});

app.use(
  asyncHandler(async (req, res, next) => {
    const authHeader = req.header("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(req, res, 401, "UNAUTHORIZED", "Missing bearer token.");
    }

    const userId = req.header("X-User-Id") || "stu_1001";
    const knownStudent = students.get(userId);
    const role = req.header("X-User-Role") || knownStudent?.role || "STUDENT";

    req.user = {
      id: userId,
      role,
      department: req.header("X-Department") || knownStudent?.department,
      year: Number(req.header("X-Year") || knownStudent?.year),
    };

    await ensureStudent(req.user);
    next();
  }),
);

app.get("/v1/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      database: postgresEnabled ? "postgresql" : "memory",
      timestamp: new Date().toISOString(),
    },
  });
});

app.get(
  "/v1/notifications",
  asyncHandler(async (req, res) => {
    const { page, limit, type, isRead, sort, cursor } = parseListQuery(req);
    const validationError = validateListQuery({ page, limit, type, isRead, sort, cursor });

    if (validationError) {
      return sendValidationError(req, res, validationError);
    }

    const result = postgresEnabled
      ? await listNotificationsFromPostgres({ user: req.user, page, limit, type, isRead, sort, cursor })
      : listNotificationsFromMemory({ user: req.user, page, limit, type, isRead, sort, cursor });

    res.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  }),
);

app.get("/v1/notifications/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const clientId = crypto.randomUUID();
  sseClients.set(clientId, {
    user: req.user,
    res,
  });

  res.write("event: connected\n");
  res.write(`data: {"clientId":"${clientId}"}\n\n`);

  req.on("close", () => {
    sseClients.delete(clientId);
  });
});

app.get(
  "/v1/notifications/:notificationId",
  asyncHandler(async (req, res) => {
    const notification = postgresEnabled
      ? await findNotificationInPostgres(req.params.notificationId, req.user)
      : findVisibleNotificationInMemory(req.params.notificationId, req.user);

    if (!notification) {
      return sendError(
        req,
        res,
        404,
        "NOT_FOUND",
        "Notification does not exist or is not visible to the user.",
      );
    }

    res.json({
      success: true,
      data: notification,
    });
  }),
);

app.patch(
  "/v1/notifications/:notificationId/read",
  asyncHandler(async (req, res) => {
    const notification = postgresEnabled
      ? await findNotificationInPostgres(req.params.notificationId, req.user)
      : findVisibleNotificationInMemory(req.params.notificationId, req.user);

    if (!notification) {
      return sendError(
        req,
        res,
        404,
        "NOT_FOUND",
        "Notification does not exist or is not visible to the user.",
      );
    }

    const readAt = req.body?.readAt || new Date().toISOString();

    if (postgresEnabled) {
      await markNotificationReadInPostgres(req.user.id, notification.id, readAt);
    } else {
      setReadAt(req.user.id, notification.id, readAt);
    }

    res.json({
      success: true,
      data: {
        id: notification.id,
        isRead: true,
        readAt,
      },
    });
  }),
);

app.patch(
  "/v1/notifications/read-all",
  asyncHandler(async (req, res) => {
    const type = req.body?.type;

    if (type && !VALID_TYPES.has(type)) {
      return sendValidationError(req, res, [
        {
          field: "type",
          message: "type must be one of PLACEMENT, EVENT, RESULT",
        },
      ]);
    }

    const result = postgresEnabled
      ? await markAllNotificationsReadInPostgres(req.user, type)
      : markAllNotificationsReadInMemory(req.user, type);

    res.json({
      success: true,
      data: result,
    });
  }),
);

app.post(
  "/v1/notifications",
  asyncHandler(async (req, res) => {
    if (!ADMIN_ROLES.has(req.user.role)) {
      return sendError(
        req,
        res,
        403,
        "FORBIDDEN",
        "Only authorized admin users can create notifications.",
      );
    }

    const idempotencyKey = req.header("Idempotency-Key");

    if (!idempotencyKey) {
      return sendValidationError(req, res, [
        {
          field: "Idempotency-Key",
          message: "Idempotency-Key header is required for notification creation",
        },
      ]);
    }

    if (idempotencyStore.has(idempotencyKey)) {
      const existingNotificationId = idempotencyStore.get(idempotencyKey);
      const existingNotification = postgresEnabled
        ? await findNotificationInPostgres(existingNotificationId, req.user)
        : findNotificationByIdInMemory(existingNotificationId, req.user.id);

      if (existingNotification) {
        return res.status(200).json({
          success: true,
          data: existingNotification,
        });
      }
    }

    const validationErrors = validateNotificationBody(req.body);

    if (validationErrors.length > 0) {
      return sendValidationError(req, res, validationErrors);
    }

    const notification = buildNotification(req.body, req.user);
    const savedNotification = postgresEnabled
      ? await createNotificationInPostgres(notification, req.user.id)
      : createNotificationInMemory(notification, req.user.id);

    idempotencyStore.set(idempotencyKey, savedNotification.id);
    broadcastNotification(notification);

    res.status(201).json({
      success: true,
      data: savedNotification,
    });
  }),
);

app.delete(
  "/v1/notifications/:notificationId",
  asyncHandler(async (req, res) => {
    if (!ADMIN_ROLES.has(req.user.role)) {
      return sendError(
        req,
        res,
        403,
        "FORBIDDEN",
        "Only authorized admin users can delete notifications.",
      );
    }

    const result = postgresEnabled
      ? await deleteNotificationInPostgres(req.params.notificationId)
      : deleteNotificationInMemory(req.params.notificationId);

    if (!result) {
      return sendError(req, res, 404, "NOT_FOUND", "Notification not found.");
    }

    res.json({
      success: true,
      data: result,
    });
  }),
);

app.use((req, res) => {
  sendError(req, res, 404, "NOT_FOUND", "Endpoint not found.");
});

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && "body" in err) {
    return sendError(req, res, 400, "VALIDATION_ERROR", "Invalid JSON body.");
  }

  console.error(err);
  sendError(
    req,
    res,
    500,
    "INTERNAL_SERVER_ERROR",
    "Unexpected server error.",
  );
});

await initializePostgres();

app.listen(port, () => {
  console.log(`Campus Notification API listening on http://localhost:${port}`);
});

async function initializePostgres() {
  if (!process.env.DATABASE_URL) {
    return;
  }

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await pool.query("SELECT 1");
    await pool.query(schemaSql);
    await seedPostgres();
    postgresEnabled = true;
    console.log("PostgreSQL persistence enabled.");
  } catch (error) {
    postgresEnabled = false;
    await pool.end().catch(() => {});
    pool = null;
    console.warn("PostgreSQL is unavailable. Falling back to in-memory storage.");
    console.warn(error.message);
  }
}

async function seedPostgres() {
  for (const student of defaultStudents) {
    await pool.query(
      `
        INSERT INTO students (
          id, roll_number, full_name, email, department, academic_year, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, TRUE)
        ON CONFLICT (id) DO NOTHING
      `,
      [
        student.id,
        student.rollNumber,
        student.fullName,
        student.email,
        student.department,
        student.year,
      ],
    );
  }

  for (const notification of notifications) {
    await pool.query(
      `
        INSERT INTO notifications (
          id, type, title, message, priority, audience_scope, audience_department,
          audience_year, metadata, created_by_id, created_by_role, created_at,
          updated_at, published_at, expires_at, deleted_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16
        )
        ON CONFLICT (id) DO NOTHING
      `,
      notificationToParams(notification),
    );
  }
}

async function ensureStudent(user) {
  if (!postgresEnabled || ADMIN_ROLES.has(user.role)) {
    return;
  }

  const fallbackStudent = students.get(user.id);

  await pool.query(
    `
      INSERT INTO students (
        id, roll_number, full_name, email, department, academic_year, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      ON CONFLICT (id) DO UPDATE
      SET department = EXCLUDED.department,
          academic_year = EXCLUDED.academic_year,
          updated_at = NOW()
    `,
    [
      user.id,
      fallbackStudent?.rollNumber || user.id,
      fallbackStudent?.fullName || user.id,
      fallbackStudent?.email || `${user.id}@campus.example.com`,
      user.department || fallbackStudent?.department || "UNKNOWN",
      Number.isFinite(user.year) ? user.year : fallbackStudent?.year || 1,
    ],
  );
}

function parseListQuery(req) {
  return {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    type: req.query.type,
    isRead: req.query.isRead,
    sort: req.query.sort ?? "-createdAt",
    cursor: req.query.cursor,
  };
}

function validateListQuery({ page, limit, type, isRead, sort, cursor }) {
  if (type && !VALID_TYPES.has(type)) {
    return [
      {
        field: "type",
        message: "type must be one of PLACEMENT, EVENT, RESULT",
      },
    ];
  }

  if (isRead !== undefined && !["true", "false"].includes(isRead)) {
    return [
      {
        field: "isRead",
        message: "isRead must be true or false",
      },
    ];
  }

  if (!["createdAt", "-createdAt", "publishedAt", "-publishedAt"].includes(sort)) {
    return [
      {
        field: "sort",
        message: "sort must be one of createdAt, -createdAt, publishedAt, -publishedAt",
      },
    ];
  }

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return [
      {
        field: "pagination",
        message: "page must be at least 1 and limit must be between 1 and 100",
      },
    ];
  }

  return null;
}

function validateNotificationBody(body) {
  const errors = [];

  if (!body || typeof body !== "object") {
    return [
      {
        field: "body",
        message: "Request body is required",
      },
    ];
  }

  if (!VALID_TYPES.has(body.type)) {
    errors.push({
      field: "type",
      message: "type must be one of PLACEMENT, EVENT, RESULT",
    });
  }

  if (!body.title || typeof body.title !== "string") {
    errors.push({
      field: "title",
      message: "title is required",
    });
  }

  if (!body.message || typeof body.message !== "string") {
    errors.push({
      field: "message",
      message: "message is required",
    });
  }

  if (body.priority && !VALID_PRIORITIES.has(body.priority)) {
    errors.push({
      field: "priority",
      message: "priority must be one of LOW, NORMAL, HIGH, URGENT",
    });
  }

  if (!body.audience || typeof body.audience !== "object") {
    errors.push({
      field: "audience",
      message: "audience is required",
    });
  }

  if (
    body.audience?.scope &&
    !["ALL_STUDENTS", "DEPARTMENT"].includes(body.audience.scope)
  ) {
    errors.push({
      field: "audience.scope",
      message: "audience.scope must be ALL_STUDENTS or DEPARTMENT",
    });
  }

  if (
    body.audience?.scope === "DEPARTMENT" &&
    typeof body.audience.department !== "string"
  ) {
    errors.push({
      field: "audience.department",
      message: "audience.department is required for department notifications",
    });
  }

  return errors;
}

async function listNotificationsFromPostgres({ user, page, limit, type, isRead, sort, cursor }) {
  const whereParts = ["n.deleted_at IS NULL", "(n.expires_at IS NULL OR n.expires_at > NOW())"];
  const values = [];
  let paramIndex = 1;

  const join = `
    LEFT JOIN notification_read_status rs
      ON rs.notification_id = n.id
     AND rs.student_id = $${paramIndex}
  `;
  values.push(user.id);
  paramIndex += 1;

  if (!ADMIN_ROLES.has(user.role)) {
    whereParts.push(
      `(
        n.audience_scope = 'ALL_STUDENTS'
        OR (
          n.audience_scope = 'DEPARTMENT'
          AND n.audience_department = $${paramIndex}
          AND (n.audience_year IS NULL OR n.audience_year = $${paramIndex + 1})
        )
      )`,
    );
    values.push(user.department, user.year);
    paramIndex += 2;
  }

  if (type) {
    whereParts.push(`n.type = $${paramIndex}`);
    values.push(type);
    paramIndex += 1;
  }

  if (isRead === "true") {
    whereParts.push("rs.id IS NOT NULL");
  }

  if (isRead === "false") {
    whereParts.push("rs.id IS NULL");
  }

  let cursorData = null;
  if (cursor) {
    try {
      cursorData = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch (e) {
      // ignore invalid cursor
    }
  }

  if (cursorData && Array.isArray(cursorData) && cursorData.length === 2) {
    const [cursorSortVal, cursorId] = cursorData;
    const direction = sort.startsWith("-") ? -1 : 1;
    const operator = direction === -1 ? "<" : ">";
    const sortField = sort.replace("-", "") === "publishedAt" ? "n.published_at" : "n.created_at";

    whereParts.push(
      `(${sortField} ${operator} $${paramIndex} OR (${sortField} = $${paramIndex} AND n.id ${operator} $${paramIndex + 1}))`
    );
    values.push(cursorSortVal, cursorId);
    paramIndex += 2;
  }

  const whereSql = whereParts.join(" AND ");
  const countResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total
      FROM notifications n
      ${join}
      WHERE ${whereSql}
    `,
    values,
  );

  const totalItems = countResult.rows[0].total;
  const totalPages = Math.ceil(totalItems / limit);
  const orderBy = sortToSql(sort);

  const limitValue = limit;
  const offsetValue = cursorData ? 0 : (page - 1) * limit;

  const rowsResult = await pool.query(
    `
      SELECT n.*, rs.read_at
      FROM notifications n
      ${join}
      WHERE ${whereSql}
      ORDER BY ${orderBy}, n.id ${sort.startsWith("-") ? "DESC" : "ASC"}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `,
    [...values, limitValue, offsetValue],
  );

  const data = rowsResult.rows.map(rowToNotification);

  let nextCursor = null;
  const hasNextPage = cursorData ? (data.length === limit) : (page < totalPages);

  if (data.length > 0 && hasNextPage) {
    const lastItem = rowsResult.rows[rowsResult.rows.length - 1];
    const sortFieldName = sort.replace("-", "") === "publishedAt" ? "published_at" : "created_at";
    const rawVal = lastItem[sortFieldName];
    const sortVal = rawVal instanceof Date ? rawVal.toISOString() : rawVal;

    nextCursor = Buffer.from(JSON.stringify([sortVal, lastItem.id])).toString("base64");
  }

  return {
    data,
    pagination: {
      page: cursorData ? null : page,
      limit,
      totalItems,
      totalPages: cursorData ? null : totalPages,
      hasNextPage,
      hasPreviousPage: cursorData ? (cursor !== undefined) : (page > 1),
      nextCursor,
    },
  };
}

function listNotificationsFromMemory({ user, page, limit, type, isRead, sort, cursor }) {
  let visibleNotifications = notifications
    .filter((notification) => isVisibleToUser(notification, user))
    .map((notification) => serializeNotification(notification, user.id))
    .filter((notification) => !type || notification.type === type)
    .filter(
      (notification) =>
        isRead === undefined || notification.isRead === (isRead === "true"),
    )
    .sort((a, b) => compareNotifications(a, b, sort));

  let cursorData = null;
  if (cursor) {
    try {
      cursorData = JSON.parse(Buffer.from(cursor, "base64").toString("utf8"));
    } catch (e) {
      // ignore
    }
  }

  if (cursorData && Array.isArray(cursorData) && cursorData.length === 2) {
    const [cursorSortVal, cursorId] = cursorData;
    const direction = sort.startsWith("-") ? -1 : 1;
    const sortField = sort.replace("-", "");

    visibleNotifications = visibleNotifications.filter((item) => {
      const itemVal = item[sortField];
      const comp = itemVal.localeCompare(cursorSortVal);
      if (comp !== 0) {
        return direction === -1 ? comp < 0 : comp > 0;
      }
      const idComp = item.id.localeCompare(cursorId);
      return direction === -1 ? idComp < 0 : idComp > 0;
    });
  }

  const totalItems = visibleNotifications.length;
  const totalPages = Math.ceil(totalItems / limit);
  const start = cursorData ? 0 : (page - 1) * limit;
  const sliceData = visibleNotifications.slice(start, start + limit);

  let nextCursor = null;
  const hasNextPage = cursorData ? (visibleNotifications.length > limit) : (page < totalPages);

  if (sliceData.length > 0 && hasNextPage) {
    const lastItem = sliceData[sliceData.length - 1];
    const sortField = sort.replace("-", "");
    const sortVal = lastItem[sortField];
    nextCursor = Buffer.from(JSON.stringify([sortVal, lastItem.id])).toString("base64");
  }

  return {
    data: sliceData,
    pagination: {
      page: cursorData ? null : page,
      limit,
      totalItems,
      totalPages: cursorData ? null : totalPages,
      hasNextPage,
      hasPreviousPage: cursorData ? (cursor !== undefined) : (page > 1),
      nextCursor,
    },
  };
}

async function findNotificationInPostgres(notificationId, user) {
  const values = [user.id, notificationId];
  let paramIndex = 3;
  const whereParts = [
    "n.id = $2",
    "n.deleted_at IS NULL",
    "(n.expires_at IS NULL OR n.expires_at > NOW())",
  ];

  if (!ADMIN_ROLES.has(user.role)) {
    whereParts.push(
      `(
        n.audience_scope = 'ALL_STUDENTS'
        OR (
          n.audience_scope = 'DEPARTMENT'
          AND n.audience_department = $${paramIndex}
          AND (n.audience_year IS NULL OR n.audience_year = $${paramIndex + 1})
        )
      )`,
    );
    values.push(user.department, user.year);
  }

  const result = await pool.query(
    `
      SELECT n.*, rs.read_at
      FROM notifications n
      LEFT JOIN notification_read_status rs
        ON rs.notification_id = n.id
       AND rs.student_id = $1
      WHERE ${whereParts.join(" AND ")}
      LIMIT 1
    `,
    values,
  );

  return result.rows[0] ? rowToNotification(result.rows[0]) : null;
}

async function createNotificationInPostgres(notification, userId) {
  const result = await pool.query(
    `
      INSERT INTO notifications (
        id, type, title, message, priority, audience_scope, audience_department,
        audience_year, metadata, created_by_id, created_by_role, created_at,
        updated_at, published_at, expires_at, deleted_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `,
    notificationToParams(notification),
  );

  return rowToNotification({ ...result.rows[0], read_at: null }, userId);
}

function createNotificationInMemory(notification, userId) {
  notifications = [notification, ...notifications];
  return serializeNotification(notification, userId);
}

async function markNotificationReadInPostgres(studentId, notificationId, readAt) {
  await pool.query(
    `
      INSERT INTO notification_read_status (id, student_id, notification_id, read_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (student_id, notification_id)
      DO UPDATE SET read_at = EXCLUDED.read_at
    `,
    [crypto.randomUUID(), studentId, notificationId, readAt],
  );
}

async function markAllNotificationsReadInPostgres(user, type) {
  const readAt = new Date().toISOString();
  const values = [user.id, readAt];
  let paramIndex = 3;
  const whereParts = ["n.deleted_at IS NULL", "(n.expires_at IS NULL OR n.expires_at > NOW())"];

  if (!ADMIN_ROLES.has(user.role)) {
    whereParts.push(
      `(
        n.audience_scope = 'ALL_STUDENTS'
        OR (
          n.audience_scope = 'DEPARTMENT'
          AND n.audience_department = $${paramIndex}
          AND (n.audience_year IS NULL OR n.audience_year = $${paramIndex + 1})
        )
      )`,
    );
    values.push(user.department, user.year);
    paramIndex += 2;
  }

  if (type) {
    whereParts.push(`n.type = $${paramIndex}`);
    values.push(type);
  }

  const result = await pool.query(
    `
      INSERT INTO notification_read_status (id, student_id, notification_id, read_at)
      SELECT gen_random_uuid()::text, $1, n.id, $2
      FROM notifications n
      WHERE ${whereParts.join(" AND ")}
        AND NOT EXISTS (
          SELECT 1
          FROM notification_read_status rs
          WHERE rs.student_id = $1
            AND rs.notification_id = n.id
        )
      RETURNING id
    `,
    values,
  );

  return {
    markedReadCount: result.rowCount,
    readAt,
  };
}

function markAllNotificationsReadInMemory(user, type) {
  const readAt = new Date().toISOString();
  let markedReadCount = 0;

  for (const notification of notifications) {
    if (!isVisibleToUser(notification, user)) {
      continue;
    }

    if (type && notification.type !== type) {
      continue;
    }

    if (!getReadAt(user.id, notification.id)) {
      setReadAt(user.id, notification.id, readAt);
      markedReadCount += 1;
    }
  }

  return {
    markedReadCount,
    readAt,
  };
}

async function deleteNotificationInPostgres(notificationId) {
  const result = await pool.query(
    `
      UPDATE notifications
      SET deleted_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, deleted_at
    `,
    [notificationId],
  );

  if (!result.rows[0]) {
    return null;
  }

  return {
    id: result.rows[0].id,
    deleted: true,
    deletedAt: result.rows[0].deleted_at.toISOString(),
  };
}

function deleteNotificationInMemory(notificationId) {
  const notification = notifications.find(
    (item) => item.id === notificationId && !item.deletedAt,
  );

  if (!notification) {
    return null;
  }

  notification.deletedAt = new Date().toISOString();
  notification.updatedAt = notification.deletedAt;

  return {
    id: notification.id,
    deleted: true,
    deletedAt: notification.deletedAt,
  };
}

function buildNotification(body, user) {
  const now = new Date().toISOString();

  return {
    id: `ntf_${crypto.randomUUID().replaceAll("-", "").slice(0, 26).toUpperCase()}`,
    type: body.type,
    title: body.title,
    message: body.message,
    priority: body.priority ?? "NORMAL",
    audience: body.audience,
    metadata: body.metadata ?? {},
    createdBy: {
      id: user.id,
      role: user.role,
    },
    createdAt: now,
    updatedAt: now,
    publishedAt: body.publishedAt ?? now,
    expiresAt: body.expiresAt ?? null,
    deletedAt: null,
  };
}

function notificationToParams(notification) {
  return [
    notification.id,
    notification.type,
    notification.title,
    notification.message,
    notification.priority,
    notification.audience.scope,
    notification.audience.department ?? null,
    notification.audience.year ?? null,
    JSON.stringify(notification.metadata ?? {}),
    notification.createdBy.id,
    notification.createdBy.role,
    notification.createdAt,
    notification.updatedAt,
    notification.publishedAt,
    notification.expiresAt,
    notification.deletedAt,
  ];
}

function rowToNotification(row) {
  const readAt = row.read_at?.toISOString?.() ?? row.read_at ?? null;

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    priority: row.priority,
    audience: {
      scope: row.audience_scope,
      ...(row.audience_department ? { department: row.audience_department } : {}),
      ...(row.audience_year ? { year: row.audience_year } : {}),
    },
    metadata: row.metadata ?? {},
    createdBy: {
      id: row.created_by_id,
      role: row.created_by_role,
    },
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
    publishedAt: row.published_at?.toISOString?.() ?? row.published_at,
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at ?? null,
    readAt,
    isRead: Boolean(readAt),
    links: {
      self: `/v1/notifications/${row.id}`,
    },
  };
}

function isVisibleToUser(notification, user) {
  if (notification.deletedAt) {
    return false;
  }

  if (notification.expiresAt && notification.expiresAt < new Date().toISOString()) {
    return false;
  }

  if (ADMIN_ROLES.has(user.role)) {
    return true;
  }

  if (notification.audience.scope === "ALL_STUDENTS") {
    return true;
  }

  if (notification.audience.scope === "DEPARTMENT") {
    return (
      notification.audience.department === user.department &&
      (!notification.audience.year || notification.audience.year === user.year)
    );
  }

  return false;
}

function findVisibleNotificationInMemory(notificationId, user) {
  const notification = notifications.find(
    (item) => item.id === notificationId && isVisibleToUser(item, user),
  );

  return notification ? serializeNotification(notification, user.id) : null;
}

function findNotificationByIdInMemory(notificationId, userId) {
  const notification = notifications.find((item) => item.id === notificationId);
  return notification ? serializeNotification(notification, userId) : null;
}

function serializeNotification(notification, userId) {
  const readAt = getReadAt(userId, notification.id);

  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    priority: notification.priority,
    audience: notification.audience,
    metadata: notification.metadata,
    createdBy: notification.createdBy,
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    publishedAt: notification.publishedAt,
    expiresAt: notification.expiresAt,
    readAt,
    isRead: Boolean(readAt),
    links: {
      self: `/v1/notifications/${notification.id}`,
    },
  };
}

function getReadAt(userId, notificationId) {
  return readState.get(`${userId}:${notificationId}`) ?? null;
}

function setReadAt(userId, notificationId, readAt) {
  readState.set(`${userId}:${notificationId}`, readAt);
}

function compareNotifications(a, b, sort) {
  const direction = sort.startsWith("-") ? -1 : 1;
  const field = sort.replace("-", "");
  const left = a[field] ?? "";
  const right = b[field] ?? "";
  const result = left.localeCompare(right);

  if (result === 0) {
    return b.id.localeCompare(a.id);
  }

  return result * direction;
}

function sortToSql(sort) {
  const sortMap = {
    createdAt: "n.created_at ASC",
    "-createdAt": "n.created_at DESC",
    publishedAt: "n.published_at ASC",
    "-publishedAt": "n.published_at DESC",
  };

  return sortMap[sort];
}

function broadcastNotification(notification) {
  for (const { user, res } of sseClients.values()) {
    if (!isVisibleToUser(notification, user)) {
      continue;
    }

    res.write("event: notification.created\n");
    res.write(`id: ${notification.id}\n`);
    res.write(`data: ${JSON.stringify(serializeNotification(notification, user.id))}\n\n`);
  }
}

function sendValidationError(req, res, details) {
  return sendError(
    req,
    res,
    400,
    "VALIDATION_ERROR",
    "One or more request parameters are invalid.",
    details,
  );
}

function sendError(req, res, status, code, message, details = []) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details,
      requestId: req.requestId,
    },
  });
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS students (
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

CREATE TABLE IF NOT EXISTS notifications (
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
  CHECK (audience_scope <> 'DEPARTMENT' OR audience_department IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS notification_read_status (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_students_department_year
ON students (department, academic_year);

CREATE INDEX IF NOT EXISTS idx_students_active
ON students (is_active);

CREATE INDEX IF NOT EXISTS idx_notifications_type
ON notifications (type);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_published_at
ON notifications (published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_type_published_active
ON notifications (type, published_at DESC)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notification_read_status_student
ON notification_read_status (student_id);

CREATE INDEX IF NOT EXISTS idx_notification_read_status_notification
ON notification_read_status (notification_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_read_status_student_notification
ON notification_read_status (student_id, notification_id);
`;
