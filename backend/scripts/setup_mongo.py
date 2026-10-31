"""Check the MongoDB Atlas connection, then create all collections and push the app data.
Run from backend/:  .venv\\Scripts\\python scripts\\setup_mongo.py   (Windows)
                    .venv/bin/python scripts/setup_mongo.py         (macOS / Linux)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services import mongo_manager  # noqa: E402


def main() -> int:
    print("====================================================")
    print("   REMIX YARN TRADING COSTING - MONGODB INITIALIZER  ")
    print("====================================================")
    outbound_ip = mongo_manager.get_outbound_ip()
    print(f"Current outbound server IP: {outbound_ip}")
    print(f"Target database: {mongo_manager.DB_NAME}")
    print(f"Total collections to set up: {len(mongo_manager.DASHBOARD_TABLE_DEFINITIONS)}")
    print("----------------------------------------------------")
    print("Testing MongoDB connection...")

    conn = mongo_manager.check_mongo_connection()
    if not conn["connected"]:
        print("MongoDB connection FAILED")
        print(f"   Error: {conn['errorMessage']}")
        print(f"   Masked URI: {conn['maskedUri']}")
        if conn.get("instruction"):
            print(f"\nACTION REQUIRED: {conn['instruction']}")
        print("\nThe application keeps working with local file storage (backend/storage) as fallback.")
        return 1

    print(f"MongoDB connection OK (latency {conn.get('latencyMs')} ms)")
    print(f"   Databases in cluster: {', '.join(conn.get('databases') or [])}")
    print("\nCreating collections & pushing application data...\n")
    tables = mongo_manager.create_all_mongo_tables()
    for t in tables["tables"]:
        print(f"   {t['name']:<26} {t['status']:<9} docs={t['documentCount']}")
    result = mongo_manager.push_all_application_data()
    print("====================================================")
    for name, count in result["itemsPushed"].items():
        print(f"Pushed to collection: {name:<26} | records: {count:>5}")
    print("----------------------------------------------------")
    print(f"Summary: {result['message']}")
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
