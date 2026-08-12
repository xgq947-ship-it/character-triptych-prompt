use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    env,
    ffi::OsString,
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    time::Duration,
};
use tauri::Manager;
use wait_timeout::ChildExt;

#[cfg(target_os = "windows")]
use std::ffi::OsStr;

const DEEPSEEK_ENDPOINT: &str = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODELS_ENDPOINT: &str = "https://api.deepseek.com/models";
const MAX_PROMPT_BYTES: usize = 120_000;
const MAX_SCHEMA_BYTES: usize = 80_000;

#[cfg(target_os = "windows")]
fn hide_console_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;
    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(target_os = "windows"))]
fn hide_console_window(_command: &mut Command) {}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeepSeekRequest {
    api_key: String,
    model: String,
    system_prompt: String,
    user_prompt: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodexExecuteRequest {
    prompt: String,
    output_schema: String,
    timeout_seconds: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProviderAvailability {
    available: bool,
    message: String,
    version: Option<String>,
    path: Option<String>,
}

fn valid_deepseek_model(model: &str) -> bool {
    matches!(model, "deepseek-v4-flash" | "deepseek-v4-pro")
}

fn shortened(value: &str, limit: usize) -> String {
    let mut text = value.chars().take(limit).collect::<String>();
    if value.chars().count() > limit {
        text.push('…');
    }
    text
}

fn deepseek_error(status: reqwest::StatusCode, body: &Value) -> String {
    let message = body
        .pointer("/error/message")
        .and_then(Value::as_str)
        .map(|value| shortened(value, 300))
        .unwrap_or_else(|| "服务未返回错误详情".to_string());
    format!("DeepSeek 请求失败（HTTP {}）：{}", status.as_u16(), message)
}

#[tauri::command]
async fn deepseek_optimize(request: DeepSeekRequest) -> Result<String, String> {
    if request.api_key.trim().is_empty() {
        return Err("尚未配置 DeepSeek API Key。".to_string());
    }
    if !valid_deepseek_model(&request.model) {
        return Err("不支持的 DeepSeek 模型。".to_string());
    }
    if request.system_prompt.len() + request.user_prompt.len() > MAX_PROMPT_BYTES {
        return Err("提示词内容过长。".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(150))
        .build()
        .map_err(|_| "无法初始化 DeepSeek 网络请求。".to_string())?;

    let response = client
        .post(DEEPSEEK_ENDPOINT)
        .bearer_auth(request.api_key.trim())
        .json(&json!({
          "model": request.model,
          "messages": [
            { "role": "system", "content": request.system_prompt },
            { "role": "user", "content": request.user_prompt }
          ],
          "thinking": { "type": "disabled" },
          "response_format": { "type": "json_object" },
          "max_tokens": 4096,
          "stream": false
        }))
        .send()
        .await
        .map_err(|error| format!("无法连接 DeepSeek：{}", shortened(&error.to_string(), 220)))?;

    let status = response.status();
    let body = response.json::<Value>().await.map_err(|_| {
        format!(
            "DeepSeek 返回了无法读取的响应（HTTP {}）。",
            status.as_u16()
        )
    })?;

    if !status.is_success() {
        return Err(deepseek_error(status, &body));
    }

    body.pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .filter(|content| !content.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| "DeepSeek 没有返回可读取的 JSON 内容，请重试。".to_string())
}

#[tauri::command]
async fn deepseek_test_connection(api_key: String) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err("请先输入 DeepSeek API Key。".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|_| "无法初始化 DeepSeek 网络请求。".to_string())?;
    let response = client
        .get(DEEPSEEK_MODELS_ENDPOINT)
        .bearer_auth(api_key.trim())
        .send()
        .await
        .map_err(|error| format!("无法连接 DeepSeek：{}", shortened(&error.to_string(), 220)))?;
    let status = response.status();

    if status.is_success() {
        Ok("连接成功，API Key 有效。".to_string())
    } else {
        let body = response.json::<Value>().await.unwrap_or_else(|_| json!({}));
        Err(deepseek_error(status, &body))
    }
}

fn codex_binary_names() -> &'static [&'static str] {
    if cfg!(target_os = "windows") {
        &["codex.exe", "codex", "codex.cmd", "codex.bat"]
    } else {
        &["codex"]
    }
}

fn first_existing_in(directory: &Path) -> Option<PathBuf> {
    codex_binary_names()
        .iter()
        .map(|name| directory.join(name))
        .find(|candidate| candidate.is_file())
}

fn resolve_codex_binary() -> Option<PathBuf> {
    if let Some(path_value) = env::var_os("PATH") {
        for directory in env::split_paths(&path_value) {
            if let Some(candidate) = first_existing_in(&directory) {
                return Some(candidate);
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        for candidate in [
            "/Applications/ChatGPT.app/Contents/Resources/codex",
            "/Applications/Codex.app/Contents/Resources/codex",
            "/opt/homebrew/bin/codex",
            "/usr/local/bin/codex",
        ] {
            let path = PathBuf::from(candidate);
            if path.is_file() {
                return Some(path);
            }
        }
    }

    if let Some(home) = env::var_os(if cfg!(target_os = "windows") {
        "USERPROFILE"
    } else {
        "HOME"
    }) {
        let home = PathBuf::from(home);
        for relative in [".local/bin", ".npm-global/bin", ".cargo/bin", ".volta/bin"] {
            if let Some(candidate) = first_existing_in(&home.join(relative)) {
                return Some(candidate);
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let mut where_command = Command::new("where.exe");
        where_command.arg("codex");
        hide_console_window(&mut where_command);
        if let Ok(output) = where_command.output() {
            if output.status.success() {
                for line in String::from_utf8_lossy(&output.stdout).lines() {
                    let path = PathBuf::from(line.trim());
                    if path.is_file() {
                        return Some(path);
                    }
                }
            }
        }
    }

    None
}

#[cfg(target_os = "windows")]
fn quote_cmd_argument(value: &OsStr) -> String {
    let text = value.to_string_lossy();
    format!("\"{}\"", text.replace('%', "%%").replace('"', "\"\""))
}

fn codex_command(path: &Path, arguments: &[OsString]) -> Command {
    #[cfg(target_os = "windows")]
    {
        let script = path
            .extension()
            .and_then(OsStr::to_str)
            .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "cmd" | "bat"))
            .unwrap_or(false);
        if script {
            let mut line = quote_cmd_argument(path.as_os_str());
            for argument in arguments {
                line.push(' ');
                line.push_str(&quote_cmd_argument(argument));
            }
            let mut command = Command::new("cmd.exe");
            command.args(["/D", "/S", "/C"]).arg(line);
            return command;
        }
    }

    let mut command = Command::new(path);
    command.args(arguments);
    command
}

fn codex_version(path: &Path) -> Result<String, String> {
    let mut command = codex_command(path, &[OsString::from("--version")]);
    hide_console_window(&mut command);
    let output = command
        .output()
        .map_err(|_| "找到了 Codex CLI，但无法启动。".to_string())?;
    if !output.status.success() {
        return Err("找到了 Codex CLI，但版本检测失败。".to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[tauri::command]
fn codex_cli_status() -> ProviderAvailability {
    let Some(path) = resolve_codex_binary() else {
        return ProviderAvailability {
            available: false,
            message: "未检测到 Codex CLI".to_string(),
            version: None,
            path: None,
        };
    };

    match codex_version(&path) {
        Ok(version) => ProviderAvailability {
            available: true,
            message: "Codex CLI 已就绪".to_string(),
            version: Some(version),
            path: Some(path.to_string_lossy().to_string()),
        },
        Err(message) => ProviderAvailability {
            available: false,
            message,
            version: None,
            path: Some(path.to_string_lossy().to_string()),
        },
    }
}

fn codex_exec_arguments(schema_path: &Path, output_path: &Path) -> Vec<OsString> {
    vec![
        "exec".into(),
        "--ephemeral".into(),
        "--skip-git-repo-check".into(),
        "--ignore-rules".into(),
        "--sandbox".into(),
        "read-only".into(),
        "--color".into(),
        "never".into(),
        "--output-schema".into(),
        schema_path.as_os_str().to_os_string(),
        "--output-last-message".into(),
        output_path.as_os_str().to_os_string(),
        "-".into(),
    ]
}

fn run_codex_job(app: tauri::AppHandle, request: CodexExecuteRequest) -> Result<String, String> {
    if request.prompt.trim().is_empty() {
        return Err("人物描述不能为空。".to_string());
    }
    if request.prompt.len() > MAX_PROMPT_BYTES {
        return Err("发送给 Codex 的内容过长。".to_string());
    }
    if request.output_schema.len() > MAX_SCHEMA_BYTES {
        return Err("输出 Schema 过长。".to_string());
    }
    serde_json::from_str::<Value>(&request.output_schema)
        .map_err(|_| "输出 Schema 不是有效 JSON。".to_string())?;

    let codex_path = resolve_codex_binary().ok_or_else(|| "未检测到 Codex CLI。".to_string())?;
    let timeout_seconds = request.timeout_seconds.clamp(30, 300);
    let cache_root = app
        .path()
        .app_cache_dir()
        .map_err(|_| "无法访问应用缓存目录。".to_string())?
        .join("codex-jobs");
    let job_dir = cache_root.join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(&job_dir).map_err(|_| "无法创建 Codex 临时任务目录。".to_string())?;

    let schema_path = job_dir.join("output-schema.json");
    let output_path = job_dir.join("response.json");
    let stderr_path = job_dir.join("stderr.log");
    fs::write(&schema_path, request.output_schema.as_bytes())
        .map_err(|_| "无法准备 Codex 输出 Schema。".to_string())?;
    let stderr_file =
        File::create(&stderr_path).map_err(|_| "无法准备 Codex 诊断输出。".to_string())?;

    let arguments = codex_exec_arguments(&schema_path, &output_path);
    let mut command = codex_command(&codex_path, &arguments);
    hide_console_window(&mut command);
    command
        .current_dir(&job_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::from(stderr_file));

    let mut child = command.spawn().map_err(|_| {
        let _ = fs::remove_dir_all(&job_dir);
        "无法启动 Codex CLI。".to_string()
    })?;

    let write_result = child
        .stdin
        .take()
        .ok_or_else(|| "无法连接 Codex CLI 标准输入。".to_string())
        .and_then(|mut stdin| {
            stdin
                .write_all(request.prompt.as_bytes())
                .map_err(|_| "无法把人物描述发送给 Codex CLI。".to_string())
        });
    if let Err(message) = write_result {
        let _ = child.kill();
        let _ = child.wait();
        let _ = fs::remove_dir_all(&job_dir);
        return Err(message);
    }

    let status = match child.wait_timeout(Duration::from_secs(timeout_seconds)) {
        Ok(Some(status)) => status,
        Ok(None) => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_dir_all(&job_dir);
            return Err(format!(
                "Codex CLI 超过 {} 秒未响应，任务已安全终止。",
                timeout_seconds
            ));
        }
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            let _ = fs::remove_dir_all(&job_dir);
            return Err("等待 Codex CLI 时发生错误。".to_string());
        }
    };

    if !status.success() {
        let detail = fs::read_to_string(&stderr_path)
            .ok()
            .map(|value| shortened(value.trim(), 900))
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| "没有诊断信息".to_string());
        let _ = fs::remove_dir_all(&job_dir);
        return Err(format!("Codex CLI 执行失败：{}", detail));
    }

    let output_result = fs::read_to_string(&output_path);
    let _ = fs::remove_dir_all(&job_dir);
    let output =
        output_result.map_err(|_| "Codex CLI 完成了任务，但没有生成结果文件。".to_string())?;
    if output.trim().is_empty() {
        return Err("Codex CLI 返回了空结果。".to_string());
    }
    Ok(output.trim().to_string())
}

#[tauri::command]
async fn codex_cli_optimize(
    app: tauri::AppHandle,
    request: CodexExecuteRequest,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || run_codex_job(app, request))
        .await
        .map_err(|_| "Codex CLI 后台任务意外终止。".to_string())?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            deepseek_optimize,
            deepseek_test_connection,
            codex_cli_status,
            codex_cli_optimize,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Character Triptych");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_current_deepseek_models_are_allowed() {
        assert!(valid_deepseek_model("deepseek-v4-flash"));
        assert!(valid_deepseek_model("deepseek-v4-pro"));
        assert!(!valid_deepseek_model("deepseek-chat"));
    }

    #[test]
    fn codex_arguments_contain_paths_but_never_user_prompt() {
        let schema = Path::new("/tmp/schema.json");
        let output = Path::new("/tmp/output.json");
        let arguments = codex_exec_arguments(schema, output);
        let rendered = arguments
            .iter()
            .map(|value| value.to_string_lossy())
            .collect::<Vec<_>>()
            .join(" ");
        assert!(rendered.contains("--output-schema"));
        assert!(rendered.ends_with(" -"));
        assert!(!rendered.contains("user supplied description"));
    }
}
