use std::env;
use std::fs;
use std::path::Path;
use std::sync::Arc;

use anyhow::{anyhow, bail, Context, Result};
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;
use tokio_vsock::{VsockAddr, VsockStream};

const DEFAULT_BIND_ADDR: &str = "0.0.0.0:9999";
const DEFAULT_ENCLAVE_CID: u32 = 16;
const DEFAULT_ENCLAVE_PORT: u32 = 5005;
const DEFAULT_PROVENANCE_PATH: &str = "aws-deploy/provenance.example.json";
const DEFAULT_MEASUREMENTS_PATH: &str = "aws-deploy/measurements.example.json";

#[derive(Clone)]
struct AppState {
    config: Arc<Config>,
}

#[derive(Clone)]
struct Config {
    workload: WorkloadMetadata,
    enclave_cid: u32,
    enclave_port: u32,
}

#[derive(Clone, Serialize)]
struct WorkloadMetadata {
    service: String,
    release_id: String,
    workload_id: String,
    repo_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_repo_url: Option<String>,
    oci_image_digest: String,
    eif_pcrs: PcrSet,
}

#[derive(Clone, Debug, Serialize)]
struct PcrSet {
    pcr0: String,
    pcr1: String,
    pcr2: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pcr8: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProvenanceManifest {
    service: Option<String>,
    release_id: Option<String>,
    workload_id: String,
    repo_url: String,
    #[serde(default)]
    project_repo_url: Option<String>,
    oci_image_digest: String,
    pcr0: String,
    pcr1: String,
    pcr2: String,
    #[serde(default)]
    pcr8: Option<String>,
}

#[derive(Deserialize)]
struct AttestationRequest {
    #[serde(rename = "NONCE")]
    nonce: String,
}

#[derive(Serialize)]
struct AttestationResponse {
    version: &'static str,
    service: String,
    release_id: String,
    platform: &'static str,
    nonce: String,
    claims: Claims,
    evidence: Evidence,
    #[serde(skip_serializing_if = "Option::is_none")]
    facts_url: Option<String>,
}

#[derive(Serialize)]
struct Claims {
    #[serde(skip_serializing_if = "Option::is_none")]
    workload_pubkey: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    identity_hint: Option<String>,
}

#[derive(Serialize)]
struct Evidence {
    #[serde(rename = "type")]
    evidence_type: &'static str,
    payload: EvidencePayload,
}

#[derive(Serialize)]
struct EvidencePayload {
    nitro_attestation_doc_b64: String,
}

#[derive(Serialize)]
struct EnclaveRequest<'a> {
    action: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    nonce_hex: Option<&'a str>,
}

#[derive(Deserialize)]
struct EnclaveResponse {
    #[serde(default)]
    content_type: Option<String>,
    #[serde(default)]
    html: Option<String>,
    #[serde(default)]
    attestation_doc_b64: Option<String>,
}

struct AppError(anyhow::Error);

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let body = Json(serde_json::json!({
            "error": self.0.to_string()
        }));
        (StatusCode::BAD_GATEWAY, body).into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(value: E) -> Self {
        Self(value.into())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    let bind_addr = env::var("BIND_ADDR").unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_string());
    let enclave_cid = read_u32_env("ENCLAVE_CID", DEFAULT_ENCLAVE_CID)?;
    let enclave_port = read_u32_env("ENCLAVE_PORT", DEFAULT_ENCLAVE_PORT)?;
    let provenance_path = env::var("PROVENANCE_PATH").unwrap_or_else(|_| DEFAULT_PROVENANCE_PATH.to_string());
    let measurements_path = env::var("MEASUREMENTS_PATH").ok().or_else(|| {
        if Path::new(DEFAULT_MEASUREMENTS_PATH).exists() {
            Some(DEFAULT_MEASUREMENTS_PATH.to_string())
        } else {
            None
        }
    });
    let workload = load_workload_metadata(&provenance_path, measurements_path.as_deref())?;

    let state = AppState {
        config: Arc::new(Config {
            workload,
            enclave_cid,
            enclave_port,
        }),
    };

    let app = Router::new()
        .route("/", get(index))
        .route("/.well-known/attestation", post(attestation))
        .with_state(state.clone());

    let listener = TcpListener::bind(&bind_addr)
        .await
        .with_context(|| format!("Could not bind parent proxy to {bind_addr}"))?;

    println!(
        "Parent proxy listening on http://{} and forwarding to vsock://{}:{}",
        bind_addr, state.config.enclave_cid, state.config.enclave_port
    );
    println!("Workload ID: {}", state.config.workload.workload_id);
    println!("Repo URL: {}", state.config.workload.repo_url);
    println!("Provenance file: {provenance_path}");
    if let Some(path) = measurements_path {
        println!("Measurements file: {path}");
    }

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .context("Parent proxy server failed")?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        let mut signal =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).unwrap();
        signal.recv().await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

