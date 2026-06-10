import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import crypto from "node:crypto";

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

const students = new Map([
  [
    "stu_1001",
    {
      id: "stu_1001",
      role: "STUDENT",
      department: "CSE",
      year: 4,
    },
  ],
  [
    "stu_1002",
    {
      id: "stu_1002",
      role: "STUDENT",
      department: "ECE",
      year: 3,
    },
  ],
]);

const readState = new Map();
const sseClients = new Map();
const idempotencyStore = new Map();

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
app.use(morgan("dev"));

app.use((req, res, next) => {
  req.requestId = req.header("X-Request-Id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

app.use((req, res, next) => {
  const authHeader = req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(req, res, 401, "UNAUTHORIZED", "Missing bearer token.");
  }

  const userId = req.header("X-User-Id") || "stu_1001";
  const role = req.header("X-User-Role") || students.get(userId)?.role || "STUDENT";

  req.user = {
    id: userId,
    role,
    department: req.header("X-Department") || students.get(userId)?.department,
    year: Number(req.header("X-Year") || students.get(userId)?.year),
  };

  next();
});

app.get("/v1/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      timestamp: new Date().toISOString(),
    },
  });
});

app.get("/v1/notifications", (req, res) => {
  const { page, limit, type, isRead } = parseListQuery(req);

  if (type && !VALID_TYPES.has(type)) {
    return sendValidationError(req, res, [
      {
        field: "type",
        message: "type must be one of PLACEMENT, EVENT, RESULT",
      },
    ]);
  }

  if (isRead !== undefined && !["true", "false"].includes(isRead)) {
    return sendValidationError(req, res, [
      {
        field: "isRead",
        message: "isRead must be true or false",
      },
    ]);
  }

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return sendValidationError(req, res, [
      {
        field: "pagination",
        message: "page must be at least 1 and limit must be between 1 and 100",
      },
    ]);
  }

  const visibleNotifications = notifications
    .filter((notification) => isVisibleToUser(notification, req.user))
    .map((notification) => serializeNotification(notification, req.user.id))
    .filter((notification) => !type || notification.type === type)
    .filter(
      (notification) =>
        isRead === undefined || notification.isRead === (isRead === "true"),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const totalItems = visibleNotifications.length;
  const totalPages = Math.ceil(totalItems / limit);
  const start = (page - 1) * limit;

  res.json({
    success: true,
    data: visibleNotifications.slice(start, start + limit),
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
});

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

  res.write(`event: connected\n`);
  res.write(`data: {"clientId":"${clientId}"}\n\n`);

  req.on("close", () => {
    sseClients.delete(clientId);
  });
});

app.get("/v1/notifications/:notificationId", (req, res) => {
  const notification = findVisibleNotification(req.params.notificationId, req.user);

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
    data: serializeNotification(notification, req.user.id),
  });
});

app.patch("/v1/notifications/:notificationId/read", (req, res) => {
  const notification = findVisibleNotification(req.params.notificationId, req.user);

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

  setReadAt(req.user.id, notification.id, readAt);

  res.json({
    success: true,
    data: {
      id: notification.id,
      isRead: true,
      readAt,
    },
  });
});

app.patch("/v1/notifications/read-all", (req, res) => {
  const type = req.body?.type;

  if (type && !VALID_TYPES.has(type)) {
    return sendValidationError(req, res, [
      {
        field: "type",
        message: "type must be one of PLACEMENT, EVENT, RESULT",
      },
    ]);
  }

  const readAt = new Date().toISOString();
  let markedReadCount = 0;

  for (const notification of notifications) {
    if (!isVisibleToUser(notification, req.user)) {
      continue;
    }

    if (type && notification.type !== type) {
      continue;
    }

    if (!getReadAt(req.user.id, notification.id)) {
      setReadAt(req.user.id, notification.id, readAt);
      markedReadCount += 1;
    }
  }

  res.json({
    success: true,
    data: {
      markedReadCount,
      readAt,
    },
  });
});

app.post("/v1/notifications", (req, res) => {
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
    const existingNotification = notifications.find(
      (item) => item.id === existingNotificationId,
    );

    if (existingNotification) {
      return res.status(200).json({
        success: true,
        data: serializeNotification(existingNotification, req.user.id),
      });
    }
  }

  const validationErrors = validateNotificationBody(req.body);

  if (validationErrors.length > 0) {
    return sendValidationError(req, res, validationErrors);
  }

  const now = new Date().toISOString();
  const notification = {
    id: `ntf_${crypto.randomUUID().replaceAll("-", "").slice(0, 26).toUpperCase()}`,
    type: req.body.type,
    title: req.body.title,
    message: req.body.message,
    priority: req.body.priority ?? "NORMAL",
    audience: req.body.audience,
    metadata: req.body.metadata ?? {},
    createdBy: {
      id: req.user.id,
      role: req.user.role,
    },
    createdAt: now,
    updatedAt: now,
    publishedAt: req.body.publishedAt ?? now,
    expiresAt: req.body.expiresAt ?? null,
    deletedAt: null,
  };

  notifications = [notification, ...notifications];
  idempotencyStore.set(idempotencyKey, notification.id);
  broadcastNotification(notification);

  res.status(201).json({
    success: true,
    data: serializeNotification(notification, req.user.id),
  });
});

app.delete("/v1/notifications/:notificationId", (req, res) => {
  if (!ADMIN_ROLES.has(req.user.role)) {
    return sendError(
      req,
      res,
      403,
      "FORBIDDEN",
      "Only authorized admin users can delete notifications.",
    );
  }

  const notification = notifications.find(
    (item) => item.id === req.params.notificationId && !item.deletedAt,
  );

  if (!notification) {
    return sendError(req, res, 404, "NOT_FOUND", "Notification not found.");
  }

  notification.deletedAt = new Date().toISOString();
  notification.updatedAt = notification.deletedAt;

  res.json({
    success: true,
    data: {
      id: notification.id,
      deleted: true,
      deletedAt: notification.deletedAt,
    },
  });
});

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

app.listen(port, () => {
  console.log(`Campus Notification API listening on http://localhost:${port}`);
});

function parseListQuery(req) {
  return {
    page: Number(req.query.page ?? 1),
    limit: Number(req.query.limit ?? 20),
    type: req.query.type,
    isRead: req.query.isRead,
  };
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

  return errors;
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

function findVisibleNotification(notificationId, user) {
  return notifications.find(
    (notification) =>
      notification.id === notificationId && isVisibleToUser(notification, user),
  );
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

function broadcastNotification(notification) {
  for (const { user, res } of sseClients.values()) {
    if (!isVisibleToUser(notification, user)) {
      continue;
    }

    res.write(`event: notification.created\n`);
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
