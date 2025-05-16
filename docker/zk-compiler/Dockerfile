FROM node:18-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Rust and build Circom from source
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Clone and build Circom
RUN git clone https://github.com/iden3/circom.git && \
    cd circom && \
    git checkout v2.1.8 && \
    cargo build --release && \
    cp target/release/circom /usr/local/bin/ && \
    cd .. && rm -rf circom

# Install snarkjs
RUN npm install -g snarkjs@0.7.0

# Set up working directory
WORKDIR /circuits

# Copy entrypoint script
COPY entrypoint.sh /
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]