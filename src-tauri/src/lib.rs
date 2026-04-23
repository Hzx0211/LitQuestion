mod chat;
mod error;
mod secrets;

use tauri_plugin_sql::{Migration, MigrationKind};

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "initial schema",
        kind: MigrationKind::Up,
        sql: r#"
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                model TEXT,
                provider TEXT,
                base_url TEXT,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                parent_id TEXT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                is_branch_root INTEGER NOT NULL DEFAULT 0,
                branch_label TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
                FOREIGN KEY (parent_id) REFERENCES messages(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
            CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
        "#,
    }, Migration {
        version: 2,
        description: "add include_in_main to messages",
        kind: MigrationKind::Up,
        sql: "ALTER TABLE messages ADD COLUMN include_in_main INTEGER NOT NULL DEFAULT 0;",
    }, Migration {
        version: 3,
        description: "add highlighted to messages",
        kind: MigrationKind::Up,
        sql: "ALTER TABLE messages ADD COLUMN highlighted INTEGER NOT NULL DEFAULT 0;",
    }, Migration {
        version: 4,
        description: "add node_label to messages",
        kind: MigrationKind::Up,
        sql: "ALTER TABLE messages ADD COLUMN node_label TEXT;",
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:litquestion.db", migrations())
                .build(),
        )
        .manage(chat::ChatState::default())
        .invoke_handler(tauri::generate_handler![
            secrets::secret_set,
            secrets::secret_get,
            secrets::secret_delete,
            secrets::secret_has,
            chat::chat_stream,
            chat::chat_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
