use serde::{Serialize, Serializer};

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("api key not set")]
    ApiKeyMissing,

    #[error("keyring error: {0}")]
    Keyring(#[from] keyring::Error),

    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("stream error: {0}")]
    Stream(String),

    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("tauri error: {0}")]
    Tauri(#[from] tauri::Error),

}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = std::result::Result<T, AppError>;
