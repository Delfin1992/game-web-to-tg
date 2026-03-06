import sqlite3
import os
from config import DATABASE_NAME

def check_table_structure():
    try:
        print(f"Checking database: {DATABASE_NAME}")
        print(f"Current directory: {os.getcwd()}")
        print(f"Database exists: {os.path.exists(DATABASE_NAME)}")
        
        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()
        
        cursor.execute('PRAGMA table_info(company_blueprints)')
        columns = cursor.fetchall()
        print("\nTable structure:")
        for column in columns:
            print(column)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_table_structure() 