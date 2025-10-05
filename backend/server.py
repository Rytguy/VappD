from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Cookie, Response, Request, Header
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import json
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== MODELS =====
class User(BaseModel):
    id: str
    email: str
    name: str
    picture: str
    created_at: datetime
    status: str = "offline"  # online, offline, idle

class UserSession(BaseModel):
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

class Server(BaseModel):
    id: str
    name: str
    created_by: str
    members: List[str] = []  # user IDs
    created_at: datetime

class Channel(BaseModel):
    id: str
    server_id: str
    name: str
    type: str  # text, voice, video
    created_at: datetime

class Message(BaseModel):
    id: str
    channel_id: str
    user_id: str
    content: str
    created_at: datetime
    edited: bool = False
    reactions: Dict[str, List[str]] = {}  # emoji -> list of user_ids

class CreateServerRequest(BaseModel):
    name: str

class CreateChannelRequest(BaseModel):
    name: str
    type: str

class SendMessageRequest(BaseModel):
    content: str

class AddReactionRequest(BaseModel):
    emoji: str

# ===== AUTH HELPERS =====
async def get_current_user(authorization: Optional[str] = None, session_token: Optional[str] = None) -> Optional[User]:
    """Get current user from either Authorization header or session_token cookie"""
    token = None
    
    if session_token:
        token = session_token
    elif authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "")
    
    if not token:
        return None
    
    # Check if session exists and not expired
    session = await db.user_sessions.find_one({
        "session_token": token,
        "expires_at": {"$gt": datetime.now(timezone.utc)}
    })
    
    if not session:
        return None
    
    # Get user
    user_doc = await db.users.find_one({"id": session["user_id"]})
    if not user_doc:
        return None
    
    return User(**user_doc)

# ===== AUTH ROUTES =====
@api_router.get("/auth/session")
async def process_session(session_id: str, response: Response):
    """Process session_id from Emergent Auth and create session"""
    try:
        # Call Emergent auth endpoint
        async with httpx.AsyncClient() as client:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            auth_response.raise_for_status()
            user_data = auth_response.json()
        
        # Check if user exists
        existing_user = await db.users.find_one({"email": user_data["email"]})
        
        if not existing_user:
            # Create new user
            user_id = str(uuid.uuid4())
            user = User(
                id=user_id,
                email=user_data["email"],
                name=user_data["name"],
                picture=user_data["picture"],
                created_at=datetime.now(timezone.utc),
                status="online"
            )
            await db.users.insert_one(user.dict())
        else:
            user_id = existing_user["id"]
            # Update status to online
            await db.users.update_one(
                {"id": user_id},
                {"$set": {"status": "online"}}
            )
        
        # Create session
        session_token = user_data["session_token"]
        session = UserSession(
            user_id=user_id,
            session_token=session_token,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
            created_at=datetime.now(timezone.utc)
        )
        await db.user_sessions.insert_one(session.dict())
        
        # Set cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        return {"success": True, "user_id": user_id}
    
    except Exception as e:
        logging.error(f"Session processing error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get current user info"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None)):
    """Logout user"""
    if session_token:
        # Delete session from database
        await db.user_sessions.delete_one({"session_token": session_token})
        
        # Get user_id before deleting
        session = await db.user_sessions.find_one({"session_token": session_token})
        if session:
            await db.users.update_one(
                {"id": session["user_id"]},
                {"$set": {"status": "offline"}}
            )
    
    # Clear cookie
    response.delete_cookie(key="session_token", path="/")
    return {"success": True}

