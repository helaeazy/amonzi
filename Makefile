unexport VIRTUAL_ENV

UV ?= uv
PNPM ?= pnpm
PYTHON := $(UV) run python
CLIENT_DIR := src/client
SERVER_DIR := src/server
SERVER_PORT ?= 8000
CLIENT_PORT ?= 5173

.PHONY: help install server-install client-install server client quality test build \
	server-quality client-quality server-test client-test client-build

help:
	@echo "Available targets:"
	@echo "  install         - Install server and client dependencies"
	@echo "  server-install  - Install Python dependencies with uv"
	@echo "  client-install  - Install client dependencies with pnpm"
	@echo "  server          - Run the Django dev server"
	@echo "  client          - Run the Vite dev server"
	@echo "  quality         - Run backend and frontend checks"
	@echo "  test            - Run backend and frontend tests"
	@echo "  build           - Build the frontend"

install: server-install client-install

server-install:
	@$(UV) sync

client-install:
	@cd $(CLIENT_DIR) && $(PNPM) install

server: server-install
	@PYTHONPATH=$(SERVER_DIR) $(PYTHON) $(SERVER_DIR)/manage.py migrate
	@PYTHONPATH=$(SERVER_DIR) $(PYTHON) $(SERVER_DIR)/manage.py runserver 0.0.0.0:$(SERVER_PORT)

client: client-install
	@cd $(CLIENT_DIR) && $(PNPM) run dev -- --host 0.0.0.0 --port $(CLIENT_PORT)

server-quality: server-install
	@$(UV) run ruff check $(SERVER_DIR)
	@$(UV) run ruff format --check $(SERVER_DIR)
	@PYTHONPATH=$(SERVER_DIR) $(PYTHON) $(SERVER_DIR)/manage.py check

client-quality: client-install
	@cd $(CLIENT_DIR) && $(PNPM) run typecheck
	@cd $(CLIENT_DIR) && $(PNPM) run lint

quality: server-quality client-quality

server-test: server-install
	@PYTHONPATH=$(SERVER_DIR) $(UV) run pytest

client-test: client-install
	@cd $(CLIENT_DIR) && $(PNPM) run test -- --run

test: server-test client-test

client-build: client-install
	@cd $(CLIENT_DIR) && $(PNPM) run build

build: client-build
