// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::path::Path;
use std::process::Command as StdCommand;
use std::thread;
use tauri::api::process::Command;
use tauri::api::process::{CommandChild, CommandEvent};
use lazy_static::lazy_static;
use once_cell::sync::{Lazy, OnceCell};
use reqwest;
use reqwest::Client;
use serde_json::{json, Value};
use rand::Rng;
// use tokio::runtime::Runtime;
// use std::thread::sleep;

static OPEN_PORT: OnceCell<u16> = OnceCell::new();
static CLIENT: Lazy<Client> = Lazy::new(|| Client::new());

lazy_static! {
    static ref RX: Arc<Mutex<Option<tauri::async_runtime::Receiver<CommandEvent>>>> =
        Arc::new(Mutex::new(None));
    static ref CHILD: Arc<Mutex<Option<CommandChild>>> = Arc::new(Mutex::new(None));
}

fn main() {
    // find first open localhost port
    scan_ports(5050, 8000);

    // You can access the OPEN_PORT from anywhere in your code like this:
    let port = OPEN_PORT.get().unwrap_or_else(|| {
        eprintln!("Error: No open ports found.");
        std::process::exit(1);
    });
    println!("Open port: {}", port);

    // the flask app needs to be run in thread, otherwise it's not running properly
    let _handle = thread::spawn(move || {
        let port_arg = port.to_string();
        let (rx, child) = Command::new_sidecar("api")
            .expect("failed to create `my-sidecar` binary command")
            .args(&[&port_arg])
            .spawn()
            .expect("Failed to start python script");

        // hold the needed rx, child in static globals
        *RX.lock().unwrap() = Some(rx);
        *CHILD.lock().unwrap() = Some(child);
    });

    // Wait for the server to start
    // thread::sleep(std::time::Duration::from_secs(5));

    // waiting for server to actually start instead of the arbitrary seconds
    let client = reqwest::blocking::Client::new();
    let port_arg = port.to_string();
    let server_url = format!("http://localhost:{}", port_arg);
    loop {
        match client.get(&server_url).send() {
            Ok(_) => break, // Server has started, break the loop
            Err(_) => thread::sleep(std::time::Duration::from_millis(100)), // Sleep for a short duration before trying again
        }
    }

    // buils the ui
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            start_api,
            send_prompt,
            send_prompt_file_path,
            get_dir_path,
            send_dir_path,
            open_dir,
            get_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    // Wait for the thread to finish.
    match _handle.join() {
        Ok(_) => println!("Server finished successfully."),
        Err(e) => println!("Server panicked: {:?}", e),
    }
}

#[tauri::command]
async fn start_api() -> String {
    // println!("Starting api");
    let port = OPEN_PORT.get().unwrap().to_string();
    let url = format!("http://127.0.0.1:{}/api/start-bot", port);
    let res = CLIENT
        .post(&url)
        .send()
        .await
        .unwrap();

    let message = res
        .text()
        .await
        .unwrap();
    message

}

#[tauri::command]
async fn send_prompt(prompt: String) -> Result<(), String> {
    let port = OPEN_PORT.get().unwrap().to_string();
    let url = format!("http://127.0.0.1:{}/api/send-prompt", port);
    let res = CLIENT
        .post(&url)
        .json(&json!({ "prompt": prompt }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let _response_text = res.text().await.map_err(|e| e.to_string())?;
        // println!("{}", response_text);
        Ok(())
    } else {
        Err("Failed to send the request - send-prompt".into())
    }
}

#[tauri::command]
async fn send_prompt_file_path(path: String) -> Result<(), String> {
    let filepath = Path::new(&path);
    let port = OPEN_PORT.get().unwrap().to_string();
    let url = format!("http://127.0.0.1:{}/api/send-filepath", port);
    let res = CLIENT
        .post(&url)
        .json(&json!({ "filepath": filepath }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let _response_text = res.text().await.map_err(|e| e.to_string())?;
        // println!("{}", response_text);
        Ok(())
    } else {
        Err("Failed to send the request set-download-dir".into())
    }
}

#[tauri::command]
async fn get_dir_path() -> String {
    let port = OPEN_PORT.get().unwrap().to_string();
    let url = format!("http://127.0.0.1:{}/api/get-download-dir", port);
    let res = CLIENT
        .post(&url)
        .send()
        .await
        .unwrap_or_else(|_| panic!("Failed to send request - get-download-dir"));

    let path = res
        .text()
        .await
        .unwrap_or_else(|_| panic!("Failed to read response - get-download-dir"));
    path
}

#[tauri::command]
async fn send_dir_path(path: String) -> Result<(), String> {
    let path = Path::new(&path);
    // println!("{}", path.display());
    let port = OPEN_PORT.get().unwrap().to_string();
    let url = format!("http://127.0.0.1:{}/api/set-download-dir", port);
    let res = CLIENT
        .post(&url)
        .json(&json!({ "path": path }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let _response_text = res.text().await.map_err(|e| e.to_string())?;
        // println!("{}", response_text);
        Ok(())
    } else {
        Err("Failed to send the request - send-dir-path".into())
    }
}

#[tauri::command]
async fn get_status() -> (String, String) {
    let port = OPEN_PORT.get().unwrap().to_string();
    let url = format!("http://localhost:{}/api/status", port);
    let res = CLIENT
        .post(&url)
        .send()
        .await
        .unwrap_or_else(|_| panic!("Failed to send request - status"));

    let body = res
        .text()
        .await
        .unwrap_or_else(|_| panic!("Failed to read response - status"));

    // Parse the body into a JSON Value
    let parsed: Value =
        serde_json::from_str(&body).unwrap_or_else(|_| panic!("Failed to parse response - status"));

    // Extract the "status" and "counter" fields
    let status = parsed["status"].as_str().unwrap_or("").to_string();
    let counter = parsed["counter"].as_str().unwrap_or("").to_string();
    (status, counter)
}

#[tauri::command]
fn open_dir(path: String) -> Result<(), String> {
    let dir_path = Path::new(&path);

    #[cfg(target_os = "windows")]
        let _ = StdCommand::new("explorer").arg(dir_path).spawn();

    #[cfg(target_os = "macos")]
        let _ = StdCommand::new("open").arg(dir_path).spawn();

    #[cfg(target_os = "linux")]
        let _ = StdCommand::new("xdg-open").arg(dir_path).spawn();

    Ok(())
}

fn scan_ports(start: u16, end: u16) {
    let mut rng = rand::thread_rng();
    let random_start = rng.gen_range(start..=end);

    for port in random_start..=end {
        let address = format!("127.0.0.1:{}", port);
        match std::net::TcpStream::connect(&address) {
            Ok(_) => {
                // The port is occupied, continue scanning
                continue;
            }
            Err(_) => {
                // The port is open, we can use it
                let _ = OPEN_PORT.set(port);
                return;
            }
        }
        // sleep(Duration::from_secs(1));
    }
    for port in start..random_start {
        let address = format!("127.0.0.1:{}", port);
        match std::net::TcpStream::connect(&address) {
            Ok(_) => continue, // Port is occupied
            Err(_) => {
                let _ = OPEN_PORT.set(port); // Port is open
                return;
            }
        }
    }
}
