#!/usr/bin/env python3
"""
AstralLink Productivity Layer Edge Case Testing
Tests error handling and edge cases for Calendar, Tasks, and Notes APIs
"""

import requests
import json

# Configuration
BASE_URL = "https://cosmic-chat-5.preview.emergentagent.com/api"
SESSION_TOKEN = "test-session-token-12345"
USER_ID = "test-user-12345"

# Headers for authenticated requests
AUTH_HEADERS = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json"
}

def test_edge_cases():
    """Test edge cases and error handling"""
    print("🧪 Testing Edge Cases and Error Handling...")
    
    # First create a server for testing
    server_data = {"name": "Edge Case Test Server"}
    response = requests.post(f"{BASE_URL}/servers", headers=AUTH_HEADERS, json=server_data)
    
    if response.status_code != 200:
        print("❌ Failed to create test server")
        return False
    
    server_id = response.json().get('id')
    print(f"✅ Test server created: {server_id}")
    
    # Test invalid server ID
    print("\n  Testing invalid server ID...")
    invalid_server_id = "invalid-server-id-12345"
    
    # Test calendar with invalid server
    response = requests.get(f"{BASE_URL}/servers/{invalid_server_id}/events", headers=AUTH_HEADERS)
    if response.status_code == 403:
        print("  ✅ Calendar API correctly rejects invalid server ID")
    else:
        print(f"  ❌ Calendar API should reject invalid server ID, got: {response.status_code}")
    
    # Test tasks with invalid server
    response = requests.get(f"{BASE_URL}/servers/{invalid_server_id}/tasks", headers=AUTH_HEADERS)
    if response.status_code == 403:
        print("  ✅ Tasks API correctly rejects invalid server ID")
    else:
        print(f"  ❌ Tasks API should reject invalid server ID, got: {response.status_code}")
    
    # Test notes with invalid server
    response = requests.get(f"{BASE_URL}/servers/{invalid_server_id}/notes", headers=AUTH_HEADERS)
    if response.status_code == 403:
        print("  ✅ Notes API correctly rejects invalid server ID")
    else:
        print(f"  ❌ Notes API should reject invalid server ID, got: {response.status_code}")
    
    # Test invalid event ID
    print("\n  Testing invalid event ID...")
    invalid_event_id = "invalid-event-id-12345"
    response = requests.get(f"{BASE_URL}/servers/{server_id}/events/{invalid_event_id}", headers=AUTH_HEADERS)
    if response.status_code == 404:
        print("  ✅ Calendar API correctly returns 404 for invalid event ID")
    else:
        print(f"  ❌ Calendar API should return 404 for invalid event ID, got: {response.status_code}")
    
    # Test invalid task ID
    print("\n  Testing invalid task ID...")
    invalid_task_id = "invalid-task-id-12345"
    response = requests.get(f"{BASE_URL}/servers/{server_id}/tasks/{invalid_task_id}", headers=AUTH_HEADERS)
    if response.status_code == 404:
        print("  ✅ Tasks API correctly returns 404 for invalid task ID")
    else:
        print(f"  ❌ Tasks API should return 404 for invalid task ID, got: {response.status_code}")
    
    # Test invalid note ID
    print("\n  Testing invalid note ID...")
    invalid_note_id = "invalid-note-id-12345"
    response = requests.get(f"{BASE_URL}/servers/{server_id}/notes/{invalid_note_id}", headers=AUTH_HEADERS)
    if response.status_code == 404:
        print("  ✅ Notes API correctly returns 404 for invalid note ID")
    else:
        print(f"  ❌ Notes API should return 404 for invalid note ID, got: {response.status_code}")
    
    # Test creating event with missing required fields
    print("\n  Testing event creation with missing required fields...")
    incomplete_event = {"title": "Test Event"}  # Missing start_time and end_time
    response = requests.post(f"{BASE_URL}/servers/{server_id}/events", headers=AUTH_HEADERS, json=incomplete_event)
    if response.status_code == 422:
        print("  ✅ Calendar API correctly validates required fields")
    else:
        print(f"  ❌ Calendar API should validate required fields, got: {response.status_code}")
    
    # Test creating task with missing required fields
    print("\n  Testing task creation with missing required fields...")
    incomplete_task = {}  # Missing title
    response = requests.post(f"{BASE_URL}/servers/{server_id}/tasks", headers=AUTH_HEADERS, json=incomplete_task)
    if response.status_code == 422:
        print("  ✅ Tasks API correctly validates required fields")
    else:
        print(f"  ❌ Tasks API should validate required fields, got: {response.status_code}")
    
    # Test creating note with missing required fields
    print("\n  Testing note creation with missing required fields...")
    incomplete_note = {}  # Missing title
    response = requests.post(f"{BASE_URL}/servers/{server_id}/notes", headers=AUTH_HEADERS, json=incomplete_note)
    if response.status_code == 422:
        print("  ✅ Notes API correctly validates required fields")
    else:
        print(f"  ❌ Notes API should validate required fields, got: {response.status_code}")
    
    # Test unauthenticated requests
    print("\n  Testing unauthenticated requests...")
    no_auth_headers = {"Content-Type": "application/json"}
    
    response = requests.get(f"{BASE_URL}/servers/{server_id}/events", headers=no_auth_headers)
    if response.status_code == 401:
        print("  ✅ Calendar API correctly requires authentication")
    else:
        print(f"  ❌ Calendar API should require authentication, got: {response.status_code}")
    
    response = requests.get(f"{BASE_URL}/servers/{server_id}/tasks", headers=no_auth_headers)
    if response.status_code == 401:
        print("  ✅ Tasks API correctly requires authentication")
    else:
        print(f"  ❌ Tasks API should require authentication, got: {response.status_code}")
    
    response = requests.get(f"{BASE_URL}/servers/{server_id}/notes", headers=no_auth_headers)
    if response.status_code == 401:
        print("  ✅ Notes API correctly requires authentication")
    else:
        print(f"  ❌ Notes API should require authentication, got: {response.status_code}")
    
    print("\n✅ Edge case testing completed!")
    return True

if __name__ == "__main__":
    test_edge_cases()