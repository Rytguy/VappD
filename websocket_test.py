#!/usr/bin/env python3
"""
WebSocket Signaling Test for AstralLink
Tests the WebRTC signaling WebSocket endpoint
"""

import asyncio
import websockets
import json
import sys

# Configuration
WS_URL = "wss://spacewave-1.preview.emergentagent.com/ws/signaling/test-user-123"

async def test_signaling_websocket():
    """Test WebRTC signaling WebSocket endpoint"""
    print("🔌 Testing WebRTC Signaling WebSocket...")
    
    try:
        # Connect to signaling WebSocket
        print(f"  Connecting to {WS_URL}...")
        async with websockets.connect(WS_URL) as websocket:
            print("  ✅ WebSocket connection established")
            
            # Test sending an offer message
            offer_message = {
                "type": "offer",
                "target": "test-user-456",
                "sdp": "v=0\r\no=- 123456789 123456789 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n",
                "from": "test-user-123"
            }
            
            print("  Sending offer message...")
            await websocket.send(json.dumps(offer_message))
            print("  ✅ Offer message sent successfully")
            
            # Test sending an ICE candidate message
            ice_message = {
                "type": "ice-candidate",
                "target": "test-user-456",
                "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
                "from": "test-user-123"
            }
            
            print("  Sending ICE candidate message...")
            await websocket.send(json.dumps(ice_message))
            print("  ✅ ICE candidate message sent successfully")
            
            # Wait a moment to see if there are any responses
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"  📨 Received response: {response}")
            except asyncio.TimeoutError:
                print("  ℹ️  No response received (expected for signaling endpoint)")
            
            print("  ✅ WebSocket signaling test completed successfully")
            return True
            
    except Exception as e:
        print(f"  ❌ WebSocket signaling test failed: {e}")
        return False

async def main():
    """Run WebSocket signaling test"""
    print("🌌 AstralLink WebSocket Signaling Test")
    print("=" * 50)
    
    success = await test_signaling_websocket()
    
    print("\n" + "=" * 50)
    print("🌌 WebSocket Signaling Test Results")
    print("=" * 50)
    
    if success:
        print("SIGNALING       ✅ PASS")
        print("\n🎉 WebSocket signaling endpoint is working correctly!")
    else:
        print("SIGNALING       ❌ FAIL")
        print("\n⚠️  WebSocket signaling test failed.")
    
    return success

if __name__ == "__main__":
    asyncio.run(main())