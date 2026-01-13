# Kibana Fixture Generator Makefile
#
# This Makefile orchestrates Docker-based test fixture generation using Kibana's
# LensConfigBuilder API. It uses pre-built base images from GHCR that contain
# Kibana with all dependencies bootstrapped.

# Configuration
KIBANA_VERSION ?= v9.2.2
DOCKER_IMAGE ?= ghcr.io/strawgate/kb-yaml-to-lens-fixtures/kibana-base:$(KIBANA_VERSION)
OUTPUT_DIR ?= output

# Default target
.PHONY: help
help: ## Show this help
	@echo "Kibana Fixture Generator"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# CI target - run all checks
.PHONY: ci
ci: pull typecheck test ## Run CI checks (pull + typecheck + test)

# Pull pre-built Docker image
.PHONY: pull
pull: ## Pull pre-built base image from GHCR
	@echo "Pulling $(DOCKER_IMAGE)..."
	docker pull $(DOCKER_IMAGE)

# Build base image locally (for testing changes)
.PHONY: build-base
build-base: ## Build base image locally
	@echo "Building base image for $(KIBANA_VERSION)..."
	docker build \
		--build-arg KIBANA_VERSION=$(KIBANA_VERSION) \
		-t $(DOCKER_IMAGE) \
		-f Dockerfile.base \
		.

# Build and flatten base image locally (smaller image, slower build)
.PHONY: build-base-flat
build-base-flat: ## Build and flatten base image locally (reduces size)
	@echo "Building base image for $(KIBANA_VERSION)..."
	docker build \
		--build-arg KIBANA_VERSION=$(KIBANA_VERSION) \
		-t $(DOCKER_IMAGE):build \
		-f Dockerfile.base \
		.
	@echo "Original image size:"
	@docker images $(DOCKER_IMAGE):build --format "{{.Size}}"
	@echo "Flattening image to reduce size..."
	@CONTAINER_ID=$$(docker create $(DOCKER_IMAGE):build) && \
		docker export "$$CONTAINER_ID" | docker import \
			--change 'ENV NODE_OPTIONS=--max-old-space-size=8192' \
			--change 'ENV KIBANA_VERSION=$(KIBANA_VERSION)' \
			--change 'USER fixture' \
			--change 'WORKDIR /kibana' \
			- $(DOCKER_IMAGE) && \
		docker rm "$$CONTAINER_ID" > /dev/null
	@echo "Flattened image size:"
	@docker images $(DOCKER_IMAGE) --format "{{.Size}}"
	@docker rmi $(DOCKER_IMAGE):build > /dev/null 2>&1 || true

# Generate all fixtures
.PHONY: run
run: ## Generate all fixtures
	@echo "Generating fixtures for $(KIBANA_VERSION)..."
	@mkdir -p $(OUTPUT_DIR)
	docker run --rm \
		-e KIBANA_VERSION=$(KIBANA_VERSION) \
		-e NODE_OPTIONS="--max-old-space-size=8192" \
		-v $(PWD)/examples:/kibana/examples:ro \
		-v $(PWD)/generator-utils.ts:/kibana/generator-utils.ts:ro \
		-v $(PWD)/generate-all.js:/kibana/generate-all.js:ro \
		-v $(PWD)/dataviews-mock.js:/kibana/dataviews-mock.js:ro \
		-v $(PWD)/$(OUTPUT_DIR):/kibana/output \
		$(DOCKER_IMAGE) \
		tsx generate-all.js

# Run a specific example
.PHONY: run-example
run-example: ## Run a specific example (usage: make run-example EXAMPLE=metric-basic.ts)
ifndef EXAMPLE
	$(error EXAMPLE is required. Usage: make run-example EXAMPLE=metric-basic.ts)
endif
	@echo "Running example: $(EXAMPLE)"
	@mkdir -p $(OUTPUT_DIR)
	docker run --rm \
		-e KIBANA_VERSION=$(KIBANA_VERSION) \
		-e NODE_OPTIONS="--max-old-space-size=8192" \
		-v $(PWD)/examples:/kibana/examples:ro \
		-v $(PWD)/generator-utils.ts:/kibana/generator-utils.ts:ro \
		-v $(PWD)/generate-all.js:/kibana/generate-all.js:ro \
		-v $(PWD)/dataviews-mock.js:/kibana/dataviews-mock.js:ro \
		-v $(PWD)/$(OUTPUT_DIR):/kibana/output \
		$(DOCKER_IMAGE) \
		tsx examples/$(EXAMPLE)

# Type check TypeScript files
.PHONY: typecheck
typecheck: ## Run TypeScript type checking
	@echo "Running type check..."
	docker run --rm \
		-v $(PWD)/examples:/kibana/examples:ro \
		-v $(PWD)/generator-utils.ts:/kibana/generator-utils.ts:ro \
		-v $(PWD)/tsconfig.json:/kibana/tsconfig.json:ro \
		$(DOCKER_IMAGE) \
		tsc --noEmit

# Test that LensConfigBuilder can be imported
.PHONY: test
test: ## Test LensConfigBuilder import
	@echo "Testing LensConfigBuilder import..."
	docker run --rm \
		$(DOCKER_IMAGE) \
		node -e "import('@kbn/lens-embeddable-utils/config_builder').then(() => console.log('✓ LensConfigBuilder imported successfully'))"

# Open shell in container
.PHONY: shell
shell: ## Open a shell in the container for debugging
	docker run --rm -it \
		-e KIBANA_VERSION=$(KIBANA_VERSION) \
		-v $(PWD)/examples:/kibana/examples:ro \
		-v $(PWD)/generator-utils.ts:/kibana/generator-utils.ts:ro \
		-v $(PWD)/generate-all.js:/kibana/generate-all.js:ro \
		-v $(PWD)/dataviews-mock.js:/kibana/dataviews-mock.js:ro \
		-v $(PWD)/$(OUTPUT_DIR):/kibana/output \
		$(DOCKER_IMAGE) \
		bash

# Clean generated output
.PHONY: clean
clean: ## Remove generated output files
	@echo "Cleaning output directory..."
	rm -rf $(OUTPUT_DIR)/*
