import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// ===== COMPONENTS =====
const LoginPage = () => {
  const redirectUrl = encodeURIComponent(`${window.location.origin}/dashboard`);
  const loginUrl = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;

  return (
    <div className="cosmic-bg min-h-screen flex items-center justify-center">
      <div className="stars"></div>
      <div className="text-center z-10">
        <h1 className="text-6xl font-bold mb-4 cosmic-text">🌌 AstralLink</h1>
        <p className="text-gray-300 mb-8 text-xl">A cosmic space for genuine connection</p>
        <button
          onClick={() => window.location.href = loginUrl}
          className="cosmic-btn px-8 py-4 text-lg font-semibold"
        >
          🚀 Sign in with Google
        </button>
      </div>
    </div>
  );
};

const Dashboard = ({ user, onLogout }) => {
  const [servers, setServers] = useState([]);
  const [selectedServer, setSelectedServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [members, setMembers] = useState([]);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("text");
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      loadChannels(selectedServer.id);
      loadMembers(selectedServer.id);
    }
  }, [selectedServer]);

  useEffect(() => {
    if (selectedChannel) {
      loadMessages(selectedChannel.id);
      connectWebSocket(selectedChannel.id);
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadServers = async () => {
    try {
      const response = await axios.get(`${API}/servers`, { withCredentials: true });
      setServers(response.data);
      if (response.data.length > 0 && !selectedServer) {
        setSelectedServer(response.data[0]);
      }
    } catch (error) {
      console.error("Error loading servers:", error);
    }
  };

  const loadChannels = async (serverId) => {
    try {
      const response = await axios.get(`${API}/servers/${serverId}/channels`, { withCredentials: true });
      setChannels(response.data);
      if (response.data.length > 0 && !selectedChannel) {
        setSelectedChannel(response.data[0]);
      }
    } catch (error) {
      console.error("Error loading channels:", error);
    }
  };

  const loadMessages = async (channelId) => {
    try {
      const response = await axios.get(`${API}/channels/${channelId}/messages`, { withCredentials: true });
      setMessages(response.data);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const loadMembers = async (serverId) => {
    try {
      const response = await axios.get(`${API}/servers/${serverId}/members`, { withCredentials: true });
      setMembers(response.data);
    } catch (error) {
      console.error("Error loading members:", error);
    }
  };

  const connectWebSocket = (channelId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const ws = new WebSocket(`${WS_URL}/ws/${channelId}`);
    
    ws.onopen = () => {
      console.log("WebSocket connected");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "new_message") {
        setMessages(prev => [...prev, data.message]);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
    };

    wsRef.current = ws;
  };

  const createServer = async () => {
    try {
      const response = await axios.post(`${API}/servers`, 
        { name: newServerName },
        { withCredentials: true }
      );
      setServers([...servers, response.data]);
      setSelectedServer(response.data);
      setNewServerName("");
      setShowCreateServer(false);
    } catch (error) {
      console.error("Error creating server:", error);
    }
  };

  const createChannel = async () => {
    try {
      const response = await axios.post(
        `${API}/servers/${selectedServer.id}/channels`,
        { name: newChannelName, type: newChannelType },
        { withCredentials: true }
      );
      setChannels([...channels, response.data]);
      setNewChannelName("");
      setShowCreateChannel(false);
    } catch (error) {
      console.error("Error creating channel:", error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim()) return;

    try {
      const response = await axios.post(
        `${API}/channels/${selectedChannel.id}/messages`,
        { content: messageInput },
        { withCredentials: true }
      );
      
      // Broadcast via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: "new_message",
          message: response.data
        }));
      }
      
      setMessageInput("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const getChannelIcon = (type) => {
    switch(type) {
      case "voice": return "🎙️";
      case "video": return "📹";
      default: return "💬";
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case "online": return "bg-green-500";
      case "idle": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="cosmic-bg min-h-screen flex">
      <div className="stars"></div>
      
      {/* Server List Sidebar */}
      <div className="w-20 cosmic-panel flex flex-col items-center py-4 space-y-3 z-10">
        <div className="text-2xl mb-4">🌌</div>
        {servers.map(server => (
          <button
            key={server.id}
            onClick={() => setSelectedServer(server)}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all hover:rounded-xl ${
              selectedServer?.id === server.id ? 'bg-astral-accent' : 'bg-astral-dark'
            }`}
            title={server.name}
          >
            🪐
          </button>
        ))}
        <button
          onClick={() => setShowCreateServer(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center text-3xl bg-astral-dark hover:bg-astral-accent transition-all hover:rounded-xl"
          title="Create Server"
        >
          +
        </button>
      </div>

      {/* Channels Sidebar */}
      {selectedServer && (
        <div className="w-60 cosmic-panel-light flex flex-col z-10">
          <div className="p-4 border-b border-astral-hover">
            <h2 className="font-bold text-lg text-white">{selectedServer.name}</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <div className="mb-2 flex justify-between items-center px-2">
              <span className="text-xs text-gray-400 font-semibold">CHANNELS</span>
              <button
                onClick={() => setShowCreateChannel(true)}
                className="text-gray-400 hover:text-white text-lg"
                title="Create Channel"
              >
                +
              </button>
            </div>
            {channels.map(channel => (
              <button
                key={channel.id}
                onClick={() => setSelectedChannel(channel)}
                className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center space-x-2 transition-colors ${
                  selectedChannel?.id === channel.id ? 'bg-astral-hover text-white' : 'text-gray-300 hover:bg-astral-hover hover:text-white'
                }`}
              >
                <span>{getChannelIcon(channel.type)}</span>
                <span className="text-sm">{channel.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      {selectedChannel ? (
        <div className="flex-1 flex flex-col z-10">
          {/* Channel Header */}
          <div className="h-16 cosmic-panel-light flex items-center px-6 border-b border-astral-hover">
            <span className="text-xl mr-2">{getChannelIcon(selectedChannel.type)}</span>
            <span className="font-semibold text-white">{selectedChannel.name}</span>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(message => {
              const sender = members.find(m => m.id === message.user_id);
              return (
                <div key={message.id} className="flex space-x-3">
                  <div className="w-10 h-10 rounded-full bg-astral-accent flex items-center justify-center flex-shrink-0">
                    {sender?.picture ? (
                      <img src={sender.picture} alt={sender.name} className="w-full h-full rounded-full" />
                    ) : (
                      <span>👤</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-semibold text-white">{sender?.name || "Unknown"}</span>
                      <span className="text-xs text-gray-400">{formatTime(message.created_at)}</span>
                    </div>
                    <div className="text-gray-200">{message.content}</div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <div className="p-4">
            <form onSubmit={sendMessage}>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                placeholder={`Message #${selectedChannel.name}`}
                className="w-full cosmic-input px-4 py-3 rounded-lg"
              />
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-6xl mb-4">🌠</div>
            <p className="text-gray-400">Select a channel to start chatting</p>
          </div>
        </div>
      )}

      {/* Members Sidebar */}
      {selectedServer && (
        <div className="w-60 cosmic-panel-light flex flex-col z-10">
          <div className="p-4 border-b border-astral-hover">
            <h3 className="text-xs text-gray-400 font-semibold">MEMBERS — {members.length}</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {members.map(member => (
              <div key={member.id} className="flex items-center space-x-3 p-2 rounded hover:bg-astral-hover transition-colors">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-astral-accent flex items-center justify-center">
                    {member.picture ? (
                      <img src={member.picture} alt={member.name} className="w-full h-full rounded-full" />
                    ) : (
                      <span className="text-sm">👤</span>
                    )}
                  </div>
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-astral-dark ${getStatusColor(member.status)}`}></div>
                </div>
                <span className="text-sm text-gray-200">{member.name}</span>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-astral-hover">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full bg-astral-accent flex items-center justify-center">
                {user?.picture ? (
                  <img src={user.picture} alt={user.name} className="w-full h-full rounded-full" />
                ) : (
                  <span className="text-sm">👤</span>
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white">{user?.name}</div>
                <div className="text-xs text-gray-400">{user?.email}</div>
              </div>
              <button
                onClick={onLogout}
                className="text-gray-400 hover:text-white transition-colors"
                title="Logout"
              >
                🚪
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Server Modal */}
      {showCreateServer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="cosmic-panel p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4 text-white">Create Server</h2>
            <input
              type="text"
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              placeholder="Server name"
              className="cosmic-input w-full px-4 py-2 rounded mb-4"
              autoFocus
            />
            <div className="flex space-x-2">
              <button
                onClick={createServer}
                className="cosmic-btn flex-1 py-2"
                disabled={!newServerName.trim()}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateServer(false);
                  setNewServerName("");
                }}
                className="cosmic-btn-secondary flex-1 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Channel Modal */}
      {showCreateChannel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="cosmic-panel p-6 rounded-lg w-96">
            <h2 className="text-xl font-bold mb-4 text-white">Create Channel</h2>
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Channel name"
              className="cosmic-input w-full px-4 py-2 rounded mb-4"
              autoFocus
            />
            <select
              value={newChannelType}
              onChange={(e) => setNewChannelType(e.target.value)}
              className="cosmic-input w-full px-4 py-2 rounded mb-4"
            >
              <option value="text">💬 Text Channel</option>
              <option value="voice">🎙️ Voice Channel</option>
              <option value="video">📹 Video Channel</option>
            </select>
            <div className="flex space-x-2">
              <button
                onClick={createChannel}
                className="cosmic-btn flex-1 py-2"
                disabled={!newChannelName.trim()}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateChannel(false);
                  setNewChannelName("");
                }}
                className="cosmic-btn-secondary flex-1 py-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check for session_id in URL fragment
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      const sessionId = hash.split('session_id=')[1].split('&')[0];
      processSession(sessionId);
    } else {
      // Check existing session
      checkAuth();
    }
  }, []);

  const processSession = async (sessionId) => {
    try {
      const response = await axios.get(`${API}/auth/session?session_id=${sessionId}`, {
        withCredentials: true
      });
      
      // Clean URL
      window.history.replaceState({}, document.title, '/dashboard');
      
      // Get user data
      await checkAuth();
    } catch (error) {
      console.error("Session processing error:", error);
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      console.log("Not authenticated");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      setUser(null);
      window.location.href = '/';
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (loading) {
    return (
      <div className="cosmic-bg min-h-screen flex items-center justify-center">
        <div className="stars"></div>
        <div className="text-center z-10">
          <div className="text-6xl mb-4 animate-pulse">🌌</div>
          <p className="text-gray-300">Loading AstralLink...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

export default App;
