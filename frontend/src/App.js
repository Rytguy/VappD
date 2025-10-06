import React, { useState, useEffect, useRef } from "react";
import "@/App.css";
import axios from "axios";

import { Picker } from 'emoji-mart'
import 'emoji-mart/css/emoji-mart.css'

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";


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
  const [games, setGames] = useState([]);
  const [activeGame, setActiveGame] = useState(null);
  const [opponentId, setOpponentId] = useState(null); // Opponent user_id selection
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);

  const [uploading, setUploading] = useState(false); // <-- Place here with your other hooks

  // Calendar date and editing state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState(null);
  
  // Calendar helpers
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  const startOfMonthGrid = (date) => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const weekday = first.getDay(); // 0=Sun
    const diff = (weekday + 6) % 7; // Monday as first; change if Sunday start is desired
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - diff);
    gridStart.setHours(0,0,0,0);
    return gridStart;
  };
  const addDays = (date, n) => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  };
  const isSameDay = (a,b) =>
    a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  
  // Event update/delete API
  const updateEvent = async (eventId, patch) => {
    try {
      const res = await axios.put(`${API}/servers/${selectedServer.id}/events/${eventId}`, patch, { withCredentials: true });
      setEvents(evts => evts.map(e => e.id === eventId ? res.data : e));
    } catch (err) {
      console.error("Error updating event:", err);
      alert("Failed to update event");
    }

  const CalendarView = ({ view, date, events, onOpenChannel, onEdit, onDelete }) => {
    if (view === "day") {
      const dayStart = startOfDay(date);
      const dayEnd = endOfDay(date);
      const dayEvents = events.filter(ev => {
        const s = new Date(ev.start_time);
        return s >= dayStart && s <= dayEnd;
      }).sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
      return (
        <div className="max-w-5xl mx-auto">
          <h4 className="text-white font-semibold mb-2">{date.toDateString()}</h4>
          {dayEvents.length === 0 ? (
            <div className="text-gray-400">No events today</div>
          ) : (
            <div className="space-y-2">
              {dayEvents.map(ev => (
                <CalendarEventCard key={ev.id} ev={ev} onOpenChannel={onOpenChannel} onEdit={onEdit} onDelete={onDelete} />
              ))}
            </div>
          )}
        </div>
      );
    }
  
    if (view === "week") {
      const weekStart = addDays(date, -((date.getDay() + 6) % 7));
      const weekDays = Array.from({length: 7}, (_,i) => addDays(weekStart, i));
      return (
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map(d => {
              const dayEvents = events.filter(ev => isSameDay(new Date(ev.start_time), d));
              return (
                <div key={d.toISOString()} className="cosmic-panel p-3 rounded min-h-[120px]">
                  <div className="text-gray-300 text-sm mb-2">{d.toDateString()}</div>
                  <div className="space-y-1">
                    {dayEvents.map(ev => (
                      <div
                        key={ev.id}
                        className="text-xs p-2 rounded cursor-pointer"
                        style={{background: `${(ev.color || "#9F86FF")}20`, borderLeft: `3px solid ${ev.color || "#9F86FF"}`}}
                        onClick={() => onEdit(ev)}
                      >
                        <div className="text-white truncate">{ev.title}</div>
                        <div className="text-gray-400">
                          {new Date(ev.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  
    // Month view
    const gridStart = startOfMonthGrid(date);
    const days = Array.from({length: 42}, (_,i) => addDays(gridStart, i)); // 6 rows
  
    return (
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-7 gap-2">
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d => (
            <div key={d} className="text-center text-gray-400 text-sm">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map(d => {
            const inMonth = d.getMonth() === date.getMonth();
            const dayEvents = events.filter(ev => isSameDay(new Date(ev.start_time), d));
            return (
              <div key={d.toISOString()} className={`cosmic-panel p-3 rounded min-h-[120px] ${inMonth ? "" : "opacity-50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-300 text-sm">{d.getDate()}</div>
                </div>
                <div className="space-y-1">
                  {dayEvents.slice(0,3).map(ev => (
                    <div
                      key={ev.id}
                      className="text-xs p-2 rounded cursor-pointer"
                      style={{background: `${(ev.color || "#9F86FF")}20`, borderLeft: `3px solid ${ev.color || "#9F86FF"}`}}
                      onClick={() => onEdit(ev)}
                    >
                      <div className="text-white truncate">{ev.title}</div>
                      <div className="text-gray-400">
                        {new Date(ev.start_time).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                      </div>
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-xs text-astral-accent cursor-pointer">
                      +{dayEvents.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  
  const CalendarEventCard = ({ ev, onOpenChannel, onEdit, onDelete }) => (
    <div className="cosmic-panel p-4 rounded-lg border-l-4" style={{borderColor: ev.color || "#9F86FF"}}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-bold text-white mb-1">{ev.title}</h4>
          {ev.description && <p className="text-gray-300 text-sm mb-2">{ev.description}</p>}
          <div className="flex items-center text-sm text-gray-400 space-x-4">
            <span>{new Date(ev.start_time).toLocaleString()}</span>
            <span>→</span>
            <span>{new Date(ev.end_time).toLocaleString()}</span>
            {ev.channel_link && (
              <button
                className="text-astral-accent hover:text-white underline"
                onClick={() => onOpenChannel(ev.channel_link)}
              >
                Open Channel
              </button>
            )}
          </div>
        </div>
        <div className="space-x-2">
          <button className="px-3 py-1 bg-astral-dark rounded" onClick={() => onEdit(ev)}>Edit</button>
          <button className="px-3 py-1 bg-red-700 rounded" onClick={() => onDelete(ev)}>Delete</button>
        </div>
      </div>
    </div>
  );

  };
  
  const deleteEventById = async (eventId) => {
    try {
      await axios.delete(`${API}/servers/${selectedServer.id}/events/${eventId}`, { withCredentials: true });
      setEvents(evts => evts.filter(e => e.id !== eventId));
    } catch (err) {
      console.error("Error deleting event:", err);
      alert("Failed to delete event");
    }
  };

  
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

  const [replyTo, setReplyTo] = useState(null);
  const [starModeEnabled, setStarModeEnabled] = useState(false);


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

  
  // Ask permission once for notifications (if not already requested)
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);
  
  const reminderTimersRef = useRef({}); // eventId -> timeoutId
  
  useEffect(() => {
    // Clear old timers
    Object.values(reminderTimersRef.current).forEach(clearTimeout);
    reminderTimersRef.current = {};
  
    if (!events || !events.length) return;
    const now = Date.now();
  
    events.forEach(ev => {
      const startTs = new Date(ev.start_time).getTime();
      const remindAt = startTs - 5 * 60 * 1000; // 5 minutes before
      if (remindAt > now) {
        const delay = remindAt - now;
        const t = setTimeout(() => {
          const title = `Upcoming: ${ev.title}`;
          const body = `${new Date(ev.start_time).toLocaleString()}${ev.channel_link ? " · Click to open channel" : ""}`;
          // Desktop notification
          if ("Notification" in window && Notification.permission === "granted") {
            const n = new Notification(title, { body });
            n.onclick = () => {
              if (ev.channel_link) {
                const ch = channels.find(c => c.id === ev.channel_link);
                if (ch) {
                  setSelectedChannel(ch);
                  setCurrentView("channels");
                }
              }
              window.focus();
            };
          } else {
            // In-app fallback
            alert(`${title}\n${body}`);
            if (ev.channel_link) {
              const ch = channels.find(c => c.id === ev.channel_link);
              if (ch) {
                setSelectedChannel(ch);
                setCurrentView("channels");
              }
            }
          }
        }, delay);
        reminderTimersRef.current[ev.id] = t;
      }
    });
  
    return () => {
      Object.values(reminderTimersRef.current).forEach(clearTimeout);
      reminderTimersRef.current = {};
    };
  }, [events, channels, setSelectedChannel, setCurrentView]);


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
      {
        content: messageInput,
        parent_id: replyTo ? replyTo.id : null,      // <-- allow threading
        is_starred: starModeEnabled,                 // <-- allow starred threads
      },
      { withCredentials: true }
    );

    // Reset reply/starring states and input box
    setReplyTo(null);
    setStarModeEnabled(false);
    setMessageInput('');

    // Broadcast via WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "new_message",
        message: response.data
      }));
    }

    // Optional: clear message input again for extra safety
    setMessageInput('');
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

    // Load games for the server (lobby refresh)
    const loadGames = async () => {
      if (!selectedServer) return;
      const resp = await axios.get(`${API}/servers/${selectedServer.id}/games`, {withCredentials:true});
      setGames(resp.data);
    };
    useEffect(() => { loadGames(); }, [selectedServer]);
    
    // Start a new Tic Tac Toe game
    const startTicTacToe = async () => {
      if (!opponentId) {
        alert("You must select another member as opponent.");
        return;
      }
      // Current user always first in player_ids
      const player_ids = [user.id, opponentId];
      const resp = await axios.post(`${API}/servers/${selectedServer.id}/games`, {
        game_type: "tictactoe",
        player_ids,
      }, {withCredentials:true});
      setActiveGame(resp.data);
      loadGames();
    };
    
    // Select an existing game to resume/view
    const selectGame = async (game) => {
      setActiveGame(game);
    };
    
    // Submit a move
    const makeTicTacToeMove = async (cellIdx) => {
      if (!activeGame) return;
      const resp = await axios.post(`${API}/games/${activeGame.id}/move`, {cell: cellIdx}, {withCredentials:true});
      // Refetch updated game state
      const updated = await axios.get(`${API}/servers/${selectedServer.id}/games`, {withCredentials:true});
      const found = updated.data.find(g => g.id === activeGame.id);
      setActiveGame(found);
      if (resp.data.winner) {
        alert(`Game Over! Winner: ${resp.data.winner === user.id ? "You" : "Opponent"}`);
        loadGames();
      }
    };


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
                        <div className="text-gray-200 break-words">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>

                        <div className="mt-1 flex space-x-2">
                          <button
                            className="text-xs px-2 py-1 bg-astral-dark text-astral-accent rounded hover:bg-astral-accent hover:text-white"
                            onClick={() => setReplyTo(message)}
                          >
                            Reply
                          </button>
                          <button
                            className="text-xs px-2 py-1 bg-astral-dark text-astral-accent rounded hover:bg-astral-accent hover:text-white"
                            onClick={() => setStarModeEnabled(v => !v)}
                          >
                            {starModeEnabled ? "Unstar" : "Star"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="p-4">
                {replyTo && (
                    <div className="px-4 pt-2 pb-1 bg-astral-dark border-t border-astral-hover flex items-center justify-between">
                      <span className="text-sm text-gray-300">
                        Replying to <span className="font-semibold text-white">{members.find(m => m.id === replyTo.user_id)?.name || "Unknown"}</span>:&nbsp;
                        <span className="italic text-astral-accent truncate max-w-xs">{replyTo.content}</span>
                      </span>
                      <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white ml-4">
                        ✕
                      </button>
                    </div>
                  )}
                  
                  {/* Emoji picker and message input */}
                  <div className="p-4 relative">
                    {/* (Optional) Reply bar if replying */}
                    {replyTo && (
                      <div className="px-4 pt-2 pb-1 bg-astral-dark border-t border-astral-hover flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">
                          Replying to <span className="font-semibold text-white">{members.find(m => m.id === replyTo.user_id)?.name || "Unknown"}</span>:&nbsp;
                          <span className="italic text-astral-accent truncate max-w-xs">{replyTo.content}</span>
                        </span>
                        <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-white ml-4">
                          ✕
                        </button>
                      </div>
                    )}
                    <div className="flex items-end space-x-2">
                      {/* Emoji Button */}
                      <button
                        type="button"
                        className="text-2xl px-2 py-1 rounded hover:bg-astral-hover transition"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                        aria-label="Add emoji"
                      >
                        😊
                      </button>
                      {/* Message Input, File Upload, and Send Button All Together */}
                      <form className="flex-1 flex items-center" onSubmit={sendMessage}>
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          placeholder={`Message #${selectedChannel.name}`}
                          className="w-full cosmic-input px-4 py-3 rounded-lg"
                          disabled={uploading}
                        />
                        {/* File Upload Button */}
                        <label className="cursor-pointer px-2 py-2 rounded bg-astral-dark hover:bg-astral-hover text-xl ml-2 mb-0">
                          📎
                          <input
                            type="file"
                            accept="image/*,video/*,application/pdf,.txt,.md"
                            style={{display: 'none'}}
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              setUploading(true);
                              const formData = new FormData();
                              formData.append('file', file);
                              const res = await fetch(`${API}/upload`, {
                                method: 'POST',
                                body: formData,
                                credentials: 'include'
                              });
                              const { url } = await res.json();
                              // Insert markdown for images and files
                              const fileLine = url.match(/\.(jpg|jpeg|png|gif|bmp|webp)$/i)
                                ? `![](${url})`
                                : `[${file.name}](${url})`;
                              setMessageInput(input => input ? `${input}\n${fileLine}` : fileLine);
                              setUploading(false);
                            }}
                          />
                        </label>
                        {/* Send Button */}
                        <button type="submit" className="cosmic-btn px-4 py-2 ml-2" disabled={uploading}>
                          Send
                        </button>
                      </form>
                    </div>
                    {/* Emoji Picker Popover */}
                    {showEmojiPicker && (
                      <div className="absolute z-50">
                        <Picker onSelect={emoji => setMessageInput(input => input + emoji.native)} theme="dark" />
                      </div>
                    )}
                    {/* Uploading Indicator */}
                    {uploading && <div className="text-gray-400 text-xs mt-1">Uploading…</div>}
                  </div>

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
          {/* Header */}
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
      
          {/* Controls */}
          <div className="flex items-center justify-between px-6 py-3">
            <div className="space-x-2">
              <button
                className={`px-3 py-1 rounded ${calendarView === "month" ? "bg-astral-accent text-white" : "bg-astral-dark text-gray-300"}`}
                onClick={() => setCalendarView("month")}
              >
                Month
              </button>
              <button
                className={`px-3 py-1 rounded ${calendarView === "week" ? "bg-astral-accent text-white" : "bg-astral-dark text-gray-300"}`}
                onClick={() => setCalendarView("week")}
              >
                Week
              </button>
              <button
                className={`px-3 py-1 rounded ${calendarView === "day" ? "bg-astral-accent text-white" : "bg-astral-dark text-gray-300"}`}
                onClick={() => setCalendarView("day")}
              >
                Day
              </button>
            </div>
            <div className="space-x-2">
              <button className="px-3 py-1 bg-astral-dark rounded" onClick={() => setCalendarDate(addDays(calendarDate, -(calendarView === "month" ? 30 : calendarView === "week" ? 7 : 1)))}>Prev</button>
              <button className="px-3 py-1 bg-astral-dark rounded" onClick={() => setCalendarDate(new Date())}>Today</button>
              <button className="px-3 py-1 bg-astral-dark rounded" onClick={() => setCalendarDate(addDays(calendarDate, (calendarView === "month" ? 30 : calendarView === "week" ? 7 : 1)))}>Next</button>
            </div>
          </div>
      
          {/* Calendar Grid + Upcoming */}
          <div className="flex-1 overflow-y-auto p-6">
            <CalendarView
              view={calendarView}
              date={calendarDate}
              events={events}
              onOpenChannel={(channel_id) => {
                const ch = channels.find(c => c.id === channel_id);
                if (ch) {
                  setSelectedChannel(ch);
                  setCurrentView("channels");
                }
              }}
              onEdit={(ev) => setEditingEvent(ev)}
              onDelete={(ev) => deleteEventById(ev.id)}
            />
      
            {/* Upcoming Event List Below Grid */}
            <div className="max-w-4xl mx-auto mt-8">
              <h3 className="text-xl font-bold text-white mb-4">Upcoming Events</h3>
              {events.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No events scheduled</p>
              ) : (
                <div className="space-y-3">
                  {events
                    .slice()
                    .sort((a,b) => new Date(a.start_time) - new Date(b.start_time))
                    .map(ev => (
                    <div key={ev.id} className="cosmic-panel p-4 rounded-lg border-l-4" style={{borderColor: ev.color || "#9F86FF"}}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-white mb-1">{ev.title}</h4>
                          {ev.description && <p className="text-gray-300 text-sm mb-2">{ev.description}</p>}
                          <div className="flex items-center text-sm text-gray-400 space-x-4">
                            <span>{new Date(ev.start_time).toLocaleString()}</span>
                            <span>→</span>
                            <span>{new Date(ev.end_time).toLocaleString()}</span>
                            {ev.channel_link && (
                              <button
                                className="text-astral-accent hover:text-white underline"
                                onClick={() => {
                                  const ch = channels.find(c => c.id === ev.channel_link);
                                  if (ch) {
                                    setSelectedChannel(ch);
                                    setCurrentView("channels");
                                  }
                                }}
                              >Open Channel</button>
                            )}
                          </div>
                        </div>
                        <div className="space-x-2">
                          <button className="px-3 py-1 bg-astral-dark rounded" onClick={() => setEditingEvent(ev)}>Edit</button>
                          <button className="px-3 py-1 bg-red-700 rounded" onClick={() => deleteEventById(ev.id)}>Delete</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Edit Event Modal */}
          {editingEvent && (
            <EventEditModal
              event={editingEvent}
              members={members}
              channels={channels}
              onClose={() => setEditingEvent(null)}
              onSave={async (patch) => {
                await updateEvent(editingEvent.id, patch);
                setEditingEvent(null);
              }}
              onDelete={async () => {
                await deleteEventById(editingEvent.id);
                setEditingEvent(null);
              }}
            />
          )}
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
      ) : currentView === "games" ? (
        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Mini-Games Cosmos</h2>
          <div className="mb-4 flex items-center">
            <label className="mr-3 text-gray-300 font-medium">Opponent:</label>
            <select
              className="p-2 rounded cosmic-input"
              value={opponentId || ""}
              onChange={e => setOpponentId(e.target.value)}
            >
              <option value="">Select member...</option>
              {members
                .filter(m => m.id !== user.id)
                .map(m => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
            <button
              onClick={startTicTacToe}
              className="ml-4 cosmic-btn px-4 py-2"
              disabled={!opponentId}
            >
              Start Tic Tac Toe
            </button>
          </div>
          <div className="mb-6">
            <h3 className="text-white text-lg mb-2">Active Games</h3>
            <div className="space-y-2">
              {games.length === 0 && <div className="text-gray-400">No games yet.</div>}
              {games.map(g => (
                <div key={g.id} className="flex items-center space-x-3 cosmic-panel rounded p-2">
                  <div>
                    <span className="font-bold text-astral-accent">{g.game_type}</span>
                    {" — "}
                    <span className="text-white">
                      {members.find(m => m.id === g.player_ids[0])?.name}
                      {" vs "}
                      {members.find(m => m.id === g.player_ids[1])?.name}
                    </span>
                    {g.completed && <span className="ml-4 text-green-400">Finished</span>}
                    {!g.completed && <span className="ml-4 text-yellow-400">In Progress</span>}
                  </div>
                  <button
                    onClick={() => selectGame(g)}
                    className="cosmic-btn px-2 py-1 text-xs"
                  >
                    {activeGame?.id === g.id ? "Viewing" : "View"}
                  </button>
                </div>
              ))}
            </div>
          </div>
          {activeGame && (
            <div>
              <h3 className="text-white font-bold text-lg mb-2">
                Tic Tac Toe Board{" "}
                <span className="text-sm font-normal ml-2 text-gray-400">
                  {activeGame.completed ? "Game Over" : `Turn: ${members.find(m => m.id === activeGame.state.turn)?.name || "??"}`}
                </span>
              </h3>
              <TicTacToeBoard
                board={activeGame.state.board}
                myTurn={activeGame.state.turn === user.id && !activeGame.completed}
                onMove={makeTicTacToeMove}
              />
              {activeGame.completed && (
                <div className="text-astral-accent mt-3">
                  Winner: {activeGame.result?.winner
                    ? (members.find(m => m.id === activeGame.result.winner)?.name || "??")
                    : "Draw"}
                </div>
              )}
            </div>
          )}
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
      ) : (
        <div className="flex-1 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="text-6xl mb-4">🌠</div>
            <p className="text-gray-400">Select a channel to start chatting</p>
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
          channels={channels}
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
const EventModal = ({ onClose, onCreate, members, channels }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [color, setColor] = useState("#9F86FF");
  const [channelId, setChannelId] = useState("");


  const handleSubmit = () => {
    if (!title.trim() || !startTime || !endTime) return;
    onCreate({
      title,
      description,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      color,
      assigned_to: [],
      channel_link: channelId || null
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
        <label className="block text-gray-300 text-sm mb-1">Link to Channel (optional)</label>
        <select
          className="cosmic-input w-full px-4 py-2 rounded mb-4"
          value={channelId}
          onChange={e => setChannelId(e.target.value)}
        >
          <option value="">None</option>
          {channels.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>

            
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

const EventEditModal = ({ event, onClose, onSave, onDelete, members, channels }) => {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description || "");
  const [startTime, setStartTime] = useState(new Date(event.start_time).toISOString().slice(0,16));
  const [endTime, setEndTime] = useState(new Date(event.end_time).toISOString().slice(0,16));
  const [color, setColor] = useState(event.color || "#9F86FF");
  const [channelId, setChannelId] = useState(event.channel_link || "");

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      title,
      description,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
      color,
      channel_link: channelId || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="cosmic-panel p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4 text-white">Edit Event</h2>
        <input className="cosmic-input w-full px-4 py-2 rounded mb-3" value={title} onChange={e => setTitle(e.target.value)} placeholder="Event title" />
        <textarea className="cosmic-input w-full px-4 py-2 rounded mb-3" rows={3} value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
        <label className="block text-gray-300 text-sm mb-1">Start Time</label>
        <input type="datetime-local" className="cosmic-input w-full px-4 py-2 rounded mb-3" value={startTime} onChange={e => setStartTime(e.target.value)} />
        <label className="block text-gray-300 text-sm mb-1">End Time</label>
        <input type="datetime-local" className="cosmic-input w-full px-4 py-2 rounded mb-3" value={endTime} onChange={e => setEndTime(e.target.value)} />
        <label className="block text-gray-300 text-sm mb-1">Color</label>
        <input type="color" className="w-full h-10 rounded cursor-pointer mb-3" value={color} onChange={e => setColor(e.target.value)} />
        <label className="block text-gray-300 text-sm mb-1">Link to Channel (optional)</label>
        <select className="cosmic-input w-full px-4 py-2 rounded mb-4" value={channelId} onChange={e => setChannelId(e.target.value)}>
          <option value="">None</option>
          {channels.map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
          ))}
        </select>
        <div className="flex space-x-2">
          <button className="cosmic-btn flex-1 py-2" onClick={handleSave}>Save</button>
          <button className="cosmic-btn-secondary flex-1 py-2" onClick={onClose}>Cancel</button>
        </div>
        <button className="mt-3 w-full py-2 bg-red-700 rounded" onClick={onDelete}>Delete Event</button>
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

function TicTacToeBoard({ board, onMove, myTurn }) {
  return (
    <div className="grid grid-cols-3 gap-2 w-44">
      {board.map((cell, i) => (
        <button
          key={i}
          disabled={cell || !myTurn}
          className={`w-14 h-14 rounded cosmic-panel text-3xl font-bold
            ${cell ? "text-astral-accent bg-astral-hover" : "text-white bg-astral-dark"}
            ${!cell && myTurn ? "hover:bg-astral-accent hover:text-white cursor-pointer" : "cursor-not-allowed"}`}
          onClick={() => onMove(i)}
        >
          {cell || ""}
        </button>
      ))}
    </div>
  );
}


export default App;
