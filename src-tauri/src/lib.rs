#![allow(non_snake_case)]
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Config {
    pub theme: Option<String>,
    pub zoom: Option<f64>,
    pub last_dir: Option<String>,
    pub last_file: Option<String>,
    pub window_state: Option<String>,
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("config.json")
}

fn do_load_config(app: &tauri::AppHandle) -> Config {
    let path = config_path(app);
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

fn do_save_config(app: &tauri::AppHandle, cfg: &Config) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(cfg).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Config {
    do_load_config(&app)
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: Config) -> Result<(), String> {
    // 如果传入的 window_state 为空，保留已存在的值（window_state 由 Rust 端 CloseRequested 管理）
    let mut merged = config;
    if merged.window_state.is_none() {
        merged.window_state = do_load_config(&app).window_state;
    }
    do_save_config(&app, &merged)
}

#[derive(Debug, Serialize)]
pub struct FileResult {
    pub path: String,
    pub content: String,
    pub filename: String,
}

#[tauri::command]
async fn read_file_at_path(path: String) -> Result<FileResult, String> {
    let path_buf = PathBuf::from(&path);
    let content = fs::read_to_string(&path_buf).map_err(|e| e.to_string())?;
    let filename = path_buf
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Untitled")
        .to_string();
    Ok(FileResult {
        path: path_buf.to_string_lossy().to_string(),
        content,
        filename,
    })
}

#[tauri::command]
fn get_cli_file() -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    args.get(1).cloned()
}

