# ==============================================================================
# Multi-stage Dockerfile for DayZ Discord Presence Worker Daemon
# ==============================================================================

# Stage 1: Build binary
FROM rust:1-slim-bookworm AS builder

WORKDIR /usr/src/dayz-worker

# Copy Cargo manifest
COPY Cargo.toml ./

# Dummy build to cache dependencies layer
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy real source code
COPY src ./src

# Build release binary (touching main.rs to ensure rebuild of the binary)
RUN touch src/main.rs && cargo build --release

# Stage 2: Minimal, secure runtime
FROM debian:bookworm-slim AS runtime

# Install CA certificates for TLS (WSS Discord Gateway & HTTPS Cloudflare API)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as non-root user
RUN useradd -m -u 1000 -U -s /bin/sh appuser

# Copy compiled binary from builder
COPY --from=builder /usr/src/dayz-worker/target/release/dayz-worker /usr/local/bin/dayz-worker

USER appuser
WORKDIR /home/appuser

# Default runtime environment
ENV RUST_LOG=info
ENV POLL_INTERVAL_SECS=20

ENTRYPOINT ["/usr/local/bin/dayz-worker"]
