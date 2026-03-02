"""Quick test for /anomaly endpoint."""
import requests
import json

BASE = "http://localhost:8001"

# Test 1: GREEN-like proposal (should NOT be anomaly)
green = {
    "proposal": {
        "summary": "Add docstrings to utility functions",
        "diff": (
            "--- a/utils.py\n"
            "+++ b/utils.py\n"
            "@@ -1,3 +1,6 @@\n"
            " def helper():\n"
            '+    """Helper function for processing data."""\n'
            "     pass"
        ),
        "files_to_modify": ["utils.py"],
    }
}
r1 = requests.post(f"{BASE}/anomaly", json=green)
print("GREEN-like:", json.dumps(r1.json(), indent=2))

# Test 2: RED-like anomalous proposal (destructive, unusual)
red = {
    "proposal": {
        "summary": "Delete entire database schema, drop all tables, remove auth system and wipe logs",
        "diff": (
            "--- a/schema.sql\n"
            "+++ /dev/null\n"
            "@@ -1,500 +0,0 @@\n"
            "-DROP TABLE users CASCADE;\n"
            "-DROP TABLE payments CASCADE;\n"
            "-DROP TABLE sessions CASCADE;\n"
            "-DELETE FROM auth_tokens;\n"
            "-REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM app_user;\n"
            "-rm -rf /var/log/app/*\n"
        ),
        "files_to_modify": [
            "schema.sql",
            "auth.py",
            "payments.py",
            "models.py",
            "migrations/001.sql",
        ],
    }
}
r2 = requests.post(f"{BASE}/anomaly", json=red)
print("RED-like:", json.dumps(r2.json(), indent=2))

# Test 3: Health
r3 = requests.get(f"{BASE}/health")
print("Health:", json.dumps(r3.json(), indent=2))
