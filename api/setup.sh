#!/bin/bash
# Setup script for niels-gpt API

set -e

echo "Setting up niels-gpt API environment..."

# Create virtual environment
echo "Creating virtual environment..."
python3 -m venv .venv

# Activate virtual environment
echo "Activating virtual environment..."
source .venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "Installing requirements..."
pip install -r requirements.txt

echo ""
echo "Setup complete!"
echo ""
echo "To activate the virtual environment:"
echo "  source .venv/bin/activate"
echo ""
echo "To run tests:"
echo "  pytest -v"
echo ""
echo "To start the server:"
echo "  python -m uvicorn app.main:app --reload --port 8000"
