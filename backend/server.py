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

# backend/server.py 
# Find class Message(BaseModel):
class Message(BaseModel):
    id: str
    channel_id: str
    user_id: str
    content: str
    created_at: datetime
    edited: bool = False
    reactions: Dict[str, List[str]] = {}
    parent_id: Optional[str] = None      # <-- ADD THIS LINE
    starred: bool = False                # <-- ADD THIS LINE


class CreateServerRequest(BaseModel):
    name: str

class CreateChannelRequest(BaseModel):
    name: str
    type: str

class SendMessageRequest(BaseModel):
    content: str

class AddReactionRequest(BaseModel):
    emoji: str

class VoiceChannelParticipant(BaseModel):
    id: str
    channel_id: str
    user_id: str
    is_muted: bool = False
    is_video_enabled: bool = False
    joined_at: datetime

# ===== PRODUCTIVITY MODELS =====
class CalendarEvent(BaseModel):
    id: str
    server_id: str
    title: str
    description: str = ""
    start_time: datetime
    end_time: datetime
    assigned_to: List[str] = []  # user IDs
    color: str = "#9F86FF"  # Default cosmic purple
    channel_link: Optional[str] = None  # Link to a channel
    created_by: str
    created_at: datetime

class SubTask(BaseModel):
    id: str
    title: str
    completed: bool = False

class Task(BaseModel):
    id: str
    server_id: str
    title: str
    description: str = ""
    assigned_to: List[str] = []  # user IDs
    deadline: Optional[datetime] = None
    completed: bool = False
    priority: str = "medium"  # low, medium, high
    sub_tasks: List[SubTask] = []
    progress: int = 0  # 0-100
    created_by: str
    created_at: datetime
    updated_at: datetime

class Note(BaseModel):
    id: str
    server_id: str
    title: str
    content: str = ""  # Markdown content
    collaborative: bool = True
    created_by: str
    updated_by: str
    created_at: datetime
    updated_at: datetime

# ===== REQUEST MODELS =====
class CreateEventRequest(BaseModel):
    title: str
    description: str = ""
    start_time: datetime
    end_time: datetime
    assigned_to: List[str] = []
    color: str = "#9F86FF"
    channel_link: Optional[str] = None

class UpdateEventRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    assigned_to: Optional[List[str]] = None
    color: Optional[str] = None
    channel_link: Optional[str] = None

class CreateTaskRequest(BaseModel):
    title: str
    description: str = ""
    assigned_to: List[str] = []
    deadline: Optional[datetime] = None
    priority: str = "medium"

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to: Optional[List[str]] = None
    deadline: Optional[datetime] = None
    completed: Optional[bool] = None
    priority: Optional[str] = None
    sub_tasks: Optional[List[SubTask]] = None
    progress: Optional[int] = None

class CreateNoteRequest(BaseModel):
    title: str
    content: str = ""
    collaborative: bool = True

class UpdateNoteRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    collaborative: Optional[bool] = None

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
async def create_channel(server_id: str, request: CreateChannelRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
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
async def get_channels(server_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
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
async def get_messages(channel_id: str, limit: int = 50, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get messages from a channel"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    messages = await db.messages.find({"channel_id": channel_id}).sort("created_at", -1).limit(limit).to_list(limit)
    messages.reverse()  # Return in chronological order
    return [Message(**m) for m in messages]

# backend/server.py

@api_router.get("/channels/{channel_id}/threads")
async def get_threads(channel_id: str):
    messages = await db.messages.find({"channel_id": channel_id}).to_list(1000)
    return messages  # Optionally, post-process to build a tree for UI


# backend/server.py
# Find: @api_router.post("/channels/{channel_id}/messages", ...)
@api_router.post("/channels/{channel_id}/messages", response_model=Message)
async def send_message(
    channel_id: str,
    request: SendMessageRequest,
    parent_id: Optional[str] = None,        # <-- ADD THIS ARG
    is_starred: Optional[bool] = False,     # <-- ADD THIS ARG
    authorization: Optional[str] = Header(None),
    session_token: Optional[str] = Cookie(None)
):
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    message = Message(
        id=str(uuid.uuid4()),
        channel_id=channel_id,
        user_id=user.id,
        content=request.content,
        created_at=datetime.now(timezone.utc),
        parent_id=parent_id,       # <-- PASS THROUGH
        starred=is_starred         # <-- PASS THROUGH
    )
    await db.messages.insert_one(message.dict())
    return message


@api_router.post("/messages/{message_id}/reactions")
async def add_reaction(message_id: str, request: AddReactionRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
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
async def update_status(status: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
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
async def get_server_members(server_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get all members of a server with their status"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    members = await db.users.find({"id": {"$in": server["members"]}}).to_list(1000)
    return [User(**m) for m in members]

# ===== CALENDAR ROUTES =====
@api_router.post("/servers/{server_id}/events", response_model=CalendarEvent)
async def create_event(server_id: str, request: CreateEventRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Create a calendar event"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    event = CalendarEvent(
        id=str(uuid.uuid4()),
        server_id=server_id,
        title=request.title,
        description=request.description,
        start_time=request.start_time,
        end_time=request.end_time,
        assigned_to=request.assigned_to,
        color=request.color,
        channel_link=request.channel_link,
        created_by=user.id,
        created_at=datetime.now(timezone.utc)
    )
    await db.calendar_events.insert_one(event.dict())
    return event

@api_router.get("/servers/{server_id}/events", response_model=List[CalendarEvent])
async def get_events(server_id: str, start_date: Optional[str] = None, end_date: Optional[str] = None, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get all events for a server (optionally filtered by date range)"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"server_id": server_id}
    if start_date and end_date:
        query["start_time"] = {
            "$gte": datetime.fromisoformat(start_date),
            "$lte": datetime.fromisoformat(end_date)
        }
    
    events = await db.calendar_events.find(query).sort("start_time", 1).to_list(1000)
    return [CalendarEvent(**e) for e in events]

@api_router.get("/servers/{server_id}/events/{event_id}", response_model=CalendarEvent)
async def get_event(server_id: str, event_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get a specific event"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    event = await db.calendar_events.find_one({"id": event_id, "server_id": server_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    return CalendarEvent(**event)

@api_router.put("/servers/{server_id}/events/{event_id}", response_model=CalendarEvent)
async def update_event(server_id: str, event_id: str, request: UpdateEventRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Update a calendar event"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    event = await db.calendar_events.find_one({"id": event_id, "server_id": server_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    if update_data:
        await db.calendar_events.update_one(
            {"id": event_id},
            {"$set": update_data}
        )
    
    updated_event = await db.calendar_events.find_one({"id": event_id})
    return CalendarEvent(**updated_event)

@api_router.delete("/servers/{server_id}/events/{event_id}")
async def delete_event(server_id: str, event_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Delete a calendar event"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    event = await db.calendar_events.find_one({"id": event_id, "server_id": server_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    await db.calendar_events.delete_one({"id": event_id})
    return {"success": True}

# ===== TASK ROUTES =====
@api_router.post("/servers/{server_id}/tasks", response_model=Task)
async def create_task(server_id: str, request: CreateTaskRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Create a task"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    task = Task(
        id=str(uuid.uuid4()),
        server_id=server_id,
        title=request.title,
        description=request.description,
        assigned_to=request.assigned_to,
        deadline=request.deadline,
        priority=request.priority,
        created_by=user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    await db.tasks.insert_one(task.dict())
    return task

@api_router.get("/servers/{server_id}/tasks", response_model=List[Task])
async def get_tasks(server_id: str, completed: Optional[bool] = None, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get all tasks for a server"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"server_id": server_id}
    if completed is not None:
        query["completed"] = completed
    
    tasks = await db.tasks.find(query).sort("created_at", -1).to_list(1000)
    return [Task(**t) for t in tasks]

@api_router.get("/servers/{server_id}/tasks/{task_id}", response_model=Task)
async def get_task(server_id: str, task_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get a specific task"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    task = await db.tasks.find_one({"id": task_id, "server_id": server_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return Task(**task)

@api_router.put("/servers/{server_id}/tasks/{task_id}", response_model=Task)
async def update_task(server_id: str, task_id: str, request: UpdateTaskRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Update a task"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    task = await db.tasks.find_one({"id": task_id, "server_id": server_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    if update_data:
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.tasks.update_one(
            {"id": task_id},
            {"$set": update_data}
        )
    
    updated_task = await db.tasks.find_one({"id": task_id})
    return Task(**updated_task)

@api_router.delete("/servers/{server_id}/tasks/{task_id}")
async def delete_task(server_id: str, task_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Delete a task"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    task = await db.tasks.find_one({"id": task_id, "server_id": server_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.tasks.delete_one({"id": task_id})
    return {"success": True}

# ===== NOTES ROUTES =====
@api_router.post("/servers/{server_id}/notes", response_model=Note)
async def create_note(server_id: str, request: CreateNoteRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Create a note"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    note = Note(
        id=str(uuid.uuid4()),
        server_id=server_id,
        title=request.title,
        content=request.content,
        collaborative=request.collaborative,
        created_by=user.id,
        updated_by=user.id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    await db.notes.insert_one(note.dict())
    return note

@api_router.get("/servers/{server_id}/notes", response_model=List[Note])
async def get_notes(server_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get all notes for a server"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    server = await db.servers.find_one({"id": server_id})
    if not server or user.id not in server["members"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notes = await db.notes.find({"server_id": server_id}).sort("updated_at", -1).to_list(1000)
    return [Note(**n) for n in notes]

@api_router.get("/servers/{server_id}/notes/{note_id}", response_model=Note)
async def get_note(server_id: str, note_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get a specific note"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    note = await db.notes.find_one({"id": note_id, "server_id": server_id})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    return Note(**note)

@api_router.put("/servers/{server_id}/notes/{note_id}", response_model=Note)
async def update_note(server_id: str, note_id: str, request: UpdateNoteRequest, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Update a note"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    note = await db.notes.find_one({"id": note_id, "server_id": server_id})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    update_data = {k: v for k, v in request.dict().items() if v is not None}
    if update_data:
        update_data["updated_by"] = user.id
        update_data["updated_at"] = datetime.now(timezone.utc)
        await db.notes.update_one(
            {"id": note_id},
            {"$set": update_data}
        )
    
    updated_note = await db.notes.find_one({"id": note_id})
    return Note(**updated_note)

@api_router.delete("/servers/{server_id}/notes/{note_id}")
async def delete_note(server_id: str, note_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Delete a note"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    note = await db.notes.find_one({"id": note_id, "server_id": server_id})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    await db.notes.delete_one({"id": note_id})
    return {"success": True}

# ===== VOICE/VIDEO CHANNEL ROUTES =====
@api_router.post("/channels/{channel_id}/join")
async def join_voice_channel(channel_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Join a voice/video channel"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check if already in channel
    existing = await db.voice_participants.find_one({
        "channel_id": channel_id,
        "user_id": user.id
    })
    
    if existing:
        return VoiceChannelParticipant(**existing)
    
    participant = VoiceChannelParticipant(
        id=str(uuid.uuid4()),
        channel_id=channel_id,
        user_id=user.id,
        joined_at=datetime.now(timezone.utc)
    )
    await db.voice_participants.insert_one(participant.dict())
    return participant

@api_router.post("/channels/{channel_id}/leave")
async def leave_voice_channel(channel_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Leave a voice/video channel"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.voice_participants.delete_one({
        "channel_id": channel_id,
        "user_id": user.id
    })
    return {"success": True}

@api_router.get("/channels/{channel_id}/participants")
async def get_voice_participants(channel_id: str, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Get all participants in a voice/video channel"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    participants = await db.voice_participants.find({"channel_id": channel_id}).to_list(1000)
    
    # Get user details for each participant
    result = []
    for p in participants:
        user_doc = await db.users.find_one({"id": p["user_id"]})
        if user_doc:
            # Remove MongoDB _id field from participant data
            participant_data = {k: v for k, v in p.items() if k != "_id"}
            # Remove MongoDB _id field from user data
            user_data = {k: v for k, v in user_doc.items() if k != "_id"}
            
            result.append({
                **participant_data,
                "user": User(**user_data).dict()
            })
    
    return result

@api_router.post("/channels/{channel_id}/toggle-mute")
async def toggle_mute(channel_id: str, is_muted: bool, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Toggle mute status"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.voice_participants.update_one(
        {"channel_id": channel_id, "user_id": user.id},
        {"$set": {"is_muted": is_muted}}
    )
    return {"success": True}

@api_router.post("/channels/{channel_id}/toggle-video")
async def toggle_video(channel_id: str, is_video_enabled: bool, authorization: Optional[str] = Header(None), session_token: Optional[str] = Cookie(None)):
    """Toggle video status"""
    user = await get_current_user(authorization, session_token)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    await db.voice_participants.update_one(
        {"channel_id": channel_id, "user_id": user.id},
        {"$set": {"is_video_enabled": is_video_enabled}}
    )
    return {"success": True}

# ===== WEBSOCKET FOR REAL-TIME =====
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}  # channel_id -> list of websockets
        self.user_connections: Dict[str, WebSocket] = {}  # user_id -> websocket for signaling
    
    async def connect(self, websocket: WebSocket, channel_id: str):
        await websocket.accept()
        if channel_id not in self.active_connections:
            self.active_connections[channel_id] = []
        self.active_connections[channel_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, channel_id: str):
        if channel_id in self.active_connections:
            if websocket in self.active_connections[channel_id]:
                self.active_connections[channel_id].remove(websocket)
    
    async def broadcast(self, message: str, channel_id: str):
        if channel_id in self.active_connections:
            for connection in self.active_connections[channel_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass
    
    async def connect_signaling(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.user_connections[user_id] = websocket
    
    def disconnect_signaling(self, user_id: str):
        if user_id in self.user_connections:
            del self.user_connections[user_id]
    
    async def send_to_user(self, user_id: str, message: str):
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_text(message)
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

@app.websocket("/ws/signaling/{user_id}")
async def signaling_endpoint(websocket: WebSocket, user_id: str):
    """WebRTC signaling endpoint for peer-to-peer connections"""
    await manager.connect_signaling(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            # Forward signaling messages to target peer
            if message.get("type") in ["offer", "answer", "ice-candidate"]:
                target_user_id = message.get("target")
                if target_user_id:
                    await manager.send_to_user(target_user_id, data)
    except WebSocketDisconnect:
        manager.disconnect_signaling(user_id)

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
