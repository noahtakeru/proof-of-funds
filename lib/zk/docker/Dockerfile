FROM node:18-alpine as base

# Install necessary dependencies
RUN apk add --no-cache git build-base python3 bash

# Set up working directory
WORKDIR /app

# Create circom builder stage
FROM base as circom-builder

# Install Rust for circom compilation
RUN apk add --no-cache rustup
RUN rustup-init -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# Get circom
RUN git clone https://github.com/iden3/circom.git
WORKDIR /app/circom
RUN cargo build --release
RUN cargo install --path circom

# Main stage
FROM base

# Copy circom binary from builder stage
COPY --from=circom-builder /root/.cargo/bin/circom /usr/local/bin/circom

# Copy package files
COPY package*.json ./

# Install project dependencies
RUN npm install

# Copy the zk directory
COPY lib/zk ./lib/zk/

# Add entrypoint script
COPY ./lib/zk/docker-entrypoint.sh ./
RUN chmod +x ./docker-entrypoint.sh

ENTRYPOINT ["./docker-entrypoint.sh"]