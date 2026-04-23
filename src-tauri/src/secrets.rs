//! Thin wrapper around the system keychain for storing API keys.
//!
//! Keys are namespaced per-provider so users can configure multiple providers
//! in the future (OpenAI, Anthropic, a custom OpenAI-compatible endpoint, ...).

use crate::error::{AppError, AppResult};
use keyring::Entry;

const SERVICE: &str = "com.litquestion.app";

fn entry(provider: &str) -> AppResult<Entry> {
    Ok(Entry::new(SERVICE, provider)?)
}

#[tauri::command]
pub fn secret_set(provider: String, value: String) -> AppResult<()> {
    entry(&provider)?.set_password(&value)?;
    Ok(())
}

#[tauri::command]
pub fn secret_get(provider: String) -> AppResult<Option<String>> {
    match entry(&provider)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Keyring(e)),
    }
}

#[tauri::command]
pub fn secret_delete(provider: String) -> AppResult<()> {
    match entry(&provider)?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(AppError::Keyring(e)),
    }
}

#[tauri::command]
pub fn secret_has(provider: String) -> AppResult<bool> {
    match entry(&provider)?.get_password() {
        Ok(_) => Ok(true),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(e) => Err(AppError::Keyring(e)),
    }
}

pub fn read_api_key(provider: &str) -> AppResult<String> {
    match entry(provider)?.get_password() {
        Ok(v) => Ok(v),
        Err(keyring::Error::NoEntry) => Err(AppError::ApiKeyMissing),
        Err(e) => Err(AppError::Keyring(e)),
    }
}
