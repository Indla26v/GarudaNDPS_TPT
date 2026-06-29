# Intelligence & Network Analytics Microservice

This is a Python-based FastAPI microservice designed to support complex intelligence operations in the Garuda NDPS Monitoring & Intelligence Management System.

## Features
- **Network Graph Analysis (`/analytics/network-graph`)**: Uses `networkx` to calculate degree centrality and PageRank on drug supply chains (`supply_chain_links` and `offenders`), automatically identifying key nodes (hubs, kingpins).
- **Contact Correlation (`/analytics/duplicate-contacts`)**: Identifies phone numbers and IMEIs registered across multiple offender files to detect shared supply networks.
- **Risk Score Predictor (`/analytics/predict-risk`)**: Heuristic-based analysis predicting suspect risk metrics using age, category, priors, and contraband size.

## Setup Instructions

1. Make sure Python 3.10+ is installed on your system.
2. Initialize virtual environment:
   ```bash
   python -m venv .venv
   ```
3. Activate the environment:
   - **Windows PowerShell**:
     ```powershell
     .venv\Scripts\Activate.ps1
     ```
   - **Windows Command Prompt**:
     ```cmd
     .venv\Scripts\activate.bat
     ```
   - **Linux / macOS**:
     ```bash
     source .venv/bin/activate
     ```
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the service:
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8082 --reload
   ```

The documentation UI will be available at: http://127.0.0.1:8082/docs