#[tauri::command]
async fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<FileResult>, String> {
    use tauri_plugin_dialog::DialogExt;

    let cfg = do_load_config(&app);
    let initial_dir = cfg.last_dir.clone().unwrap_or_default();

    let result = app
        .dialog()
        .file()
        .add_filter("Markdown files", &["md", "txt"])
        .add_filter("All files", &["*"])
        .set_directory(initial_dir)
        .blocking_pick_file();

    match result {
        Some(path) => {
            let path_buf = path.into_path().map_err(|e| e.to_string())?;
            let content = fs::read_to_string(&path_buf).map_err(|e| e.to_string())?;
            let filename = path_buf
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Untitled")
                .to_string();
            let dir = path_buf
                .parent()
                .and_then(|p| p.to_str())
                .unwrap_or("")
                .to_string();

            let mut new_cfg = cfg;
            new_cfg.last_dir = Some(dir);
            do_save_config(&app, &new_cfg)?;

            Ok(Some(FileResult {
                path: path_buf.to_string_lossy().to_string(),
                content,
                filename,
            }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_file_dialog(
    app: tauri::AppHandle,
    content: String,
    suggested_name: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let cfg = do_load_config(&app);
    let initial_dir = cfg.last_dir.clone().unwrap_or_default();

    let result = app
        .dialog()
        .file()
        .add_filter("Markdown files", &["md"])
        .add_filter("All files", &["*"])
        .set_directory(initial_dir)
        .set_file_name(suggested_name)
        .blocking_save_file();

    match result {
        Some(path) => {
            let path_buf = path.into_path().map_err(|e| e.to_string())?;
            fs::write(&path_buf, &content).map_err(|e| e.to_string())?;

            let dir = path_buf
                .parent()
                .and_then(|p| p.to_str())
                .unwrap_or("")
                .to_string();
            let mut new_cfg = cfg;
            new_cfg.last_dir = Some(dir);
            do_save_config(&app, &new_cfg)?;

            Ok(Some(path_buf.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn save_binary_file_dialog(
    app: tauri::AppHandle,
    data: Vec<u8>,
    suggested_name: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::io::Write;

    let cfg = do_load_config(&app);
    let initial_dir = cfg.last_dir.clone().unwrap_or_default();

    let result = app
        .dialog()
        .file()
        .add_filter("PDF files", &["pdf"])
        .set_directory(initial_dir)
        .set_file_name(suggested_name)
        .blocking_save_file();

    match result {
        Some(path) => {
            let path_buf = path.into_path().map_err(|e| e.to_string())?;
            let mut file = fs::File::create(&path_buf).map_err(|e| e.to_string())?;
            file.write_all(&data).map_err(|e| e.to_string())?;
            Ok(Some(path_buf.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn exit_app(app: tauri::AppHandle) {
    // 关闭窗口触发 CloseRequested → 自动保存状态并优雅退出
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.close();
    }
}

#[tauri::command]
fn set_window_theme(app: tauri::AppHandle, theme: String) {
    #[cfg(windows)]
    if let Some(window) = app.get_webview_window("main") {
        use windows::Win32::Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_CAPTION_COLOR};
        use windows::Win32::Foundation::COLORREF;

        let hwnd = window.hwnd().unwrap();
        let color = match theme.as_str() {
            "light" => 0x00F0F0F0u32,
            "dark" => 0x002D2D2Du32,
            "solarized-light" => 0x00D5E8EEu32,
            "solarized-dark" => 0x00423607u32,
            _ => return,
        };
        unsafe {
            let _ = DwmSetWindowAttribute(
                hwnd,
                DWMWA_CAPTION_COLOR,
                &color as *const _ as *const _,
                std::mem::size_of::<COLORREF>() as u32,
            );
        }
    }
    let _ = app; // 非 Windows 平台不操作
}

// ── WebView2 PrintToPdf PDF 导出 ─────────────

#[cfg(windows)]
#[tauri::command]
async fn export_pdf(
    app: tauri::AppHandle,
    html: String,
    suggested_name: String,
) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use tauri_plugin_dialog::DialogExt;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2PrintSettings, ICoreWebView2_7,
    };
    use webview2_com::PrintToPdfCompletedHandler;
    use windows::core::{Interface, HSTRING};

    // 步骤1：先弹出保存对话框，用户选好路径后再渲染
    let cfg = do_load_config(&app);
    let initial_dir = cfg.last_dir.clone().unwrap_or_default();

    let dest_path = match app
        .dialog()
        .file()
        .add_filter("PDF files", &["pdf"])
        .set_directory(initial_dir)
        .set_file_name(suggested_name)
        .blocking_save_file()
    {
        Some(path) => path.into_path().map_err(|e| e.to_string())?,
        None => return Ok(None), // 用户取消，不做任何渲染工作
    };

    let dest = dest_path.to_string_lossy().to_string();

    // 更新 last_dir
    if let Some(parent) = dest_path.parent() {
        let mut new_cfg = cfg;
        new_cfg.last_dir = Some(parent.to_string_lossy().to_string());
        do_save_config(&app, &new_cfg)?;
    }

    // 步骤2：写临时 HTML 文件
    let temp_dir = std::env::temp_dir().join("md-editor-pdf");
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let html_path = temp_dir.join("export.html");

    let full_html = format!(
        "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n\
<style>\n\
* {{ margin:0; padding:0; box-sizing:border-box; }}\n\
body {{ font-family:'Microsoft YaHei',sans-serif; font-size:10.5pt; line-height:1.6; color:#24292e; padding:56.7pt; }}\n\
h1 {{ font-size:20pt; margin:12pt 0 6pt; font-weight:bold; }}\n\
h2 {{ font-size:16pt; margin:10pt 0 4pt; font-weight:bold; }}\n\
h3 {{ font-size:13pt; margin:8pt 0 4pt; font-weight:bold; }}\n\
h4 {{ font-size:11pt; margin:6pt 0 3pt; font-weight:bold; }}\n\
p {{ margin:2pt 0; }}\n\
pre {{ background:#f6f8fa; border:1px solid #d0d7de; border-radius:4pt; padding:10pt; margin:6pt 0; font-size:9pt; line-height:1.4; white-space:pre-wrap; word-wrap:break-word; }}\n\
code {{ font-family:'Microsoft YaHei',monospace; font-size:9pt; }}\n\
blockquote {{ border-left:3pt solid #d0d7de; padding:4pt 0 4pt 15pt; margin:6pt 0; color:#666; font-size:9pt; }}\n\
ul, ol {{ margin:4pt 0 4pt 20pt; }}\n\
li {{ margin:2pt 0; }}\n\
table {{ border-collapse:collapse; width:100%; margin:6pt 0; }}\n\
th, td {{ border:1px solid #d0d7de; padding:4pt 8pt; text-align:left; font-size:10pt; }}\n\
th {{ background:#f6f8fa; font-weight:bold; }}\n\
hr {{ border:none; border-top:1px solid #d9d9d9; margin:10pt 0; }}\n\
a {{ color:#0969da; text-decoration:none; }}\n\
strong {{ font-weight:bold; }}\n\
em {{ font-style:italic; }}\n\
del {{ text-decoration:line-through; }}\n\
img {{ max-width:100%; }}\n\
</style>\n</head>\n<body>\n{}\n</body>\n</html>",
        html
    );
    fs::write(&html_path, &full_html).map_err(|e| e.to_string())?;

    // 步骤3：创建不可见 WebView 加载 HTML
    let file_url = format!(
        "file:///{}",
        html_path.to_string_lossy().replace('\\', "/")
    );
    let window = WebviewWindowBuilder::new(
        &app,
        "pdf-export",
        WebviewUrl::External(url::Url::parse(&file_url).map_err(|e| e.to_string())?),
    )
    .visible(false)
    .build()
    .map_err(|e| e.to_string())?;

    // 等待渲染完成
    tokio::time::sleep(std::time::Duration::from_millis(300)).await;

    // 步骤4：PrintToPdf 直接写到用户选择的路径
    let dest_for_com = dest.clone();
    let (print_tx, print_rx) = mpsc::channel::<Result<(), String>>();
    let setup_tx = print_tx.clone();

    window
        .with_webview(move |webview| {
            let result = (|| -> Result<(), String> {
                unsafe {
                    let controller = webview.controller();
                    let core = controller
                        .CoreWebView2()
                        .map_err(|e| format!("CoreWebView2: {e}"))?;
                    let wv: ICoreWebView2_7 = core
                        .cast::<ICoreWebView2_7>()
                        .map_err(|e| format!("cast ICoreWebView2_7: {e}"))?;

                    let pdf_hstring = HSTRING::from(dest_for_com.as_str());
                    let settings: Option<&ICoreWebView2PrintSettings> = None;

                    let handler = PrintToPdfCompletedHandler::create(Box::new(
                        move |result: windows::core::Result<()>,
                              is_success: bool| {
                            let _ = print_tx.send(
                                if result.is_ok() && is_success {
                                    Ok(())
                                } else {
                                    Err("PrintToPdf reported failure".to_string())
                                },
                            );
                            Ok(())
                        },
                    ));

                    wv.PrintToPdf(&pdf_hstring, settings, &handler)
                        .map_err(|e| format!("PrintToPdf call: {e}"))?;

                    Ok(())
                }
            })();
            if let Err(e) = result {
                let _ = setup_tx.send(Err(e));
            }
        })
        .map_err(|e| e.to_string())?;

    // 在非主线程等待 PrintToPdf 完成
    let result = print_rx
        .recv_timeout(std::time::Duration::from_secs(30))
        .map_err(|e| format!("PrintToPdf timeout: {e}"));

    // 无论成功还是超时，都清理临时文件和隐藏窗口
    let _ = fs::remove_file(&html_path);
    let _ = window.close();

    result??;

    Ok(Some(dest))
}

#[cfg(not(windows))]
#[tauri::command]
async fn export_pdf(
    _app: tauri::AppHandle,
    _html: String,
    _suggested_name: String,
) -> Result<Option<String>, String> {
    Err("PDF export is only supported on Windows".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
            // 新实例可能带有文件参数，通知前端加载
            if let Some(file_path) = args.into_iter().nth(1) {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.emit("second-instance-file", file_path);
                }
            }
        }))
        .setup(|app| {
            use tauri::WindowEvent;

            let handle = app.handle().clone();
            let cfg = do_load_config(&handle);

            // 恢复窗口状态
            if let Some(window) = app.get_webview_window("main") {
                if let Some(ref state_str) = cfg.window_state {
                    if let Ok(ws) = serde_json::from_str::<serde_json::Value>(state_str) {
                        if ws.get("isMaximized").and_then(|v| v.as_bool()).unwrap_or(false) {
                            let _ = window.maximize();
                        } else if let (Some(x), Some(y), Some(w), Some(h)) = (
                            ws.get("x").and_then(|v| v.as_i64()),
                            ws.get("y").and_then(|v| v.as_i64()),
                            ws.get("width").and_then(|v| v.as_u64()),
                            ws.get("height").and_then(|v| v.as_u64()),
                        ) {
                            let _ = window.set_position(tauri::PhysicalPosition::new(x as i32, y as i32));
                            let _ = window.set_size(tauri::PhysicalSize::new(w as u32, h as u32));
                        }
                    }
                }

                // 关闭时保存窗口状态
                let h = handle.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { .. } = event {
                        let w = h.get_webview_window("main").unwrap();
                        let is_max = w.is_maximized().unwrap_or(false);
                        let state = if is_max {
                            serde_json::json!({ "isMaximized": true }).to_string()
                        } else {
                            let pos = w.outer_position().unwrap_or(tauri::PhysicalPosition::new(0, 0));
                            let size = w.outer_size().unwrap_or(tauri::PhysicalSize::new(800, 600));
                            serde_json::json!({
                                "isMaximized": false,
                                "x": pos.x,
                                "y": pos.y,
                                "width": size.width,
                                "height": size.height,
                            })
                            .to_string()
                        };
                        let mut cfg = do_load_config(&h);
                        cfg.window_state = Some(state);
                        let _ = do_save_config(&h, &cfg);
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            open_file_dialog,
            write_file,
            save_file_dialog,
            save_binary_file_dialog,
            read_file_at_path,
            get_cli_file,
            exit_app,
            export_pdf,
            set_window_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