# ===== SERVER ROUTES =====
@api_router.post("/servers", response_model=Server)
async def create_server(request: CreateServerRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Create a new server"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server_id = str(uuid.uuid4())
    server = Server(
        id=server_id,
        name=request.name,
        created_by=user.id,
        members=[user.id],
        created_at=datetime.now(timezone.utc)
    )
    await db.servers.insert_one(server.dict())
    
    # Create default channels
    default_channels = [
        {"name": "general", "type": "text"},
        {"name": "voice-lounge", "type": "voice"},
    ]
    
    for ch in default_channels:
        channel = Channel(
            id=str(uuid.uuid4()),
            server_id=server_id,
            name=ch["name"],
            type=ch["type"],
            created_at=datetime.now(timezone.utc)
        )
        await db.channels.insert_one(channel.dict())
    
    return server

@api_router.get("/servers", response_model=List[Server])
async def get_servers(authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get all servers user is a member of"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    servers = await db.servers.find({"members": user.id}).to_list(1000)
    return [Server(**s) for s in servers]

@api_router.get("/servers/{server_id}", response_model=Server)
async def get_server(server_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get server details"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    if user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not a member of this server")
    
    return Server(**server)

# ===== CHANNEL ROUTES =====
@api_router.post("/servers/{server_id}/channels", response_model=Channel)
async def create_channel(server_id: str, request: CreateChannelRequest, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Create a new channel in a server"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is member of server
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    channel = Channel(
        id=str(uuid.uuid4()),
        server_id=server_id,
        name=request.name,
        type=request.type,
        created_at=datetime.now(timezone.utc)
    )
    await db.channels.insert_one(channel.dict())
    return channel

@api_router.get("/servers/{server_id}/channels", response_model=List[Channel])
async def get_channels(server_id: str, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Get all channels in a server"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if user is member
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    channels = await db.channels.find({"server_id": server_id}).to_list(1000)
    return [Channel(**c) for c in channels]

# ===== MESSAGE ROUTES =====
@api_router.get("/channels/{channel_id}/messages", response_model=List[Message])
async def get_messages(channel_id: str, limit: int = 50, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Get messages from a channel"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    messages = await db.messages.find({"channel_id": channel_id}).sort("created_at", -1).limit(limit).to_list(limit)
    messages.reverse()  # Return in chronological order
    return [Message(**m) for m in messages]

@api_router.post("/channels/{channel_id}/messages", response_model=Message)
async def send_message(channel_id: str, request: SendMessageRequest, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Send a message to a channel"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    message = Message(
        id=str(uuid.uuid4()),
        channel_id=channel_id,
        user_id=user.id,
        content=request.content,
        created_at=datetime.now(timezone.utc)
    )
    await db.messages.insert_one(message.dict())
    return message

@api_router.post("/messages/{message_id}/reactions")
async def add_reaction(message_id: str, request: AddReactionRequest, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Add reaction to a message"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    message = await db.messages.find_one({"id": message_id})
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    reactions = message.get("reactions", {})
    if request.emoji not in reactions:
        reactions[request.emoji] = []
    
    if user.id not in reactions[request.emoji]:
        reactions[request.emoji].append(user.id)
    
    await db.messages.update_one(
        {"id": message_id},
        {"$set": {"reactions": reactions}}
    )
    
    return {"success": True}

# ===== PRESENCE ROUTES =====
@api_router.post("/presence/status")
async def update_status(status: str, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Update user status"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.users.update_one(
        {"id": user.id},
        {"$set": {"status": status}}
    )
    return {"success": True}

@api_router.get("/servers/{server_id}/members")
async def get_server_members(server_id: str, authorization: Optional[str] = None, session_token: Optional[str] = Cookie(None)):
    """Get all members of a server with their status"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    members = await db.users.find({"id": {"$in": server["members"]}}).to_list(1000)
    return [User(**m) for m in members]

# ===== WEBSOCKET FOR REAL-TIME =====
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # channel_id -> list of websockets
    
    async def connect(self, websocket: WebSocket, channel_id: str):
        await websocket.accept()
        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = []
        self.active_connections[channel_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, channel_id: str):
        if channel_id in self.active_connections:
            self.active_connections[channel_id].remove(websocket)
    
    async def broadcast(self, message: str, channel_id: str):
        if channel_id in self.active_connections:
            for connection in self.active_connections[channel_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

manager = ConnectionManager()

@app.websocket("/ws/{channel_id}")
async def websocket_endpoint(websocket: WebSocket, channel_id: str):
    await manager.connect(websocket, channel_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Broadcast message to all connected clients
            await manager.broadcast(data, channel_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)

# ===== INCLUDE ROUTER =====
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
