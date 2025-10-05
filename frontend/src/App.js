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
  
  // WebRTC State
  const [inVoiceChannel, setInVoiceChannel] = useState(false);
  const [voiceChannelId, setVoiceChannelId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [peerConnections, setPeerConnections] = useState({});
  const signalingWsRef = useRef(null);
  const localVideoRef = useRef(null);
  const audioContextRef = useRef(null);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());

  // Productivity State
  const [currentView, setCurrentView] = useState("channels"); // channels, calendar, tasks, notes
  const [events, setEvents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notes, setNotes] = useState([]);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateNote, setShowCreateNote] = useState(false);
  const [selectedNote, setSelectedNote] = useState(null);
  const [calendarView, setCalendarView] = useState("month"); // day, week, month

  useEffect(() => {
    loadServers();
  }, []);

  useEffect(() => {
    if (selectedServer) {
      loadChannels(selectedServer.id);
      loadMembers(selectedServer.id);
      loadEvents(selectedServer.id);
      loadTasks(selectedServer.id);
      loadNotes(selectedServer.id);
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

  // ===== PRODUCTIVITY FUNCTIONS =====
  const loadEvents = async (serverId) => {
    try {
      const response = await axios.get(`${API}/servers/${serverId}/events`, { withCredentials: true });
      setEvents(response.data);
    } catch (error) {
      console.error("Error loading events:", error);
    }
  };

  const loadTasks = async (serverId) => {
    try {
      const response = await axios.get(`${API}/servers/${serverId}/tasks`, { withCredentials: true });
      setTasks(response.data);
    } catch (error) {
      console.error("Error loading tasks:", error);
    }
  };

  const loadNotes = async (serverId) => {
    try {
      const response = await axios.get(`${API}/servers/${serverId}/notes`, { withCredentials: true });
      setNotes(response.data);
    } catch (error) {
      console.error("Error loading notes:", error);
    }
  };

  const createEvent = async (eventData) => {
    try {
      const response = await axios.post(
        `${API}/servers/${selectedServer.id}/events`,
        eventData,
        { withCredentials: true }
      );
      setEvents([...events, response.data]);
      setShowCreateEvent(false);
    } catch (error) {
      console.error("Error creating event:", error);
    }
  };

  const createTask = async (taskData) => {
    try {
      const response = await axios.post(
        `${API}/servers/${selectedServer.id}/tasks`,
        taskData,
        { withCredentials: true }
      );
      setTasks([...tasks, response.data]);
      setShowCreateTask(false);
    } catch (error) {
      console.error("Error creating task:", error);
    }
  };

  const createNote = async (noteData) => {
    try {
      const response = await axios.post(
        `${API}/servers/${selectedServer.id}/notes`,
        noteData,
        { withCredentials: true }
      );
      setNotes([...notes, response.data]);
      setShowCreateNote(false);
    } catch (error) {
      console.error("Error creating note:", error);
    }
  };

  const toggleTaskComplete = async (taskId, completed) => {
    try {
      await axios.put(
        `${API}/servers/${selectedServer.id}/tasks/${taskId}`,
        { completed },
        { withCredentials: true }
      );
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed } : t));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      await axios.delete(
        `${API}/servers/${selectedServer.id}/tasks/${taskId}`,
        { withCredentials: true }
      );
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const updateNote = async (noteId, content) => {
    try {
      await axios.put(
        `${API}/servers/${selectedServer.id}/notes/${noteId}`,
        { content },
        { withCredentials: true }
      );
      setNotes(notes.map(n => n.id === noteId ? { ...n, content } : n));
    } catch (error) {
      console.error("Error updating note:", error);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      await axios.delete(
        `${API}/servers/${selectedServer.id}/notes/${noteId}`,
        { withCredentials: true }
      );
      setNotes(notes.filter(n => n.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
      }
    } catch (error) {
      console.error("Error deleting note:", error);
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

  // ===== WEBRTC FUNCTIONS =====
  const joinVoiceChannel = async (channel) => {
    try {
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: channel.type === "video"
      });
      
      setLocalStream(stream);
      setInVoiceChannel(true);
      setVoiceChannelId(channel.id);
      if (channel.type === "video") {
        setIsVideoEnabled(true);
      }

      // Display local video
      if (localVideoRef.current && channel.type === "video") {
        localVideoRef.current.srcObject = stream;
      }

      // Setup audio analysis for speaking indicator
      setupAudioAnalyzer(stream);

      // Join voice channel on backend
      await axios.post(`${API}/channels/${channel.id}/join`, {}, { withCredentials: true });

      // Load existing participants
      const response = await axios.get(`${API}/channels/${channel.id}/participants`, { withCredentials: true });
      setVoiceParticipants(response.data);

      // Setup signaling WebSocket
      connectSignalingWebSocket(channel.id, response.data);

    } catch (error) {
      console.error("Error joining voice channel:", error);
      alert("Failed to access microphone/camera. Please check permissions.");
    }
  };

  const leaveVoiceChannel = async () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    setPeerConnections({});
    setRemoteStreams({});

    // Close signaling WebSocket
    if (signalingWsRef.current) {
      signalingWsRef.current.close();
    }

    // Leave on backend
    if (voiceChannelId) {
      await axios.post(`${API}/channels/${voiceChannelId}/leave`, {}, { withCredentials: true });
    }

    setInVoiceChannel(false);
    setVoiceChannelId(null);
    setVoiceParticipants([]);
    setIsMuted(false);
    setIsVideoEnabled(false);
  };

  const toggleMute = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        // Update backend
        await axios.post(
          `${API}/channels/${voiceChannelId}/toggle-mute?is_muted=${!audioTrack.enabled}`,
          {},
          { withCredentials: true }
        );
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
        
        // Update backend
        await axios.post(
          `${API}/channels/${voiceChannelId}/toggle-video?is_video_enabled=${videoTrack.enabled}`,
          {},
          { withCredentials: true }
        );
      }
    }
  };

  const setupAudioAnalyzer = (stream) => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    const microphone = audioContext.createMediaStreamSource(stream);
    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;
    
    microphone.connect(analyser);
    audioContextRef.current = { audioContext, analyser };

    // Monitor audio levels
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const checkAudioLevel = () => {
      if (!audioContextRef.current) return;
      
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      
      if (average > 20) {
        setSpeakingUsers(prev => new Set(prev).add(user.id));
      } else {
        setSpeakingUsers(prev => {
          const newSet = new Set(prev);
          newSet.delete(user.id);
          return newSet;
        });
      }
      
      requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  const connectSignalingWebSocket = (channelId, existingParticipants) => {
    const ws = new WebSocket(`${WS_URL}/ws/signaling/${user.id}`);
    
    ws.onopen = () => {
      console.log("Signaling WebSocket connected");
      
      // Create peer connections for existing participants
      existingParticipants.forEach(participant => {
        if (participant.user_id !== user.id) {
          createPeerConnection(participant.user_id, true);
        }
      });
    };

    ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === "offer") {
        await handleOffer(message);
      } else if (message.type === "answer") {
        await handleAnswer(message);
      } else if (message.type === "ice-candidate") {
        await handleIceCandidate(message);
      }
    };

    signalingWsRef.current = ws;
  };

  const createPeerConnection = (targetUserId, createOffer) => {
    const configuration = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" }
      ]
    };

    const pc = new RTCPeerConnection(configuration);

    // Add local stream tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [targetUserId]: event.streams[0]
      }));
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && signalingWsRef.current) {
        signalingWsRef.current.send(JSON.stringify({
          type: "ice-candidate",
          target: targetUserId,
          candidate: event.candidate
        }));
      }
    };

    setPeerConnections(prev => ({ ...prev, [targetUserId]: pc }));

    // Create and send offer if initiator
    if (createOffer) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          if (signalingWsRef.current) {
            signalingWsRef.current.send(JSON.stringify({
              type: "offer",
              target: targetUserId,
              offer: pc.localDescription
            }));
          }
        });
    }

    return pc;
  };

  const handleOffer = async (message) => {
    const pc = createPeerConnection(message.from, false);
    await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (signalingWsRef.current) {
      signalingWsRef.current.send(JSON.stringify({
        type: "answer",
        target: message.from,
        answer: pc.localDescription
      }));
    }
  };

  const handleAnswer = async (message) => {
    const pc = peerConnections[message.from];
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
    }
  };

  const handleIceCandidate = async (message) => {
    const pc = peerConnections[message.from];
    if (pc && message.candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(message.candidate));
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
                onClick={() => {
                  setSelectedChannel(channel);
                  setCurrentView("channels");
                }}
                className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center space-x-2 transition-colors ${
                  selectedChannel?.id === channel.id && currentView === "channels" ? 'bg-astral-hover text-white' : 'text-gray-300 hover:bg-astral-hover hover:text-white'
                }`}
              >
                <span>{getChannelIcon(channel.type)}</span>
                <span className="text-sm">{channel.name}</span>
              </button>
            ))}

            {/* Productivity Section */}
            <div className="mt-6 mb-2 px-2">
              <span className="text-xs text-gray-400 font-semibold">PRODUCTIVITY</span>
            </div>
            
            <button
              onClick={() => {
                setCurrentView("calendar");
                setSelectedChannel(null);
              }}
              className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center space-x-2 transition-colors ${
                currentView === "calendar" ? 'bg-astral-hover text-white' : 'text-gray-300 hover:bg-astral-hover hover:text-white'
              }`}
            >
              <span>📅</span>
              <span className="text-sm">Calendar</span>
            </button>

            <button
              onClick={() => {
                setCurrentView("tasks");
                setSelectedChannel(null);
              }}
              className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center space-x-2 transition-colors ${
                currentView === "tasks" ? 'bg-astral-hover text-white' : 'text-gray-300 hover:bg-astral-hover hover:text-white'
              }`}
            >
              <span>📝</span>
              <span className="text-sm">To-Do</span>
            </button>

            <button
              onClick={() => {
                setCurrentView("notes");
                setSelectedChannel(null);
              }}
              className={`w-full text-left px-3 py-2 rounded mb-1 flex items-center space-x-2 transition-colors ${
                currentView === "notes" ? 'bg-astral-hover text-white' : 'text-gray-300 hover:bg-astral-hover hover:text-white'
              }`}
            >
              <span>🗒️</span>
              <span className="text-sm">Notes</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {(selectedChannel && currentView === "channels") ? (
        <div className="flex-1 flex flex-col z-10">
          {/* Channel Header */}
          <div className="h-16 cosmic-panel-light flex items-center justify-between px-6 border-b border-astral-hover">
            <div className="flex items-center">
              <span className="text-xl mr-2">{getChannelIcon(selectedChannel.type)}</span>
              <span className="font-semibold text-white">{selectedChannel.name}</span>
            </div>
            
            {/* Voice/Video Controls */}
            {(selectedChannel.type === "voice" || selectedChannel.type === "video") && (
              <div className="flex items-center space-x-2">
                {!inVoiceChannel ? (
                  <button
                    onClick={() => joinVoiceChannel(selectedChannel)}
                    className="cosmic-btn px-4 py-2 text-sm"
                  >
                    {selectedChannel.type === "video" ? "📹 Join Video" : "🎙️ Join Voice"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={`px-4 py-2 rounded text-sm ${isMuted ? 'bg-red-600' : 'bg-astral-hover'} text-white`}
                    >
                      {isMuted ? "🔇 Unmute" : "🎤 Mute"}
                    </button>
                    {selectedChannel.type === "video" && (
                      <button
                        onClick={toggleVideo}
                        className={`px-4 py-2 rounded text-sm ${!isVideoEnabled ? 'bg-red-600' : 'bg-astral-hover'} text-white`}
                      >
                        {isVideoEnabled ? "📹 Camera On" : "📹 Camera Off"}
                      </button>
                    )}
                    <button
                      onClick={leaveVoiceChannel}
                      className="px-4 py-2 rounded text-sm bg-red-600 text-white"
                    >
                      ❌ Leave
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Content based on channel type */}
          {selectedChannel.type === "text" ? (
            <>
              {/* Text Messages Area */}
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
            </>
          ) : (
            <>
              {/* Voice/Video Channel View */}
              <div className="flex-1 overflow-y-auto p-6">
                {!inVoiceChannel ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-6xl mb-4">
                        {selectedChannel.type === "video" ? "📹" : "🎙️"}
                      </div>
                      <h3 className="text-2xl font-bold text-white mb-2">
                        {selectedChannel.type === "video" ? "Video Channel" : "Voice Channel"}
                      </h3>
                      <p className="text-gray-400 mb-6">
                        Click "Join {selectedChannel.type === "video" ? "Video" : "Voice"}" to connect
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-full">
                    {selectedChannel.type === "video" ? (
                      /* Video Grid */
                      <div className="grid grid-cols-2 gap-4 h-full">
                        {/* Local Video */}
                        <div className="relative bg-astral-dark rounded-lg overflow-hidden">
                          <video
                            ref={localVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded">
                            <span className="text-white text-sm">{user.name} (You)</span>
                          </div>
                          {isMuted && (
                            <div className="absolute top-4 right-4 bg-red-600 p-2 rounded-full">
                              <span>🔇</span>
                            </div>
                          )}
                        </div>

                        {/* Remote Videos */}
                        {Object.entries(remoteStreams).map(([userId, stream]) => {
                          const participant = voiceParticipants.find(p => p.user_id === userId);
                          return (
                            <div key={userId} className="relative bg-astral-dark rounded-lg overflow-hidden">
                              <video
                                autoPlay
                                playsInline
                                className="w-full h-full object-cover"
                                ref={el => {
                                  if (el && stream) el.srcObject = stream;
                                }}
                              />
                              <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 px-3 py-1 rounded">
                                <span className="text-white text-sm">
                                  {participant?.user?.name || "Unknown"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Voice Channel Participants */
                      <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <h3 className="text-xl text-gray-400">Voice Channel Participants</h3>
                        <div className="grid grid-cols-4 gap-6">
                          {/* Current User */}
                          <div className="flex flex-col items-center">
                            <div className={`w-24 h-24 rounded-full bg-astral-accent flex items-center justify-center mb-2 ${
                              speakingUsers.has(user.id) ? 'ring-4 ring-green-500 animate-pulse' : ''
                            }`}>
                              <img src={user.picture} alt={user.name} className="w-full h-full rounded-full" />
                            </div>
                            <span className="text-white text-sm">{user.name} (You)</span>
                            {isMuted && <span className="text-red-500 text-xs">🔇 Muted</span>}
                          </div>

                          {/* Other Participants */}
                          {voiceParticipants.filter(p => p.user_id !== user.id).map(participant => (
                            <div key={participant.user_id} className="flex flex-col items-center">
                              <div className="w-24 h-24 rounded-full bg-astral-accent flex items-center justify-center mb-2">
                                <img
                                  src={participant.user?.picture}
                                  alt={participant.user?.name}
                                  className="w-full h-full rounded-full"
                                />
                              </div>
                              <span className="text-white text-sm">{participant.user?.name}</span>
                              {participant.is_muted && <span className="text-red-500 text-xs">🔇 Muted</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : currentView === "calendar" ? (
        <div className="flex-1 flex flex-col z-10">
          <div className="h-16 cosmic-panel-light flex items-center justify-between px-6 border-b border-astral-hover">
            <div className="flex items-center">
              <span className="text-xl mr-2">📅</span>
              <span className="font-semibold text-white">Calendar</span>
            </div>
            <button
              onClick={() => setShowCreateEvent(true)}
              className="cosmic-btn px-4 py-2 text-sm"
            >
              + New Event
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <h3 className="text-xl font-bold text-white mb-4">Upcoming Events</h3>
              {events.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No events scheduled</p>
              ) : (
                <div className="space-y-3">
                  {events.map(event => (
                    <div key={event.id} className="cosmic-panel p-4 rounded-lg border-l-4" style={{ borderColor: event.color }}>
                      <h4 className="font-bold text-white mb-1">{event.title}</h4>
                      {event.description && <p className="text-gray-300 text-sm mb-2">{event.description}</p>}
                      <div className="flex items-center text-sm text-gray-400 space-x-4">
                        <span>🕐 {new Date(event.start_time).toLocaleString()}</span>
                        {event.assigned_to.length > 0 && (
                          <span>👥 {event.assigned_to.length} assigned</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : currentView === "tasks" ? (
        <div className="flex-1 flex flex-col z-10">
          <div className="h-16 cosmic-panel-light flex items-center justify-between px-6 border-b border-astral-hover">
            <div className="flex items-center">
              <span className="text-xl mr-2">📝</span>
              <span className="font-semibold text-white">To-Do</span>
            </div>
            <button
              onClick={() => setShowCreateTask(true)}
              className="cosmic-btn px-4 py-2 text-sm"
            >
              + New Task
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto">
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-3">Active Tasks</h3>
                {tasks.filter(t => !t.completed).length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No active tasks</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.filter(t => !t.completed).map(task => (
                      <div key={task.id} className="cosmic-panel p-4 rounded-lg flex items-start space-x-3">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTaskComplete(task.id, !task.completed)}
                          className="mt-1 w-5 h-5 cursor-pointer"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-white mb-1">{task.title}</h4>
                          {task.description && <p className="text-gray-300 text-sm mb-2">{task.description}</p>}
                          <div className="flex items-center text-xs text-gray-400 space-x-3">
                            <span className={`px-2 py-1 rounded ${
                              task.priority === 'high' ? 'bg-red-900' : task.priority === 'medium' ? 'bg-yellow-900' : 'bg-green-900'
                            }`}>
                              {task.priority.toUpperCase()}
                            </span>
                            {task.deadline && <span>⏰ {new Date(task.deadline).toLocaleDateString()}</span>}
                            {task.assigned_to.length > 0 && <span>👥 {task.assigned_to.length}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white mb-3">Completed Tasks</h3>
                {tasks.filter(t => t.completed).length === 0 ? (
                  <p className="text-gray-400 text-center py-4">No completed tasks</p>
                ) : (
                  <div className="space-y-2">
                    {tasks.filter(t => t.completed).map(task => (
                      <div key={task.id} className="cosmic-panel p-4 rounded-lg flex items-start space-x-3 opacity-60">
                        <input
                          type="checkbox"
                          checked={task.completed}
                          onChange={() => toggleTaskComplete(task.id, !task.completed)}
                          className="mt-1 w-5 h-5 cursor-pointer"
                        />
                        <div className="flex-1">
                          <h4 className="font-semibold text-white line-through">{task.title}</h4>
                        </div>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : currentView === "notes" ? (
        <div className="flex-1 flex z-10">
          <div className="w-64 cosmic-panel-light flex flex-col border-r border-astral-hover">
            <div className="p-4 border-b border-astral-hover flex justify-between items-center">
              <h3 className="font-semibold text-white">Notes</h3>
              <button
                onClick={() => setShowCreateNote(true)}
                className="text-astral-accent hover:text-white text-xl"
              >
                +
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {notes.map(note => (
                <button
                  key={note.id}
                  onClick={() => setSelectedNote(note)}
                  className={`w-full text-left px-3 py-3 rounded mb-2 transition-colors ${
                    selectedNote?.id === note.id ? 'bg-astral-hover text-white' : 'text-gray-300 hover:bg-astral-hover'
                  }`}
                >
                  <div className="font-semibold text-sm truncate">{note.title}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(note.updated_at).toLocaleDateString()}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 flex flex-col">
            {selectedNote ? (
              <>
                <div className="h-16 cosmic-panel-light flex items-center justify-between px-6 border-b border-astral-hover">
                  <div className="flex items-center">
                    <span className="text-xl mr-2">🗒️</span>
                    <span className="font-semibold text-white">{selectedNote.title}</span>
                  </div>
                  <button
                    onClick={() => deleteNote(selectedNote.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    🗑️ Delete
                  </button>
                </div>
                <div className="flex-1 p-6">
                  <textarea
                    value={selectedNote.content}
                    onChange={(e) => setSelectedNote({ ...selectedNote, content: e.target.value })}
                    onBlur={() => updateNote(selectedNote.id, selectedNote.content)}
                    className="w-full h-full bg-astral-dark text-white p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-astral-accent"
                    placeholder="Start writing... (Markdown supported)"
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-400">Select a note or create a new one</p>
              </div>
            )}
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

      {/* Create Event Modal */}
      {showCreateEvent && (
        <EventModal
          onClose={() => setShowCreateEvent(false)}
          onCreate={createEvent}
          members={members}
        />
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <TaskModal
          onClose={() => setShowCreateTask(false)}
          onCreate={createTask}
          members={members}
        />
      )}

      {/* Create Note Modal */}
      {showCreateNote && (
        <NoteModal
          onClose={() => setShowCreateNote(false)}
          onCreate={createNote}
        />
      )}
    </div>
  );
};

// ===== PRODUCTIVITY MODALS =====
const EventModal = ({ onClose, onCreate, members }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState("#9F86FF");

  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime) return;
    onCreate({
      title,
      description,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      color,
      assigned_to: []
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="cosmic-panel p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-white">📅 Create Event</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
          rows="3"
        />
        <label className="block text-gray-300 text-sm mb-1">Start Time</label>
        <input
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
        />
        <label className="block text-gray-300 text-sm mb-1">End Time</label>
        <input
          type="datetime-local"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
        />
        <label className="block text-gray-300 text-sm mb-1">Color</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-full h-10 rounded cursor-pointer mb-4"
        />
        <div className="flex space-x-2">
          <button
            onClick={handleSubmit}
            className="cosmic-btn flex-1 py-2"
            disabled={!title.trim() || !startTime || !endTime}
          >
            Create
          </button>
          <button onClick={onClose} className="cosmic-btn-secondary flex-1 py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const TaskModal = ({ onClose, onCreate, members }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [deadline, setDeadline] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate({
      title,
      description,
      priority,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      assigned_to: []
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="cosmic-panel p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4 text-white">📝 Create Task</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
          autoFocus
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
          rows="3"
        />
        <label className="block text-gray-300 text-sm mb-1">Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="cosmic-input w-full px-4 py-2 rounded mb-3"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <label className="block text-gray-300 text-sm mb-1">Deadline (optional)</label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="cosmic-input w-full px-4 py-2 rounded mb-4"
        />
        <div className="flex space-x-2">
          <button
            onClick={handleSubmit}
            className="cosmic-btn flex-1 py-2"
            disabled={!title.trim()}
          >
            Create
          </button>
          <button onClick={onClose} className="cosmic-btn-secondary flex-1 py-2">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const NoteModal = ({ onClose, onCreate }) => {
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) return;
    onCreate({
      title,
      content: "",
      collaborative: true
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="cosmic-panel p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4 text-white">🗒️ Create Note</h2>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="cosmic-input w-full px-4 py-2 rounded mb-4"
          autoFocus
        />
        <div className="flex space-x-2">
          <button
            onClick={handleSubmit}
            className="cosmic-btn flex-1 py-2"
            disabled={!title.trim()}
          >
            Create
          </button>
          <button onClick={onClose} className="cosmic-btn-secondary flex-1 py-2">
            Cancel
          </button>
        </div>
      </div>
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
