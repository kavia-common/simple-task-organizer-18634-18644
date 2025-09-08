//
// MongoDB initialization script for the To-Do application.
// Sets up collections, JSON schema validation, and indexes.
//
// How to run manually (if needed):
//   mongosh "mongodb://appuser:dbuser123@localhost:5000/myapp?authSource=admin" ./init/01_init_collections.js
//
// This script is idempotent: running it multiple times will not cause errors.
//

/**
 * Create or update a collection with the given schema and indexes.
 * - If the collection doesn't exist, it will be created with the validator.
 * - If it exists, the validator and indexes will be ensured/updated.
 *
 * @param {Db} db - MongoDB Db instance
 * @param {string} name - Collection name
 * @param {object} schema - JSON schema validator object for $jsonSchema
 * @param {Array<object>} indexes - Array of index specs: { keys: {}, options: {} }
 */
function ensureCollection(db, name, schema, indexes) {
  const existing = db.getCollectionInfos({ name });
  if (!existing || existing.length === 0) {
    print(`- Creating collection '${name}' with schema validation...`);
    db.createCollection(name, {
      validator: { $jsonSchema: schema },
      validationLevel: "moderate",
      validationAction: "error"
    });
  } else {
    print(`- Collection '${name}' already exists. Updating validator...`);
    db.runCommand({
      collMod: name,
      validator: { $jsonSchema: schema },
      validationLevel: "moderate",
      validationAction: "error"
    });
  }

  // Ensure indexes
  if (Array.isArray(indexes)) {
    indexes.forEach((idx) => {
      const keys = idx.keys || {};
      const options = idx.options || {};
      const name = options.name || Object.keys(keys).map(k => `${k}_${keys[k]}`).join('_');
      print(`  · Ensuring index '${name}' on '${JSON.stringify(keys)}'`);
      db.getCollection(name ? options.collection || arguments[1] : arguments[1]).createIndex(keys, options);
    });
  }
}

// Connect to current DB selected by connection string
const currentDb = db.getName();
print(`Initializing MongoDB for database: ${currentDb}`);

// JSON Schemas

// Users collection schema
const usersSchema = {
  bsonType: "object",
  required: ["email", "passwordHash", "createdAt"],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    email: {
      bsonType: "string",
      description: "User email in lowercase",
      minLength: 5,
      maxLength: 320
    },
    passwordHash: {
      bsonType: "string",
      description: "BCrypt/Argon2 hash of the user's password",
      minLength: 20
    },
    name: {
      bsonType: ["string", "null"],
      description: "Optional display name",
      maxLength: 120
    },
    roles: {
      bsonType: ["array"],
      description: "User roles",
      items: { bsonType: "string" },
      uniqueItems: false
    },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: ["date", "null"] },
    lastLoginAt: { bsonType: ["date", "null"] },
    isActive: { bsonType: "bool", description: "Soft delete/disable flag", default: true },
    meta: {
      bsonType: ["object", "null"],
      description: "Arbitrary metadata",
      additionalProperties: true
    }
  }
};

// Tasks collection schema
const tasksSchema = {
  bsonType: "object",
  required: ["title", "status", "ownerId", "createdAt"],
  additionalProperties: false,
  properties: {
    _id: { bsonType: "objectId" },
    title: {
      bsonType: "string",
      description: "Task title",
      minLength: 1,
      maxLength: 300
    },
    description: {
      bsonType: ["string", "null"],
      description: "Optional details",
      maxLength: 5000
    },
    status: {
      bsonType: "string",
      enum: ["todo", "in_progress", "done", "archived"],
      description: "Task status"
    },
    priority: {
      bsonType: ["string", "int", "null"],
      description: "Optional priority (low, medium, high) or numeric",
      maxLength: 20
    },
    dueDate: {
      bsonType: ["date", "null"],
      description: "Optional due date"
    },
    ownerId: {
      bsonType: "objectId",
      description: "Reference to users._id"
    },
    tags: {
      bsonType: ["array"],
      description: "Tags for organization",
      items: { bsonType: "string" }
    },
    createdAt: { bsonType: "date" },
    updatedAt: { bsonType: ["date", "null"] },
    completedAt: { bsonType: ["date", "null"] },
    isDeleted: { bsonType: "bool", description: "Soft delete", default: false },
    checklist: {
      bsonType: ["array"],
      description: "Subtasks/checklist items",
      items: {
        bsonType: "object",
        required: ["text", "done"],
        additionalProperties: false,
        properties: {
          text: { bsonType: "string", minLength: 1, maxLength: 1000 },
          done: { bsonType: "bool" },
          doneAt: { bsonType: ["date", "null"] }
        }
      }
    }
  }
};

// Indexes
const usersIndexes = [
  { keys: { email: 1 }, options: { unique: true, name: "uniq_email" } },
  { keys: { isActive: 1 }, options: { name: "idx_isActive" } },
  { keys: { createdAt: -1 }, options: { name: "idx_createdAt_desc" } }
];

const tasksIndexes = [
  { keys: { ownerId: 1, status: 1, isDeleted: 1, createdAt: -1 }, options: { name: "idx_owner_status_deleted_created" } },
  { keys: { dueDate: 1 }, options: { name: "idx_dueDate" } },
  { keys: { title: "text", description: "text", "tags": "text" }, options: { name: "text_search", weights: { title: 10, description: 5, tags: 2 }, default_language: "english" } },
  { keys: { isDeleted: 1 }, options: { name: "idx_isDeleted" } },
  { keys: { status: 1, createdAt: -1 }, options: { name: "idx_status_created_desc" } }
];

// Ensure collections and indexes
ensureCollection(db, "users", usersSchema, usersIndexes);
ensureCollection(db, "tasks", tasksSchema, tasksIndexes);

// Helpful seed for local dev (only if collections are empty)
if (db.users.countDocuments({}) === 0) {
  print("Seeding example user...");
  const now = new Date();
  const uid = new ObjectId();
  db.users.insertOne({
    _id: uid,
    email: "demo@example.com",
    passwordHash: "bcrypt$demo-placeholder", // Replace with real hash in backend
    name: "Demo User",
    roles: ["user"],
    createdAt: now,
    updatedAt: null,
    lastLoginAt: null,
    isActive: true,
    meta: null
  });

  print("Seeding example tasks...");
  db.tasks.insertMany([
    {
      title: "Welcome to your To-Do app",
      description: "Edit or delete this task. Create more to get started.",
      status: "todo",
      priority: "medium",
      dueDate: null,
      ownerId: uid,
      tags: ["welcome", "getting-started"],
      createdAt: now,
      updatedAt: null,
      completedAt: null,
      isDeleted: false,
      checklist: [
        { text: "Explore the app", done: false, doneAt: null },
        { text: "Add a new task", done: false, doneAt: null }
      ]
    },
    {
      title: "Try completing a task",
      description: "Mark this task as done",
      status: "in_progress",
      priority: "low",
      dueDate: null,
      ownerId: uid,
      tags: ["demo"],
      createdAt: now,
      updatedAt: null,
      completedAt: null,
      isDeleted: false,
      checklist: []
    }
  ]);
}

print("Initialization script completed successfully.");
