use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::{IpAddr, TcpListener, TcpStream};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const MAX_TRANSFER_BYTES: usize = 5 * 1024 * 1024;
const TRANSFER_LIFETIME: Duration = Duration::from_secs(300);
const KEYCHAIN_SERVICE: &str = "cn.xiaohuang.reminder";
const ICLOUD_KEY: &str = "xuji.encrypted.sync.v1";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct MacReminder {
  id: String,
  title: String,
  body: String,
  year: isize,
  month: isize,
  day: isize,
  hour: isize,
  minute: isize,
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn schedule_macos_reminders(reminders: Vec<MacReminder>) -> Result<usize, String> {
  use objc2_foundation::{NSDateComponents, NSString};
  use objc2_user_notifications::{
    UNCalendarNotificationTrigger, UNMutableNotificationContent, UNNotificationRequest,
    UNUserNotificationCenter,
  };

  let center = UNUserNotificationCenter::currentNotificationCenter();
  center.removeAllPendingNotificationRequests();

  for reminder in &reminders {
    let content = UNMutableNotificationContent::new();
    content.setTitle(&NSString::from_str(&reminder.title));
    content.setBody(&NSString::from_str(&reminder.body));

    let components = NSDateComponents::new();
    components.setYear(reminder.year);
    components.setMonth(reminder.month);
    components.setDay(reminder.day);
    components.setHour(reminder.hour);
    components.setMinute(reminder.minute);
    components.setSecond(0);

    let trigger = UNCalendarNotificationTrigger::triggerWithDateMatchingComponents_repeats(
      &components,
      false,
    );
    let request = UNNotificationRequest::requestWithIdentifier_content_trigger(
      &NSString::from_str(&reminder.id),
      &content,
      Some(&trigger),
    );
    center.addNotificationRequest_withCompletionHandler(&request, None);
  }

  Ok(reminders.len())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn schedule_macos_reminders(_reminders: Vec<MacReminder>) -> Result<usize, String> {
  Err("macOS reminders are only available on macOS".to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct NearbyTransfer {
  host: String,
  port: u16,
  expires_at: u128,
}

fn valid_transfer_token(token: &str) -> bool {
  (24..=128).contains(&token.len())
    && token.bytes().all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

fn private_or_local_ip(ip: IpAddr) -> bool {
  match ip {
    IpAddr::V4(value) => value.is_private() || value.is_loopback() || value.is_link_local(),
    IpAddr::V6(value) => value.is_loopback() || value.is_unique_local() || value.is_unicast_link_local(),
  }
}

#[tauri::command]
fn start_nearby_transfer(token: String, payload: String) -> Result<NearbyTransfer, String> {
  if !valid_transfer_token(&token) {
    return Err("一次性传输令牌无效".to_string());
  }
  if payload.is_empty() || payload.len() > MAX_TRANSFER_BYTES {
    return Err("互传数据为空或超过 5 MB 限制".to_string());
  }

  let listener = TcpListener::bind(("0.0.0.0", 0)).map_err(|error| format!("无法开启局域网传输：{error}"))?;
  let port = listener.local_addr().map_err(|error| error.to_string())?.port();
  let host = local_ip_address::local_ip().map_err(|_| "没有找到可用的局域网地址，请先连接同一 Wi-Fi".to_string())?;
  if !private_or_local_ip(host) {
    return Err("当前网络没有可安全使用的局域网地址".to_string());
  }
  listener.set_nonblocking(true).map_err(|error| error.to_string())?;
  let expected_path = format!("/transfer/{token}");

  std::thread::spawn(move || {
    let started = std::time::Instant::now();
    while started.elapsed() < TRANSFER_LIFETIME {
      match listener.accept() {
        Ok((mut stream, _)) => {
          let _ = stream.set_read_timeout(Some(Duration::from_secs(3)));
          let mut request = [0_u8; 4096];
          let read = stream.read(&mut request).unwrap_or(0);
          let first_line = String::from_utf8_lossy(&request[..read]).lines().next().unwrap_or_default().to_string();
          if first_line == format!("GET {expected_path} HTTP/1.1") {
            let response_head = format!(
              "HTTP/1.1 200 OK\r\nContent-Type: application/octet-stream\r\nContent-Length: {}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
              payload.len()
            );
            let _ = stream.write_all(response_head.as_bytes());
            let _ = stream.write_all(payload.as_bytes());
            let _ = stream.flush();
            break;
          }
          let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n");
        }
        Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
          std::thread::sleep(Duration::from_millis(120));
        }
        Err(_) => break,
      }
    }
  });

  let expires_at = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()
    + TRANSFER_LIFETIME.as_millis();
  Ok(NearbyTransfer { host: host.to_string(), port, expires_at })
}

#[tauri::command]
fn receive_nearby_transfer(host: String, port: u16, token: String) -> Result<String, String> {
  if !valid_transfer_token(&token) || port == 0 {
    return Err("二维码中的连接信息无效".to_string());
  }
  let ip: IpAddr = host.parse().map_err(|_| "二维码中的局域网地址无效".to_string())?;
  if !private_or_local_ip(ip) {
    return Err("为安全起见，只允许连接同一局域网内的设备".to_string());
  }
  let mut stream = TcpStream::connect_timeout(&(ip, port).into(), Duration::from_secs(8))
    .map_err(|_| "无法连接发送设备，请确认两台设备在同一 Wi-Fi 且二维码未过期".to_string())?;
  stream.set_read_timeout(Some(Duration::from_secs(10))).map_err(|error| error.to_string())?;
  let request = format!("GET /transfer/{token} HTTP/1.1\r\nHost: {host}\r\nConnection: close\r\n\r\n");
  stream.write_all(request.as_bytes()).map_err(|error| error.to_string())?;
  let mut response = Vec::new();
  stream.take((MAX_TRANSFER_BYTES + 8192) as u64).read_to_end(&mut response).map_err(|error| error.to_string())?;
  let separator = response.windows(4).position(|window| window == b"\r\n\r\n").ok_or("发送设备返回了无效数据")?;
  let head = String::from_utf8_lossy(&response[..separator]);
  if !head.starts_with("HTTP/1.1 200") {
    return Err("这份二维码已使用、已过期或不正确".to_string());
  }
  let body = &response[separator + 4..];
  if body.is_empty() || body.len() > MAX_TRANSFER_BYTES {
    return Err("收到的数据为空或过大".to_string());
  }
  String::from_utf8(body.to_vec()).map_err(|_| "收到的数据编码无效".to_string())
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
fn keychain_entry(key: &str) -> Result<keyring::Entry, String> {
  keyring::Entry::new(KEYCHAIN_SERVICE, key).map_err(|error| format!("无法访问系统钥匙串：{error}"))
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[tauri::command]
fn save_device_secret(key: String, value: String) -> Result<(), String> {
  keychain_entry(&key)?.set_password(&value).map_err(|error| format!("无法写入系统钥匙串：{error}"))
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[tauri::command]
fn read_device_secret(key: String) -> Result<String, String> {
  keychain_entry(&key)?.get_password().map_err(|error| format!("无法读取系统钥匙串：{error}"))
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[tauri::command]
fn delete_device_secret(key: String) -> Result<(), String> {
  match keychain_entry(&key)?.delete_credential() {
    Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
    Err(error) => Err(format!("无法清理系统钥匙串：{error}")),
  }
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[tauri::command]
fn save_device_secret(_key: String, _value: String) -> Result<(), String> { Err("系统钥匙串仅支持 Apple 安装版".to_string()) }
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[tauri::command]
fn read_device_secret(_key: String) -> Result<String, String> { Err("系统钥匙串仅支持 Apple 安装版".to_string()) }
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[tauri::command]
fn delete_device_secret(_key: String) -> Result<(), String> { Ok(()) }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BiometricStatus { is_available: bool }

#[cfg(target_os = "macos")]
#[tauri::command]
fn macos_biometric_status() -> BiometricStatus {
  use objc2_local_authentication::{LAContext, LAPolicy};
  let context = unsafe { LAContext::new() };
  let available = unsafe { context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthenticationWithBiometrics).is_ok() };
  BiometricStatus { is_available: available }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn macos_biometric_status() -> BiometricStatus { BiometricStatus { is_available: false } }

#[cfg(target_os = "macos")]
#[tauri::command]
fn authenticate_macos(reason: String) -> Result<(), String> {
  use block2::RcBlock;
  use objc2::runtime::Bool;
  use objc2_foundation::{NSError, NSString};
  use objc2_local_authentication::{LAContext, LAPolicy};
  use std::sync::mpsc;

  if reason.trim().is_empty() { return Err("认证说明不能为空".to_string()); }
  let context = unsafe { LAContext::new() };
  unsafe { context.canEvaluatePolicy_error(LAPolicy::DeviceOwnerAuthenticationWithBiometrics) }
    .map_err(|_| "这台 Mac 没有可用的 Touch ID，或尚未录入指纹".to_string())?;
  let (sender, receiver) = mpsc::channel();
  let reply = RcBlock::new(move |success: Bool, _error: *mut NSError| {
    let _ = sender.send(success.as_bool());
  });
  unsafe {
    context.evaluatePolicy_localizedReason_reply(
      LAPolicy::DeviceOwnerAuthenticationWithBiometrics,
      &NSString::from_str(&reason),
      &reply,
    );
  }
  match receiver.recv_timeout(Duration::from_secs(60)) {
    Ok(true) => Ok(()),
    Ok(false) => Err("Touch ID 验证未通过或已取消".to_string()),
    Err(_) => Err("Touch ID 验证已超时".to_string()),
  }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn authenticate_macos(_reason: String) -> Result<(), String> { Err("Touch ID 命令仅支持 macOS".to_string()) }

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[tauri::command]
fn icloud_write(payload: String) -> Result<(), String> {
  use objc2_foundation::{NSString, NSUbiquitousKeyValueStore};
  if payload.len() > 800_000 { return Err("iCloud 同步包超过 800 KB，请先清理附件或改用文件备份".to_string()); }
  let store = NSUbiquitousKeyValueStore::defaultStore();
  store.setString_forKey(Some(&NSString::from_str(&payload)), &NSString::from_str(ICLOUD_KEY));
  store.synchronize();
  Ok(())
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[tauri::command]
fn icloud_read() -> Option<String> {
  use objc2_foundation::{NSString, NSUbiquitousKeyValueStore};
  let store = NSUbiquitousKeyValueStore::defaultStore();
  store.synchronize();
  store.stringForKey(&NSString::from_str(ICLOUD_KEY)).map(|value| value.to_string())
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
#[tauri::command]
fn icloud_synchronize() -> bool {
  objc2_foundation::NSUbiquitousKeyValueStore::defaultStore().synchronize()
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[tauri::command]
fn icloud_write(_payload: String) -> Result<(), String> { Err("iCloud 同步仅支持 Apple 安装版".to_string()) }
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[tauri::command]
fn icloud_read() -> Option<String> { None }
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
#[tauri::command]
fn icloud_synchronize() -> bool { false }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();
  #[cfg(mobile)]
  let builder = builder.plugin(tauri_plugin_biometric::init());
  builder
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_store::Builder::default().build())
    .setup(|app| {
      #[cfg(target_os = "macos")]
      {
        use tauri::menu::{MenuBuilder, SubmenuBuilder};
        let app_menu = SubmenuBuilder::new(app, "小黄提醒管家")
          .about_with_text("关于小黄提醒管家", None)
          .separator()
          .hide_with_text("隐藏小黄提醒管家")
          .hide_others_with_text("隐藏其他窗口")
          .show_all_with_text("显示全部")
          .separator()
          .quit_with_text("退出小黄提醒管家")
          .build()?;
        let file_menu = SubmenuBuilder::new(app, "文件")
          .close_window_with_text("关闭窗口")
          .build()?;
        let edit_menu = SubmenuBuilder::new(app, "编辑")
          .undo_with_text("撤销")
          .redo_with_text("重做")
          .separator()
          .cut_with_text("剪切")
          .copy_with_text("复制")
          .paste_with_text("粘贴")
          .select_all_with_text("全选")
          .build()?;
        let view_menu = SubmenuBuilder::new(app, "显示")
          .fullscreen_with_text("进入全屏幕")
          .build()?;
        let window_menu = SubmenuBuilder::new(app, "窗口")
          .minimize_with_text("最小化")
          .maximize_with_text("缩放")
          .build()?;
        let menu = MenuBuilder::new(app)
          .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
          .build()?;
        app.set_menu(menu)?;
      }
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      schedule_macos_reminders,
      start_nearby_transfer,
      receive_nearby_transfer,
      save_device_secret,
      read_device_secret,
      delete_device_secret,
      macos_biometric_status,
      authenticate_macos,
      icloud_write,
      icloud_read,
      icloud_synchronize,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