async fn index(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let html = request_enclave_html(state.config.enclave_cid, state.config.enclave_port)
        .await
        .context("Could not fetch landing page from enclave")?;
    Ok(Html(html))
}

async fn attestation(
    State(state): State<AppState>,
    Json(request): Json<AttestationRequest>,
) -> Result<Json<AttestationResponse>, AppError> {
    let nonce = normalize_nonce_hex(&request.nonce)?;
    let attestation_doc_b64 =
        request_attestation_doc(&nonce, state.config.enclave_cid, state.config.enclave_port)
            .await
            .context("Could not fetch attestation document from enclave")?;

    Ok(Json(AttestationResponse {
        version: "ztinfra-attestation/v1",
        service: state.config.workload.service.clone(),
        release_id: state.config.workload.release_id.clone(),
        platform: "aws_nitro_eif",
        nonce,
        claims: Claims {
            workload_pubkey: None,
            identity_hint: None,
        },
        evidence: Evidence {
            evidence_type: "aws_nitro_attestation_doc",
            payload: EvidencePayload {
                nitro_attestation_doc_b64: attestation_doc_b64,
            },
        },
        facts_url: env::var("FACTS_URL").ok(),
    }))
}

async fn request_attestation_doc(
    nonce: &str,
    enclave_cid: u32,
    enclave_port: u32,
) -> Result<String> {
    let response = request_enclave(
        EnclaveRequest {
            action: "attestation",
            nonce_hex: Some(nonce),
        },
        enclave_cid,
        enclave_port,
    )
    .await?;

    let attestation_doc_b64 = response
        .attestation_doc_b64
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("Enclave did not return an attestation document"))?;

    Ok(attestation_doc_b64)
}

async fn request_enclave_html(enclave_cid: u32, enclave_port: u32) -> Result<String> {
    let response = request_enclave(
        EnclaveRequest {
            action: "index",
            nonce_hex: None,
        },
        enclave_cid,
        enclave_port,
    )
    .await?;

    if let Some(content_type) = response.content_type.as_deref() {
        if content_type != "text/html; charset=utf-8" {
            bail!("Enclave returned unexpected content type: {content_type}");
        }
    }

    let html = response
        .html
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("Enclave did not return an HTML page"))?;

    Ok(html)
}

async fn request_enclave(
    request_body: EnclaveRequest<'_>,
    enclave_cid: u32,
    enclave_port: u32,
) -> Result<EnclaveResponse> {
    let addr = VsockAddr::new(enclave_cid, enclave_port);
    let mut stream = VsockStream::connect(addr)
        .await
        .with_context(|| format!("Could not connect to enclave at {enclave_cid}:{enclave_port}"))?;

    let request = serde_json::to_string(&request_body)?;
    stream
        .write_all(request.as_bytes())
        .await
        .context("Could not write request to enclave")?;
    stream
        .write_all(b"\n")
        .await
        .context("Could not finalize request to enclave")?;

    let mut reader = BufReader::new(stream);
    let mut response_line = String::new();
    let read = reader
        .read_line(&mut response_line)
        .await
        .context("Could not read response from enclave")?;

    if read == 0 {
        bail!("Enclave closed connection without returning a response");
    }

    let response: EnclaveResponse =
        serde_json::from_str(response_line.trim()).context("Enclave response is not valid JSON")?;
    Ok(response)
}

