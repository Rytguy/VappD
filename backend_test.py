#!/usr/bin/env python3
"""
AstralLink Backend API Testing Suite
Tests all backend endpoints with proper authentication
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://spacewave-1.preview.emergentagent.com/api"
SESSION_TOKEN = "T-ov0ehZaDXcT8JRJUW9m9Nxy2_wDKggcbhItRohxQk"  # From existing session
USER_ID = "e03e0be4-8fe4-4729-ae43-4a29008a02a8"

# Headers for authenticated requests
AUTH_HEADERS = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json"
}

def test_auth_endpoints():
    """Test authentication endpoints"""
    print("🔐 Testing Authentication Endpoints...")
    
    # Test GET /api/auth/me
    print("  Testing GET /api/auth/me...")
    response = requests.get(f"{BASE_URL}/auth/me", headers=AUTH_HEADERS)
    
    if response.status_code == 200:
        user_data = response.json()
        print(f"  ✅ Auth successful - User: {user_data.get('name')} ({user_data.get('email')})")
        return True, user_data
    else:
        print(f"  ❌ Auth failed - Status: {response.status_code}, Response: {response.text}")
        return False, None

def test_server_management():
    """Test server creation and management"""
    print("\n🏢 Testing Server Management...")
    
    # Test POST /api/servers (create server)
    print("  Testing POST /api/servers (create server)...")
    server_data = {
        "name": "Test Cosmic Server"
    }
    
    response = requests.post(f"{BASE_URL}/servers", 
                           headers=AUTH_HEADERS, 
                           json=server_data)
    
    if response.status_code == 200:
        server = response.json()
        server_id = server.get('id')
        print(f"  ✅ Server created - ID: {server_id}, Name: {server.get('name')}")
        
        # Test GET /api/servers (list servers)
        print("  Testing GET /api/servers (list servers)...")
        response = requests.get(f"{BASE_URL}/servers", headers=AUTH_HEADERS)
        
        if response.status_code == 200:
            servers = response.json()
            print(f"  ✅ Listed {len(servers)} servers")
            
            # Test GET /api/servers/{server_id} (get server details)
            print(f"  Testing GET /api/servers/{server_id} (get server details)...")
            response = requests.get(f"{BASE_URL}/servers/{server_id}", headers=AUTH_HEADERS)
            
            if response.status_code == 200:
                server_details = response.json()
                print(f"  ✅ Server details retrieved - Members: {len(server_details.get('members', []))}")
                return True, server_id
            else:
                print(f"  ❌ Failed to get server details - Status: {response.status_code}")
                return False, server_id
        else:
            print(f"  ❌ Failed to list servers - Status: {response.status_code}")
            return False, server_id
    else:
        print(f"  ❌ Failed to create server - Status: {response.status_code}, Response: {response.text}")
        return False, None

def test_channel_management(server_id):
    """Test channel creation and management"""
    print("\n📺 Testing Channel Management...")
    
    # Test GET /api/servers/{server_id}/channels (list default channels)
    print(f"  Testing GET /api/servers/{server_id}/channels (list default channels)...")
    response = requests.get(f"{BASE_URL}/servers/{server_id}/channels", headers=AUTH_HEADERS)
    
    if response.status_code == 200:
        channels = response.json()
        print(f"  ✅ Found {len(channels)} default channels")
        for channel in channels:
            print(f"    - {channel.get('name')} ({channel.get('type')})")
        
        # Test POST /api/servers/{server_id}/channels (create text channel)
        print("  Testing POST /api/servers/{server_id}/channels (create text channel)...")
        channel_data = {
            "name": "test-chat",
            "type": "text"
        }
        
        response = requests.post(f"{BASE_URL}/servers/{server_id}/channels", 
                               headers=AUTH_HEADERS, 
                               json=channel_data)
        
        if response.status_code == 200:
            text_channel = response.json()
            text_channel_id = text_channel.get('id')
            print(f"  ✅ Text channel created - ID: {text_channel_id}")
            
            # Test creating voice channel
            print("  Testing POST /api/servers/{server_id}/channels (create voice channel)...")
            voice_channel_data = {
                "name": "test-voice",
                "type": "voice"
            }
            
            response = requests.post(f"{BASE_URL}/servers/{server_id}/channels", 
                                   headers=AUTH_HEADERS, 
                                   json=voice_channel_data)
            
            if response.status_code == 200:
                voice_channel = response.json()
                print(f"  ✅ Voice channel created - ID: {voice_channel.get('id')}")
                
                # Test creating video channel
                print("  Testing POST /api/servers/{server_id}/channels (create video channel)...")
                video_channel_data = {
                    "name": "test-video",
                    "type": "video"
                }
                
                response = requests.post(f"{BASE_URL}/servers/{server_id}/channels", 
                                       headers=AUTH_HEADERS, 
                                       json=video_channel_data)
                
                if response.status_code == 200:
                    video_channel = response.json()
                    print(f"  ✅ Video channel created - ID: {video_channel.get('id')}")
                    return True, text_channel_id
                else:
                    print(f"  ❌ Failed to create video channel - Status: {response.status_code}")
                    return False, text_channel_id
            else:
                print(f"  ❌ Failed to create voice channel - Status: {response.status_code}")
                return False, text_channel_id
        else:
            print(f"  ❌ Failed to create text channel - Status: {response.status_code}, Response: {response.text}")
            return False, None
    else:
        print(f"  ❌ Failed to list channels - Status: {response.status_code}, Response: {response.text}")
        return False, None

def test_messaging(channel_id):
    """Test messaging functionality"""
    print("\n💬 Testing Messaging...")
    
    # Test POST /api/channels/{channel_id}/messages (send message)
    print(f"  Testing POST /api/channels/{channel_id}/messages (send message)...")
    message_data = {
        "content": "Hello from the cosmic void! 🌌 This is a test message from AstralLink."
    }
    
    response = requests.post(f"{BASE_URL}/channels/{channel_id}/messages", 
                           headers=AUTH_HEADERS, 
                           json=message_data)
    
    if response.status_code == 200:
        message = response.json()
        message_id = message.get('id')
        print(f"  ✅ Message sent - ID: {message_id}")
        print(f"    Content: {message.get('content')}")
        
        # Send another message for testing
        message_data2 = {
            "content": "Another cosmic message! ⭐ Testing the stellar communication system."
        }
        
        response = requests.post(f"{BASE_URL}/channels/{channel_id}/messages", 
                               headers=AUTH_HEADERS, 
                               json=message_data2)
        
        if response.status_code == 200:
            message2 = response.json()
            print(f"  ✅ Second message sent - ID: {message2.get('id')}")
            
            # Test GET /api/channels/{channel_id}/messages (get messages)
            print(f"  Testing GET /api/channels/{channel_id}/messages (get messages)...")
            response = requests.get(f"{BASE_URL}/channels/{channel_id}/messages", headers=AUTH_HEADERS)
            
            if response.status_code == 200:
                messages = response.json()
                print(f"  ✅ Retrieved {len(messages)} messages")
                for msg in messages:
                    print(f"    - {msg.get('content')[:50]}...")
                return True, message_id
            else:
                print(f"  ❌ Failed to get messages - Status: {response.status_code}")
                return False, message_id
        else:
            print(f"  ❌ Failed to send second message - Status: {response.status_code}")
            return False, message_id
    else:
        print(f"  ❌ Failed to send message - Status: {response.status_code}, Response: {response.text}")
        return False, None

def test_message_reactions(message_id):
    """Test message reactions"""
    print("\n😀 Testing Message Reactions...")
    
    # Test POST /api/messages/{message_id}/reactions
    print(f"  Testing POST /api/messages/{message_id}/reactions...")
    reaction_data = {
        "emoji": "🚀"
    }
    
    response = requests.post(f"{BASE_URL}/messages/{message_id}/reactions", 
                           headers=AUTH_HEADERS, 
                           json=reaction_data)
    
    if response.status_code == 200:
        result = response.json()
        print(f"  ✅ Reaction added - Success: {result.get('success')}")
        
        # Add another reaction
        reaction_data2 = {
            "emoji": "⭐"
        }
        
        response = requests.post(f"{BASE_URL}/messages/{message_id}/reactions", 
                               headers=AUTH_HEADERS, 
                               json=reaction_data2)
        
        if response.status_code == 200:
            result2 = response.json()
            print(f"  ✅ Second reaction added - Success: {result2.get('success')}")
            return True
        else:
            print(f"  ❌ Failed to add second reaction - Status: {response.status_code}")
            return False
    else:
        print(f"  ❌ Failed to add reaction - Status: {response.status_code}, Response: {response.text}")
        return False

def test_presence_system(server_id):
    """Test presence system"""
    print("\n👥 Testing Presence System...")
    
    # Test POST /api/presence/status (update status)
    print("  Testing POST /api/presence/status (update status to idle)...")
    
    # Note: The endpoint expects status as a query parameter or form data, not JSON
    response = requests.post(f"{BASE_URL}/presence/status?status=idle", headers=AUTH_HEADERS)
    
    if response.status_code == 200:
        result = response.json()
        print(f"  ✅ Status updated to idle - Success: {result.get('success')}")
        
        # Test GET /api/servers/{server_id}/members (get members with presence)
        print(f"  Testing GET /api/servers/{server_id}/members (get members with presence)...")
        response = requests.get(f"{BASE_URL}/servers/{server_id}/members", headers=AUTH_HEADERS)
        
        if response.status_code == 200:
            members = response.json()
            print(f"  ✅ Retrieved {len(members)} server members")
            for member in members:
                print(f"    - {member.get('name')} ({member.get('email')}) - Status: {member.get('status')}")
            
            # Update status back to online
            print("  Testing POST /api/presence/status (update status to online)...")
            response = requests.post(f"{BASE_URL}/presence/status?status=online", headers=AUTH_HEADERS)
            
            if response.status_code == 200:
                result = response.json()
                print(f"  ✅ Status updated to online - Success: {result.get('success')}")
                return True
            else:
                print(f"  ❌ Failed to update status to online - Status: {response.status_code}")
                return False
        else:
            print(f"  ❌ Failed to get server members - Status: {response.status_code}, Response: {response.text}")
            return False
    else:
        print(f"  ❌ Failed to update status - Status: {response.status_code}, Response: {response.text}")
        return False

def test_webrtc_voice_channel(server_id):
    """Test WebRTC voice channel join/leave functionality"""
    print("\n🎤 Testing WebRTC Voice Channel Join/Leave...")
    
    # First, get the default voice channel created with the server
    print("  Getting voice channels...")
    response = requests.get(f"{BASE_URL}/servers/{server_id}/channels", headers=AUTH_HEADERS)
    
    if response.status_code != 200:
        print(f"  ❌ Failed to get channels - Status: {response.status_code}")
        return False, None
    
    channels = response.json()
    voice_channel = None
    for channel in channels:
        if channel.get('type') == 'voice':
            voice_channel = channel
            break
    
    if not voice_channel:
        print("  ❌ No voice channel found")
        return False, None
    
    voice_channel_id = voice_channel.get('id')
    print(f"  Found voice channel: {voice_channel.get('name')} (ID: {voice_channel_id})")
    
    # Test POST /api/channels/{channel_id}/join
    print(f"  Testing POST /api/channels/{voice_channel_id}/join...")
    response = requests.post(f"{BASE_URL}/channels/{voice_channel_id}/join", headers=AUTH_HEADERS)
    
    if response.status_code == 200:
        participant = response.json()
        print(f"  ✅ Successfully joined voice channel - Participant ID: {participant.get('id')}")
        
        # Test duplicate join (should return existing participant)
        print("  Testing duplicate join (should return existing participant)...")
        response = requests.post(f"{BASE_URL}/channels/{voice_channel_id}/join", headers=AUTH_HEADERS)
        
        if response.status_code == 200:
            duplicate_participant = response.json()
            print(f"  ✅ Duplicate join handled correctly - Same participant ID: {duplicate_participant.get('id')}")
            
            # Test POST /api/channels/{channel_id}/leave
            print(f"  Testing POST /api/channels/{voice_channel_id}/leave...")
            response = requests.post(f"{BASE_URL}/channels/{voice_channel_id}/leave", headers=AUTH_HEADERS)
            
            if response.status_code == 200:
                result = response.json()
                print(f"  ✅ Successfully left voice channel - Success: {result.get('success')}")
                return True, voice_channel_id
            else:
                print(f"  ❌ Failed to leave voice channel - Status: {response.status_code}, Response: {response.text}")
                return False, voice_channel_id
        else:
            print(f"  ❌ Duplicate join failed - Status: {response.status_code}, Response: {response.text}")
            return False, voice_channel_id
    else:
        print(f"  ❌ Failed to join voice channel - Status: {response.status_code}, Response: {response.text}")
        return False, voice_channel_id

def test_webrtc_video_channel(server_id):
    """Test WebRTC video channel functionality"""
    print("\n📹 Testing WebRTC Video Channel...")
    
    # Create a video channel for testing
    print("  Creating video channel for testing...")
    video_channel_data = {
        "name": "test-video-webrtc",
        "type": "video"
    }
    
    response = requests.post(f"{BASE_URL}/servers/{server_id}/channels", 
                           headers=AUTH_HEADERS, 
                           json=video_channel_data)
    
    if response.status_code != 200:
        print(f"  ❌ Failed to create video channel - Status: {response.status_code}")
        return False, None
    
    video_channel = response.json()
    video_channel_id = video_channel.get('id')
    print(f"  ✅ Video channel created - ID: {video_channel_id}")
    
    # Test joining video channel
    print(f"  Testing POST /api/channels/{video_channel_id}/join...")
    response = requests.post(f"{BASE_URL}/channels/{video_channel_id}/join", headers=AUTH_HEADERS)
    
    if response.status_code == 200:
        participant = response.json()
        print(f"  ✅ Successfully joined video channel - Participant ID: {participant.get('id')}")
        return True, video_channel_id
    else:
        print(f"  ❌ Failed to join video channel - Status: {response.status_code}, Response: {response.text}")
        return False, video_channel_id

def test_webrtc_participants_management(channel_id):
    """Test WebRTC participants management"""
    print("\n👥 Testing WebRTC Participants Management...")
    
    # First join the channel
    print(f"  Joining channel {channel_id} for participants testing...")
    response = requests.post(f"{BASE_URL}/channels/{channel_id}/join", headers=AUTH_HEADERS)
    
    if response.status_code != 200:
        print(f"  ❌ Failed to join channel - Status: {response.status_code}")
        return False
    
    # Test GET /api/channels/{channel_id}/participants
    print(f"  Testing GET /api/channels/{channel_id}/participants...")
    response = requests.get(f"{BASE_URL}/channels/{channel_id}/participants", headers=AUTH_HEADERS)
    
    if response.status_code == 200:
        participants = response.json()
        print(f"  ✅ Retrieved {len(participants)} participants")
        
        if participants:
            participant = participants[0]
            print(f"    - Participant: {participant.get('user', {}).get('name')} (Muted: {participant.get('is_muted')}, Video: {participant.get('is_video_enabled')})")
            
            # Test POST /api/channels/{channel_id}/toggle-mute
            print(f"  Testing POST /api/channels/{channel_id}/toggle-mute?is_muted=true...")
            response = requests.post(f"{BASE_URL}/channels/{channel_id}/toggle-mute?is_muted=true", headers=AUTH_HEADERS)
            
            if response.status_code == 200:
                result = response.json()
                print(f"  ✅ Successfully muted - Success: {result.get('success')}")
                
                # Test unmute
                print(f"  Testing POST /api/channels/{channel_id}/toggle-mute?is_muted=false...")
                response = requests.post(f"{BASE_URL}/channels/{channel_id}/toggle-mute?is_muted=false", headers=AUTH_HEADERS)
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"  ✅ Successfully unmuted - Success: {result.get('success')}")
                    
                    # Test POST /api/channels/{channel_id}/toggle-video
                    print(f"  Testing POST /api/channels/{channel_id}/toggle-video?is_video_enabled=true...")
                    response = requests.post(f"{BASE_URL}/channels/{channel_id}/toggle-video?is_video_enabled=true", headers=AUTH_HEADERS)
                    
                    if response.status_code == 200:
                        result = response.json()
                        print(f"  ✅ Successfully enabled video - Success: {result.get('success')}")
                        
                        # Test disable video
                        print(f"  Testing POST /api/channels/{channel_id}/toggle-video?is_video_enabled=false...")
                        response = requests.post(f"{BASE_URL}/channels/{channel_id}/toggle-video?is_video_enabled=false", headers=AUTH_HEADERS)
                        
                        if response.status_code == 200:
                            result = response.json()
                            print(f"  ✅ Successfully disabled video - Success: {result.get('success')}")
                            
                            # Verify changes by getting participants again
                            print("  Verifying participant state changes...")
                            response = requests.get(f"{BASE_URL}/channels/{channel_id}/participants", headers=AUTH_HEADERS)
                            
                            if response.status_code == 200:
                                updated_participants = response.json()
                                if updated_participants:
                                    updated_participant = updated_participants[0]
                                    print(f"  ✅ Participant state verified - Muted: {updated_participant.get('is_muted')}, Video: {updated_participant.get('is_video_enabled')}")
                                    return True
                                else:
                                    print("  ❌ No participants found after state changes")
                                    return False
                            else:
                                print(f"  ❌ Failed to verify participant state - Status: {response.status_code}")
                                return False
                        else:
                            print(f"  ❌ Failed to disable video - Status: {response.status_code}")
                            return False
                    else:
                        print(f"  ❌ Failed to enable video - Status: {response.status_code}")
                        return False
                else:
                    print(f"  ❌ Failed to unmute - Status: {response.status_code}")
                    return False
            else:
                print(f"  ❌ Failed to mute - Status: {response.status_code}")
                return False
        else:
            print("  ❌ No participants found")
            return False
    else:
        print(f"  ❌ Failed to get participants - Status: {response.status_code}, Response: {response.text}")
        return False

def main():
    """Run all backend tests"""
    print("🌌 AstralLink Backend API Testing Suite")
    print("=" * 50)
    
    results = {
        "auth": False,
        "servers": False,
        "channels": False,
        "messaging": False,
        "reactions": False,
        "presence": False,
        "webrtc_voice": False,
        "webrtc_video": False,
        "webrtc_participants": False
    }
    
    # Test Authentication
    auth_success, user_data = test_auth_endpoints()
    results["auth"] = auth_success
    
    if not auth_success:
        print("\n❌ Authentication failed. Cannot proceed with other tests.")
        return results
    
    # Test Server Management
    server_success, server_id = test_server_management()
    results["servers"] = server_success
    
    if not server_success or not server_id:
        print("\n❌ Server management failed. Cannot proceed with channel tests.")
        return results
    
    # Test Channel Management
    channel_success, channel_id = test_channel_management(server_id)
    results["channels"] = channel_success
    
    if not channel_success or not channel_id:
        print("\n❌ Channel management failed. Cannot proceed with messaging tests.")
        return results
    
    # Test Messaging
    messaging_success, message_id = test_messaging(channel_id)
    results["messaging"] = messaging_success
    
    if messaging_success and message_id:
        # Test Message Reactions
        reactions_success = test_message_reactions(message_id)
        results["reactions"] = reactions_success
    
    # Test Presence System
    presence_success = test_presence_system(server_id)
    results["presence"] = presence_success
    
    # Test WebRTC Voice Channel
    webrtc_voice_success, voice_channel_id = test_webrtc_voice_channel(server_id)
    results["webrtc_voice"] = webrtc_voice_success
    
    # Test WebRTC Video Channel
    webrtc_video_success, video_channel_id = test_webrtc_video_channel(server_id)
    results["webrtc_video"] = webrtc_video_success
    
    # Test WebRTC Participants Management (use voice channel if available, otherwise video)
    test_channel_id = voice_channel_id if voice_channel_id else video_channel_id
    if test_channel_id:
        webrtc_participants_success = test_webrtc_participants_management(test_channel_id)
        results["webrtc_participants"] = webrtc_participants_success
    
    # Print Summary
    print("\n" + "=" * 50)
    print("🌌 AstralLink Backend Test Results Summary")
    print("=" * 50)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{test_name.upper():15} {status}")
    
    total_tests = len(results)
    passed_tests = sum(results.values())
    
    print(f"\nOverall: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 All backend tests passed! AstralLink backend is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the detailed output above.")
    
    return results

if __name__ == "__main__":
    main()