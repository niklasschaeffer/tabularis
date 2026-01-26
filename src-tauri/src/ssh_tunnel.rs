use ssh2::Session;
use std::collections::HashMap;
use std::io::{ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::thread;
use std::time::Duration;

#[derive(Clone)]
enum TunnelBackend {
    LibSsh2(Arc<AtomicBool>),
    SystemSsh(Arc<Mutex<Child>>),
}

#[derive(Clone)]
pub struct SshTunnel {
    pub local_port: u16,
    backend: TunnelBackend,
}

pub static TUNNELS: OnceLock<Mutex<HashMap<String, SshTunnel>>> = OnceLock::new();

pub fn get_tunnels() -> &'static Mutex<HashMap<String, SshTunnel>> {
    TUNNELS.get_or_init(|| Mutex::new(HashMap::new()))
}

impl SshTunnel {
    pub fn new(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_password: Option<&str>,
        ssh_key_file: Option<&str>,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<Self, String> {
        let use_system_ssh = ssh_password.is_none();
        println!(
            "[SSH Tunnel] New Request: Host={}, Port={}, User={}, SystemMode={}",
            ssh_host, ssh_port, ssh_user, use_system_ssh
        );

        let local_port = {
            let listener = TcpListener::bind("127.0.0.1:0")
                .map_err(|e| format!("Failed to find free local port: {}", e))?;
            listener.local_addr().unwrap().port()
        };
        println!("[SSH Tunnel] Assigned Local Port: {}", local_port);

        if use_system_ssh {
            return Self::new_system_ssh(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_key_file,
                remote_host,
                remote_port,
                local_port,
            );
        } else {
            return Self::new_libssh2(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_password,
                ssh_key_file,
                remote_host,
                remote_port,
                local_port,
            );
        }
    }

    fn new_system_ssh(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_key_file: Option<&str>,
        remote_host: &str,
        remote_port: u16,
        local_port: u16,
    ) -> Result<Self, String> {
        let mut args = vec![
            "-N".to_string(), // No remote command
            "-L".to_string(),
            // Explicitly bind to 127.0.0.1 to avoid ambiguity or public binding
            format!("127.0.0.1:{}:{}:{}", local_port, remote_host, remote_port),
        ];

        let destination = if !ssh_user.trim().is_empty() {
            format!("{}@{}", ssh_user, ssh_host)
        } else {
            ssh_host.to_string()
        };

        if ssh_port != 22 {
            args.push("-p".to_string());
            args.push(ssh_port.to_string());
        }

        if let Some(key) = ssh_key_file {
            if !key.trim().is_empty() {
                args.push("-i".to_string());
                args.push(key.to_string());
            }
        }

        args.push("-o".to_string());
        args.push("StrictHostKeyChecking=no".to_string());

        args.push(destination);

        println!("[SSH Tunnel] Executing: ssh {:?}", args);

        let mut child = Command::new("ssh")
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                format!(
                    "Failed to launch system ssh: {}. Ensure 'ssh' is in PATH.",
                    e
                )
            })?;

        thread::sleep(Duration::from_millis(500));

        let child_arc = Arc::new(Mutex::new(child));
        {
            let mut c = child_arc.lock().unwrap();
            if let Ok(Some(status)) = c.try_wait() {
                let mut err_msg = String::new();
                if let Some(mut stderr) = c.stderr.take() {
                    stderr.read_to_string(&mut err_msg).ok();
                }
                return Err(format!(
                    "SSH tunnel process exited early with status: {}. Error: {}",
                    status, err_msg
                ));
            }
        }

