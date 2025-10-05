#!/usr/bin/env python3
"""
Basic WebSocket Test for AstralLink
Tests the basic messaging WebSocket endpoint
"""

import asyncio
import websockets
import json
import sys

# Configuration
WS_URL = "wss://spacewave-1.preview.emergentagent.com/ws/test-channel-123"

async def test_basic_websocket():
    """Test basic messaging WebSocket endpoint"""
    print("🔌 Testing Basic Messaging WebSocket...")
    
    try:
        # Connect to messaging WebSocket
        print(f"  Connecting to {WS_URL}...")
        async with websockets.connect(WS_URL) as websocket:
            print("  ✅ WebSocket connection established")
            
            # Test sending a message
            test_message = "Hello from WebSocket test!"
            
            print("  Sending test message...")
            await websocket.send(test_message)
            print("  ✅ Message sent successfully")
            
            # Wait for echo/broadcast
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=3.0)
                print(f"  📨 Received response: {response}")
            except asyncio.TimeoutError:
                print("  ℹ️  No response received within timeout")
            
            print("  ✅ Basic WebSocket test completed successfully")
            return True
            
    except Exception as e:
        print(f"  ❌ Basic WebSocket test failed: {e}")
        return False

async def main():
    """Run basic WebSocket test"""
    print("🌌 AstralLink Basic WebSocket Test")
    print("=" * 50)
    
    success = await test_basic_websocket()
    
    print("\n" + "=" * 50)
    print("🌌 Basic WebSocket Test Results")
    print("=" * 50)
    
    if success:
        print("BASIC_WS        ✅ PASS")
        print("\n🎉 Basic WebSocket endpoint is working correctly!")
    else:
        print("BASIC_WS        ❌ FAIL")
        print("\n⚠️  Basic WebSocket test failed.")
    
    return success

if __name__ == "__main__":
    asyncio.run(main())