# Database Schema

SQLite database. Created automatically on first run if it does not exist.

## Tables

### users
Stores registered users. For MVP, only `user` exists (created on first login). Supports multiple users in future.

| Column   | Type         | Constraints              |
|----------|--------------|--------------------------|
| id       | INTEGER      | PRIMARY KEY AUTOINCREMENT |
| username | TEXT         | NOT NULL, UNIQUE         |

### boards
One board per user for MVP.

| Column   | Type    | Constraints                        |
|----------|---------|------------------------------------|
| id       | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| user_id  | INTEGER | NOT NULL, FOREIGN KEY → users.id   |
| title    | TEXT    | NOT NULL, DEFAULT 'My Board'       |

### columns
Five columns per board. `position` determines display order (0–4).

| Column   | Type    | Constraints                        |
|----------|---------|------------------------------------|
| id       | INTEGER | PRIMARY KEY AUTOINCREMENT          |
| board_id | INTEGER | NOT NULL, FOREIGN KEY → boards.id  |
| title    | TEXT    | NOT NULL                           |
| position | INTEGER | NOT NULL                           |

### cards
Cards belong to a column. `position` determines order within the column.

| Column    | Type    | Constraints                          |
|-----------|---------|--------------------------------------|
| id        | INTEGER | PRIMARY KEY AUTOINCREMENT            |
| column_id | INTEGER | NOT NULL, FOREIGN KEY → columns.id   |
| title     | TEXT    | NOT NULL                             |
| details   | TEXT    | NOT NULL, DEFAULT ''                 |
| position  | INTEGER | NOT NULL                             |

## Relationships

```
users (1) ──── (many) boards
boards (1) ──── (many) columns
columns (1) ──── (many) cards
```

## Cascade behaviour

- Deleting a board deletes all its columns (CASCADE)
- Deleting a column deletes all its cards (CASCADE)

## Seed data

On first login, if the user has no board, one is created automatically with these 5 columns (position 0–4):

1. Backlog
2. Discovery
3. In Progress
4. Review
5. Done