        Ok(Self {
            local_port,
            backend: TunnelBackend::SystemSsh(child_arc),
        })
    }

    fn new_libssh2(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_password: Option<&str>,
        ssh_key_file: Option<&str>,
        remote_host: &str,
        remote_port: u16,
        local_port: u16,
    ) -> Result<Self, String> {
        println!(
            "[SSH Tunnel] LibSsh2 connecting to {}:{}",
            ssh_host, ssh_port
        );
        let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port))
            .map_err(|e| format!("Failed to bind local port {}: {}", local_port, e))?;

        let tcp = TcpStream::connect(format!("{}:{}", ssh_host, ssh_port))
            .map_err(|e| format!("Failed to connect to SSH server: {}", e))?;

        let mut sess = Session::new().unwrap();
        sess.set_tcp_stream(tcp);
        sess.handshake()
            .map_err(|e| format!("SSH handshake failed: {}", e))?;

        if let Some(key_path) = ssh_key_file {
            if !key_path.trim().is_empty() {
                sess.userauth_pubkey_file(
                    ssh_user,
                    None,
                    std::path::Path::new(key_path),
                    ssh_password,
                )
                .map_err(|e| format!("SSH key auth failed: {}", e))?;
            } else {
                if let Some(pwd) = ssh_password {
                    sess.userauth_password(ssh_user, pwd)
                        .map_err(|e| format!("SSH password auth failed: {}", e))?;
                } else {
                    return Err("No SSH credentials provided".to_string());
                }
            }
        } else if let Some(pwd) = ssh_password {
            sess.userauth_password(ssh_user, pwd)
                .map_err(|e| format!("SSH password auth failed: {}", e))?;
        } else {
            sess.userauth_agent(ssh_user)
                .map_err(|e| format!("SSH agent auth failed: {}", e))?;
        }

        if !sess.authenticated() {
            return Err("SSH authentication failed".to_string());
        }

        sess.set_timeout(10);

        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        let sess = Arc::new(Mutex::new(sess));
        let remote_host = remote_host.to_string();

        thread::spawn(move || {
            for stream in listener.incoming() {
                if !running_clone.load(Ordering::Relaxed) {
                    break;
                }

                match stream {
                    Ok(local_stream) => {
                        let sess = sess.clone();
                        let r_host = remote_host.clone();
                        let running_inner = running_clone.clone();

                        thread::spawn(move || {
                            let mut sess_lock = match sess.lock() {
                                Ok(l) => l,
                                Err(_) => return,
                            };

                            let mut channel =
                                match sess_lock.channel_direct_tcpip(&r_host, remote_port, None) {
                                    Ok(c) => c,
                                    Err(e) => {
                                        eprintln!("Failed to open SSH channel: {}", e);
                                        return;
                                    }
                                };

                            let mut local_stream = local_stream;
                            if let Err(_) = local_stream.set_nonblocking(true) {
                                return;
                            }

                            let mut buf = [0u8; 8192];
                            let mut active = true;

                            while active && running_inner.load(Ordering::Relaxed) {
                                let mut did_work = false;

                                match local_stream.read(&mut buf) {
                                    Ok(0) => {
                                        active = false;
                                        break;
                                    }
                                    Ok(n) => {
                                        if channel.write_all(&buf[..n]).is_err() {
                                            active = false;
                                            break;
                                        }
                                        did_work = true;
                                    }
                                    Err(ref e) if e.kind() == ErrorKind::WouldBlock => {}
                                    Err(_) => {
                                        active = false;
                                        break;
                                    }
                                }

                                match channel.read(&mut buf) {
                                    Ok(0) => {
                                        active = false;
                                        break;
                                    }
                                    Ok(n) => {
                                        if local_stream.write_all(&buf[..n]).is_err() {
                                            active = false;
                                            break;
                                        }
                                        did_work = true;
                                    }
                                    Err(_) => {}
                                }

                                if !did_work {
                                    thread::sleep(Duration::from_millis(1));
                                }
                            }
                        });
                    }
                    Err(_) => {}
                }
            }
        });

        Ok(Self {
            local_port,
            backend: TunnelBackend::LibSsh2(running),
        })
    }

    pub fn stop(&self) {
        match &self.backend {
            TunnelBackend::LibSsh2(running) => {
                running.store(false, Ordering::Relaxed);
            }
            TunnelBackend::SystemSsh(child) => {
                if let Ok(mut c) = child.lock() {
                    let _ = c.kill();
                }
            }
        }
    }
}
