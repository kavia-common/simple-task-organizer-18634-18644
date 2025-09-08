# Tasks Database (MongoDB)

This container sets up a MongoDB instance for the Simple Task Organizer app. It provisions:
- Database: `myapp`
- Users:
  - Admin: `appuser` with admin roles on admin DB (password: `dbuser123`)
  - App DB user: `appuser` with `readWrite` on `myapp`
- Collections:
  - `users` (unique email, schema validation, useful indexes)
  - `tasks` (schema validation, compound indexes, text search)
- Initialization script: `init/01_init_collections.js` (idempotent)

Quick connect:
- mongosh mongodb://appuser:dbuser123@localhost:5000/myapp?authSource=admin

Files:
- startup.sh: Starts mongod (if needed), creates users/DB, and runs the init script.
- init/01_init_collections.js: Creates/updates collections with JSON schema validators and indexes. Seeds demo data if collections are empty.
- db_visualizer/mongodb.env: Environment variables for the simple DB viewer.
- backup_db.sh / restore_db.sh: Generic backup and restore utilities.

Environment variables (for dependent services):
- MONGODB_URL: mongodb://appuser:dbuser123@localhost:5000/?authSource=admin
- MONGODB_DB: myapp

Initialization details:
- Users collection has unique index on `email` and validation for fields (email, passwordHash, timestamps, etc.).
- Tasks collection validates fields like title, status (todo|in_progress|done|archived), ownerId, timestamps, and includes:
  - Compound index: `{ ownerId:1, status:1, isDeleted:1, createdAt:-1 }` for the main task list queries.
  - Text index on `title`, `description`, and `tags` for searching.
  - Additional indexes on `dueDate`, `status+createdAt`, and `isDeleted`.

Manual initialization:
- If you need to re-run schema/index setup:
  mongosh "mongodb://appuser:dbuser123@localhost:5000/myapp?authSource=admin" ./init/01_init_collections.js

Security notes:
- Passwords and connection strings are for local development.
- In production, use secure secrets and the official MongoDB mechanisms for initialization.

