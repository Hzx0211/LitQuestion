//! Streaming chat completions against any OpenAI-compatible endpoint.
//!
//! The front-end invokes `chat_stream` with a request id, and listens to the
//! `chat://delta/<request_id>`, `chat://done/<request_id>` and
//! `chat://error/<request_id>` events for incremental tokens, completion and
//! errors respectively. A `chat_cancel` command aborts an in-flight request.

use crate::error::{AppError, AppResult};
use crate::secrets;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::sync::oneshot;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: serde_json::Value,
}

#[derive(Debug, Deserialize)]
pub struct ChatStreamRequest {
    pub request_id: String,
    pub provider: String,
    pub base_url: String,
    pub model: String,
    pub messages: Vec<ChatMessage>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize)]
struct OpenAIRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct ModelListItem {
    id: String,
    label: String,
    description: String,
}

#[derive(Debug, Deserialize)]
struct ModelListResponse {
    #[serde(default)]
    data: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct StreamChunk {
    #[serde(default)]
    choices: Vec<StreamChoice>,
}

#[derive(Debug, Deserialize)]
struct StreamChoice {
    #[serde(default)]
    delta: Delta,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct Delta {
    #[serde(default)]
    content: Option<String>,
}

#[derive(Default)]
pub struct ChatState {
    inflight: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl ChatState {
    fn register(&self, id: String) -> oneshot::Receiver<()> {
        let (tx, rx) = oneshot::channel();
        let mut guard = self.inflight.lock().unwrap();
        if let Some(old) = guard.insert(id, tx) {
            let _ = old.send(());
        }
        rx
    }

    fn clear(&self, id: &str) {
        self.inflight.lock().unwrap().remove(id);
    }

    fn cancel(&self, id: &str) -> bool {
        if let Some(tx) = self.inflight.lock().unwrap().remove(id) {
            let _ = tx.send(());
            true
        } else {
            false
        }
    }
}

fn normalize_base_url(base: &str) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") || trimmed.ends_with("/v4") {
        format!("{}/chat/completions", trimmed.trim_end_matches('/'))
    } else {
        format!("{}/v1/chat/completions", trimmed)
    }
}

fn normalize_models_url(provider: &str, base: &str) -> String {
    let trimmed = base.trim().trim_end_matches('/');
    let mut url = if trimmed.ends_with("/models") {
        trimmed.to_string()
    } else if trimmed.ends_with("/chat/completions") {
        trimmed
            .trim_end_matches("/chat/completions")
            .to_string()
            + "/models"
    } else if trimmed.ends_with("/v1") || trimmed.ends_with("/v4") {
        format!("{}/models", trimmed)
    } else {
        format!("{}/v1/models", trimmed)
    };

    let text = format!("{provider} {base}").to_lowercase();
    if text.contains("siliconflow")
        || text.contains("siliconflow.cn")
        || text.contains("硅基流动")
    {
        url.push_str("?type=text&sub_type=chat");
    }
    url
}

fn model_name(value: &serde_json::Value) -> Option<String> {
    value
        .get("id")
        .or_else(|| value.get("name"))
        .or_else(|| value.get("model"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(ToOwned::to_owned)
}

fn model_description(value: &serde_json::Value) -> String {
    value
        .get("description")
        .or_else(|| value.get("owned_by"))
        .or_else(|| value.get("type"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .unwrap_or("API 返回模型")
        .to_string()
}

#[tauri::command]
pub async fn list_models(
    provider: String,
    base_url: String,
    api_key: Option<String>,
) -> AppResult<Vec<ModelListItem>> {
    let key = match api_key
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
    {
        Some(v) => v,
        None => secrets::read_api_key(&provider)?,
    };
    let url = normalize_models_url(&provider, &base_url);
    let response = reqwest::Client::builder()
        .build()
        .map_err(AppError::Http)?
        .get(url)
        .bearer_auth(key)
        .header("accept", "application/json")
        .send()
        .await
        .map_err(AppError::Http)?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Stream(format!("HTTP {status}: {text}")));
    }

    let body = response.json::<ModelListResponse>().await?;
    let mut seen = HashMap::new();
    let mut models = Vec::new();
    for item in body.data {
        let Some(id) = model_name(&item) else {
            continue;
        };
        if seen.insert(id.clone(), ()).is_some() {
            continue;
        }
        models.push(ModelListItem {
            label: id.clone(),
            description: model_description(&item),
            id,
        });
    }
    Ok(models)
}

#[tauri::command]
pub async fn chat_stream(
    app: AppHandle,
    state: State<'_, ChatState>,
    req: ChatStreamRequest,
) -> AppResult<()> {
    let api_key = secrets::read_api_key(&req.provider)?;
    let url = normalize_base_url(&req.base_url);
    let request_id = req.request_id.clone();

    let cancel_rx = state.register(request_id.clone());

    let body = OpenAIRequest {
        model: &req.model,
        messages: &req.messages,
        stream: true,
        temperature: req.temperature,
        max_tokens: req.max_tokens,
    };

    let client = reqwest::Client::builder()
        .build()
        .map_err(AppError::Http)?;

    let send_fut = client
        .post(&url)
        .bearer_auth(api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send();

    tokio::spawn(async move {
        let result = run_stream(app.clone(), &request_id, send_fut, cancel_rx).await;
        if let Err(e) = result {
            let _ = app.emit(&format!("chat://error/{}", request_id), e.to_string());
        }
        let state = app.state::<ChatState>();
        state.clear(&request_id);
    });

    Ok(())
}

async fn run_stream(
    app: AppHandle,
    request_id: &str,
    send_fut: impl std::future::Future<Output = Result<reqwest::Response, reqwest::Error>>,
    mut cancel_rx: oneshot::Receiver<()>,
) -> AppResult<()> {
    let response = tokio::select! {
        r = send_fut => r.map_err(AppError::Http)?,
        _ = &mut cancel_rx => {
            app.emit(&format!("chat://done/{}", request_id), serde_json::json!({ "cancelled": true }))?;
            return Ok(());
        }
    };

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::Stream(format!("HTTP {status}: {text}")));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    loop {
        tokio::select! {
            maybe_chunk = stream.next() => {
                match maybe_chunk {
                    Some(Ok(bytes)) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        // SSE: events separated by double newline; each line `data: ...`
                        while let Some(idx) = buffer.find("\n\n").or_else(|| buffer.find("\r\n\r\n")) {
                            let raw_event = buffer[..idx].to_string();
                            let skip = if buffer[idx..].starts_with("\r\n\r\n") { idx + 4 } else { idx + 2 };
                            buffer.drain(..skip);
                            for line in raw_event.lines() {
                                let line = line.trim_start();
                                let Some(payload) = line.strip_prefix("data:") else { continue };
                                let payload = payload.trim();
                                if payload.is_empty() { continue; }
                                if payload == "[DONE]" {
                                    app.emit(&format!("chat://done/{request_id}"), serde_json::json!({ "cancelled": false }))?;
                                    return Ok(());
                                }
                                match serde_json::from_str::<StreamChunk>(payload) {
                                    Ok(chunk) => {
                                        for choice in chunk.choices {
                                            if let Some(content) = choice.delta.content {
                                                if !content.is_empty() {
                                                    app.emit(&format!("chat://delta/{request_id}"), content)?;
                                                }
                                            }
                                            if choice.finish_reason.is_some() {
                                                // Some providers stop without [DONE]; keep reading until stream closes.
                                            }
                                        }
                                    }
                                    Err(_) => {
                                        // Ignore malformed lines (keep-alives, comments, etc).
                                    }
                                }
                            }
                        }
                    }
                    Some(Err(e)) => return Err(AppError::Stream(e.to_string())),
                    None => {
                        app.emit(&format!("chat://done/{request_id}"), serde_json::json!({ "cancelled": false }))?;
                        return Ok(());
                    }
                }
            }
            _ = &mut cancel_rx => {
                app.emit(&format!("chat://done/{request_id}"), serde_json::json!({ "cancelled": true }))?;
                return Ok(());
            }
        }
    }
}

#[tauri::command]
pub fn chat_cancel(state: State<'_, ChatState>, request_id: String) -> bool {
    state.cancel(&request_id)
}