fn read_u32_env(key: &str, default: u32) -> Result<u32> {
    match env::var(key) {
        Ok(value) => value
            .parse::<u32>()
            .with_context(|| format!("Invalid integer in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn load_workload_metadata(provenance_path: &str, measurements_path: Option<&str>) -> Result<WorkloadMetadata> {
    let provenance = load_provenance_manifest(provenance_path)?;
    let provenance_pcrs = PcrSet {
        pcr0: normalize_pcr_hex(&provenance.pcr0)?,
        pcr1: normalize_pcr_hex(&provenance.pcr1)?,
        pcr2: normalize_pcr_hex(&provenance.pcr2)?,
        pcr8: provenance.pcr8.as_deref().map(normalize_pcr_hex).transpose()?,
    };

    if let Some(path) = measurements_path {
        let measured_pcrs = load_measurement_pcrs(path)?;
        if provenance_pcrs.pcr0 != measured_pcrs.pcr0
            || provenance_pcrs.pcr1 != measured_pcrs.pcr1
            || provenance_pcrs.pcr2 != measured_pcrs.pcr2
            || provenance_pcrs.pcr8 != measured_pcrs.pcr8
        {
            bail!("Provenance manifest PCRs do not match measurements file {path}");
        }
    }

    Ok(WorkloadMetadata {
        service: provenance
            .service
            .unwrap_or_else(|| provenance.repo_url.rsplit('/').next().unwrap_or("unknown-service").to_string()),
        release_id: provenance.release_id.unwrap_or_else(|| provenance.workload_id.clone()),
        workload_id: provenance.workload_id,
        repo_url: provenance.repo_url,
        project_repo_url: provenance.project_repo_url,
        oci_image_digest: provenance.oci_image_digest,
        eif_pcrs: provenance_pcrs,
    })
}

fn load_provenance_manifest(path: &str) -> Result<ProvenanceManifest> {
    let raw = fs::read_to_string(path).with_context(|| format!("Could not read {path}"))?;
    serde_json::from_str(&raw).with_context(|| format!("Could not parse provenance manifest {path}"))
}

fn load_measurement_pcrs(path: &str) -> Result<PcrSet> {
    let raw = fs::read_to_string(path).with_context(|| format!("Could not read {path}"))?;
    let value: Value = serde_json::from_str(&raw).with_context(|| format!("Could not parse {path}"))?;
    let measurements = value.get("Measurements").or_else(|| value.get("measurements"));
    let eif_pcrs = value.get("eif_pcrs").or_else(|| value.get("pcrs"));

    Ok(PcrSet {
        pcr0: read_pcr(&value, measurements, eif_pcrs, "pcr0", "PCR0")
            .context("Missing PCR0 in measurements file")?,
        pcr1: read_pcr(&value, measurements, eif_pcrs, "pcr1", "PCR1")
            .context("Missing PCR1 in measurements file")?,
        pcr2: read_pcr(&value, measurements, eif_pcrs, "pcr2", "PCR2")
            .context("Missing PCR2 in measurements file")?,
        pcr8: read_pcr(&value, measurements, eif_pcrs, "pcr8", "PCR8").ok(),
    })
}

fn read_pcr(
    root: &Value,
    measurements: Option<&Value>,
    eif_pcrs: Option<&Value>,
    lower_key: &str,
    upper_key: &str,
) -> Result<String> {
    let candidate = read_string(root, lower_key)
        .or_else(|| measurements.and_then(|value| read_string(value, upper_key)))
        .or_else(|| eif_pcrs.and_then(|value| read_string(value, lower_key)));

    let value = candidate.ok_or_else(|| anyhow!("No {lower_key} value found"))?;
    normalize_pcr_hex(&value)
}

fn read_string(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(ToOwned::to_owned)
}

fn normalize_nonce_hex(value: &str) -> Result<String> {
    let clean = value.trim().to_lowercase();
    if clean.is_empty() {
        bail!("NONCE must be a non-empty hex string");
    }
    if clean.len() % 2 != 0 || !clean.chars().all(|ch| ch.is_ascii_hexdigit()) {
        bail!("NONCE must be an even-length hex string");
    }
    Ok(clean)
}

fn normalize_pcr_hex(value: &str) -> Result<String> {
    let clean = value.trim().trim_start_matches("0x").to_lowercase();
    if clean.len() != 96 || !clean.chars().all(|ch| ch.is_ascii_hexdigit()) {
        bail!("Invalid PCR value: {value}");
    }
    Ok(clean)
}
