import { useState, useEffect, useRef, useCallback } from "react";
import messagesApi from "../api/messages";
import { Link } from "react-router-dom";
import { MessageCircle, Search, Paperclip, Send, ThumbsUp, Users, ChevronLeft, Image as ImageIcon, FileText, Info, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { getToken } from "../auth/session";
import { getApiBaseUrl, resolveServerUrl } from "../api/urls";

export default function Messenger() {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [activeTab, setActiveTab] = useState("chats");
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inspectedImage, setInspectedImage] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const stompClientRef = useRef(null);
  const subscriptionRef = useRef(null);
  const selectedConvRef = useRef(null);

  // Keep ref in sync with state so the WS callback always has the latest value
  useEffect(() => {
    selectedConvRef.current = selectedConversation;
  }, [selectedConversation]);

  // ---------- WebSocket Connection ----------
  useEffect(() => {
    loadConversations();
    loadContacts();

    const token = getToken();
    const API_BASE = getApiBaseUrl();
    // If API_BASE has a path like /api, remove it to get the server root for /ws
    const WS_URL = API_BASE.replace(/\/api$/, "") + "/ws";

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      connectHeaders: { Authorization: `Bearer ${token}` },
      reconnectDelay: 5000,
      onConnect: () => {
        setWsConnected(true);
      },
      onDisconnect: () => setWsConnected(false),
      onStompError: (frame) => console.error("STOMP error", frame),
    });

    client.activate();
    stompClientRef.current = client;

    return () => {
      if (subscriptionRef.current) subscriptionRef.current.unsubscribe();
      client.deactivate();
    };
  }, []);

  // ---------- Subscribe to conversation topic when selection changes ----------
  useEffect(() => {
    // Unsubscribe from old conversation
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    if (!selectedConversation || selectedConversation.temp) return;

    const subscribeWhenReady = () => {
      if (stompClientRef.current?.connected) {
        subscriptionRef.current = stompClientRef.current.subscribe(
          `/topic/conversation.${selectedConversation.id}`,
          (frame) => {
            const msg = JSON.parse(frame.body);
            setMessages((prev) => {
              // Avoid duplicates (the sender already appended optimistically)
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            // Refresh conversation list sidebar (unread counts, last message)
            loadConversations();
          }
        );
      } else {
        // Client not yet connected — retry after short delay
        setTimeout(subscribeWhenReady, 500);
      }
    };

    subscribeWhenReady();
  }, [selectedConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      const res = await messagesApi.getConversations();
      setConversations(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  const loadContacts = async () => {
    try {
      const res = await messagesApi.getContacts();
      setContacts(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load contacts", err);
    }
  };

  const loadMessages = async (id) => {
    try {
      const res = await messagesApi.getMessages(id);
      setMessages(res.data?.data || []);
    } catch (err) {
      console.error("Failed to load messages", err);
    }
  };

  const selectConversation = (conv) => {
    setSelectedConversation(conv);
    loadMessages(conv.id);
  };

  const selectContact = async (contact) => {
    const existing = conversations.find(c => c.otherUserId === contact.id);
    if (existing) {
        selectConversation(existing);
    } else {
        setSelectedConversation({
            temp: true,
            otherUserId: contact.id,
            otherUserName: contact.name,
            otherUserRole: contact.role
        });
        setMessages([]);
    }
    setActiveTab("chats");
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      const recipientId = selectedConversation.otherUserId;
      const res = await messagesApi.sendMessage(recipientId, newMessage);
      
      const sentMsg = res.data?.data;
      if (selectedConversation.temp) {
          await loadConversations();
          // We'll find the new conv ID after reload
      }
      
      setMessages([...messages, sentMsg]);
      setNewMessage("");
      loadConversations();
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
        const uploadRes = await messagesApi.uploadFile(file);
        const { fileUrl, fileName, fileType } = uploadRes.data.data;
        
        const recipientId = selectedConversation.otherUserId;
        const msgRes = await messagesApi.sendMessage(recipientId, "", fileUrl, fileName, fileType);
        
        setMessages([...messages, msgRes.data.data]);
        loadConversations();
    } catch (err) {
        console.error("Upload failed", err);
    } finally {
        setUploading(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const filteredConversations = conversations.filter(c => 
    (c.otherUserName || '').toLowerCase().includes((searchQuery || '').toLowerCase())
  );

  const getAvatarUrl = (url) => {
    if (!url || url === "null") return null;
    if (url.startsWith('http') || url.startsWith('data:image')) return url;
    return resolveServerUrl(url);
  };

  return (
    <div className="fb-messenger">
      {/* Sidebar */}
      <aside className="fb-sidebar">
        <header className="sidebar-header">
          <div className="header-top">
            <h1>{t("chats")}</h1>
            <div className="header-actions">
              <Link to="/" className="circle-btn" title={t('backToDashboard')}>
                <ChevronLeft size={20} />
              </Link>
            </div>
          </div>
          
          <div className="messenger-tabs">
            <button 
              className={`msg-tab ${activeTab === "chats" ? "active" : ""}`} 
              onClick={() => setActiveTab("chats")}
            >
              <MessageCircle size={16} /> {t("chats")}
            </button>
            <button 
              className={`msg-tab ${activeTab === "contacts" ? "active" : ""}`} 
              onClick={() => setActiveTab("contacts")}
            >
              <Users size={16} /> {t("contacts")}
            </button>
          </div>

          <div className="search-container" style={{ marginTop: '12px' }}>
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              placeholder={t("typeMessage")} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <div className="inbox-list">
          {activeTab === "chats" ? (
            filteredConversations.length > 0 ? (
                filteredConversations.map(c => (
                <div 
                  key={c.id} 
                  className={`inbox-item ${selectedConversation?.id === c.id ? 'selected' : ''} ${c.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => selectConversation(c)}
                >
                  <div className="avatar-wrapper">
                    {c.otherUserProfileImageUrl ? (
                        <img src={getAvatarUrl(c.otherUserProfileImageUrl)} alt="" className="avatar large" style={{ objectFit: 'cover' }} />
                    ) : (
                        <div className="avatar large">{c.otherUserName.charAt(0)}</div>
                    )}
                  </div>
                  <div className="inbox-info">
                    <div className="name-time">
                      <span className="name">{c.otherUserName}</span>
                      <span className="time">{new Date(c.lastMessageTime).toLocaleDateString() === new Date().toLocaleDateString() 
                        ? new Date(c.lastMessageTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
                        : new Date(c.lastMessageTime).toLocaleDateString([], {month:'short', day:'numeric'})}
                      </span>
                    </div>
                    <div className="snippet">
                      <span className="text">{c.lastMessage || t('noMessagesYet')}</span>
                      {c.unreadCount > 0 && <span className="unread-dot"></span>}
                    </div>
                  </div>
                </div>
              ))
            ) : (
                <div className="empty-state">{t('noChatsFound')}</div>
            )
          ) : (
            contacts.map(contact => (
              <div key={contact.id} className="inbox-item contact" onClick={() => selectContact(contact)}>
                {contact.profileImageUrl ? (
                    <img src={getAvatarUrl(contact.profileImageUrl)} alt="" className="avatar large contact-avatar" style={{ objectFit: 'cover' }} />
                ) : (
                    <div className="avatar large contact-avatar">{contact.name.charAt(0)}</div>
                )}
                <div className="inbox-info">
                  <span className="name">{contact.name}</span>
                  <span className="role-snippet"><User size={12} /> {contact.role} • {contact.details}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="fb-main">
        {selectedConversation ? (
          <>
            <header className="chat-header">
              <div className="user-info">
                {selectedConversation?.otherUserProfileImageUrl ? (
                    <img src={getAvatarUrl(selectedConversation.otherUserProfileImageUrl)} alt="" className="avatar medium" style={{ objectFit: 'cover' }} />
                ) : (
                    <div className="avatar medium">{selectedConversation.otherUserName.charAt(0)}</div>
                )}
                <div className="chat-details">
                  <span className="name">{selectedConversation.otherUserName}</span>
                  <span className="status">{t('activeNow')}</span>
                </div>
              </div>
            </header>

            <div className="messages-flow">

              {messages.map((m, index) => {
                const isOwn = m.senderId !== selectedConversation.otherUserId;
                const prevMsg = messages[index - 1];
                const isGroupStart = !prevMsg || prevMsg.senderId !== m.senderId;
                
                return (
                  <div key={m.id} className={`msg-row ${isOwn ? 'own' : 'other'} ${isGroupStart ? 'group-start' : ''}`}>
                    {!isOwn && isGroupStart && (
                        selectedConversation?.otherUserProfileImageUrl ? (
                            <img src={getAvatarUrl(selectedConversation.otherUserProfileImageUrl)} alt="" className="avatar small" style={{ objectFit: 'cover' }} />
                        ) : (
                            <div className="avatar small">{selectedConversation.otherUserName.charAt(0)}</div>
                        )
                    )}
                    {!isOwn && !isGroupStart && <div className="avatar-spacer" />}
                    
                    <div className="bubble">
                        {m.content && <div className="text-content">{m.content}</div>}
                        {m.fileUrl && (
                          m.fileType && m.fileType.startsWith('image/') ? (
                            <div className="image-container">
                              <img 
                                src={resolveServerUrl(m.fileUrl)}
                                alt={m.fileName} 
                                className="chat-image selectable" 
                                onClick={() => setInspectedImage({url: m.fileUrl, name: m.fileName})}
                              />
                            </div>
                          ) : (
                            <div className="file-box">
                              <div className="file-icon"><FileText size={24} /></div>
                              <div className="file-details">
                                <span className="filename">{m.fileName}</span>
                                <a href={resolveServerUrl(m.fileUrl)} target="_blank" rel="noreferrer">{t('download')}</a>
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <footer className="chat-footer glass-effect">
              <div className="footer-actions">
                <button 
                  type="button"
                  className="attach-file-btn" 
                  onClick={() => fileInputRef.current.click()}
                  title={t('attachFile')}
                >
                  <Paperclip size={18} />
                  <span className="attach-text">{t('attach')}</span>
                </button>
                <input type="file" hidden ref={fileInputRef} onChange={handleFileUpload} />
              </div>
              <form className="input-pills hover-ring" onSubmit={handleSend}>
                <input 
                  type="text" 
                  placeholder={t("typeMessage")} 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit" className={`send-icon ${newMessage.trim() ? 'active' : ''}`} disabled={!newMessage.trim()}>
                  <Send size={20} />
                </button>
              </form>
            </footer>
          </>
        ) : (
          <div className="fb-placeholder">
            <div className="placeholder-icon-wrapper">
               <MessageCircle size={64} className="placeholder-icon" />
            </div>
            <h2>{t("professionalMessenger")}</h2>
            <p className="muted">{t("messengerDesc")}</p>
          </div>
        )}
      </main>

      {/* Image Inspection Overlay */}
      {inspectedImage && (
        <div className="image-overlay" onClick={() => setInspectedImage(null)}>
          <div className="overlay-header">
            <span className="overlay-filename">{inspectedImage.name}</span>
            <div className="overlay-actions">
              <a 
                href={resolveServerUrl(inspectedImage.url)}
                target="_blank" 
                rel="noreferrer" 
                className="overlay-download-btn"
                onClick={(e) => e.stopPropagation()}
              >
                {t('download')}
              </a>
              <button 
                className="overlay-close-btn" 
                onClick={() => setInspectedImage(null)}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="overlay-content-wrapper">
            <img 
              src={resolveServerUrl(inspectedImage.url)}
              alt={inspectedImage.name} 
              className="overlay-image" 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      <style>{`
        :root {
          --brand-primary: #1e3a8a;
          --brand-accent: #2563eb;
          --brand-cta: #2b4b9b;
          --bg-main: #f8fafc;
          --text-main: #111827;
          --text-muted: #4b5563;
          --text-light: #94a3b8;
          --border-color: #e2e8f0;
          --glass-surface: rgba(255, 255, 255, 0.7);
          --radius-sm: 8px;
          --radius-md: 16px;
          --radius-lg: 24px;
        }

        .fb-messenger {
          display: flex;
          height: 100vh;
          background: #f8fafc;
          color: var(--text-main);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
        }

        /* Sidebar */
        .fb-sidebar {
          width: 400px;
          border-right: 1px solid var(--border-color);
          display: flex;
          flex-direction: column;
          background: white;
          z-index: 10;
        }

        .sidebar-header {
          padding: 32px 24px 20px;
        }

        .header-top h1 {
          font-size: 28px;
          font-weight: 800;
          color: var(--brand-primary);
          letter-spacing: -0.5px;
          margin: 0 0 20px 0;
        }

        .messenger-tabs {
          display: flex;
          background: #f1f5f9;
          padding: 4px;
          border-radius: var(--radius-sm);
          margin-bottom: 20px;
        }
        
        .msg-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          border: none;
          background: transparent;
          border-radius: 6px;
          font-weight: 600;
          font-size: 14px;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .msg-tab.active {
          background: white;
          color: var(--brand-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }

        .search-container {
          background: #f1f5f9;
          border-radius: var(--radius-sm);
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
          border: 1px solid var(--border-color);
        }

        .search-container input {
          background: transparent;
          border: none;
          outline: none;
          flex: 1;
          font-size: 15px;
        }

        .inbox-list {
          flex: 1;
          overflow-y: auto;
          padding: 0 12px 24px;
        }

        .inbox-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 4px;
        }

        .inbox-item:hover { 
          background: #f1f5f9; 
        }
        
        .inbox-item.selected { 
          background: rgba(30, 58, 138, 0.05); 
        }

        .avatar {
          border-radius: 12px;
          background: linear-gradient(135deg, var(--brand-primary), var(--brand-accent));
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          flex-shrink: 0;
        }

        .avatar.large { width: 52px; height: 52px; font-size: 20px; }
        .avatar.medium { width: 44px; height: 44px; font-size: 16px; border-radius: 10px; }
        .avatar.small { width: 32px; height: 32px; font-size: 12px; border-radius: 8px; }
        
        .status-dot {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 14px;
          height: 14px;
          background: #10b981;
          border: 3px solid white;
          border-radius: 50%;
        }

        .name-time { display: flex; justify-content: space-between; align-items: baseline; }
        .name { font-weight: 700; font-size: 15px; color: var(--text-main); }
        .time { font-size: 12px; color: var(--text-light); font-weight: 600; }

        .snippet .text {
          font-size: 13px;
          color: var(--text-muted);
          margin-top: 4px;
        }

        /* Main Chat */
        .fb-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: #f8fafc;
        }

        .chat-header {
          padding: 20px 32px;
          background: var(--glass-surface);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          z-index: 20;
        }

        .chat-details .name { font-weight: 800; font-size: 18px; }
        .chat-details .status { font-size: 13px; color: #10b981; font-weight: 600; }

        .messages-flow {
          flex: 1;
          overflow-y: auto;
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .msg-row {
          display: flex;
          max-width: 80%;
          margin-bottom: 2px;
        }

        .msg-row.own { align-self: flex-end; flex-direction: row-reverse; }
        .msg-row.other { align-self: flex-start; }

        .bubble {
          padding: 12px 18px;
          font-size: 15px;
          line-height: 1.5;
        }

        .msg-row.other .bubble {
          background: white;
          border: 1px solid var(--border-color);
          color: var(--text-main);
          border-radius: 18px;
          border-top-left-radius: 4px;
        }
        .msg-row.other.group-start .bubble { border-top-left-radius: 18px; }

        .msg-row.own .bubble {
          background: var(--brand-accent);
          color: white;
          border-radius: 18px;
          border-top-right-radius: 4px;
        }
        .msg-row.own.group-start .bubble { border-top-right-radius: 18px; }

        .chat-footer {
          padding: 24px 32px;
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--glass-surface);
          backdrop-filter: blur(12px);
          border-top: 1px solid var(--border-color);
        }

        .attach-file-btn {
          background: white;
          border: 1px solid var(--border-color);
          padding: 10px 18px;
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-weight: 600;
          cursor: pointer;
        }

        .input-pills {
          flex: 1;
          background: white;
          border-radius: var(--radius-sm);
          padding: 10px 18px;
          display: flex;
          align-items: center;
          border: 1px solid var(--border-color);
        }

        .input-pills input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 15px;
        }

        .send-icon {
          background: transparent;
          border: none;
          color: var(--brand-accent);
          cursor: pointer;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        .send-icon.active { opacity: 1; }

        .circle-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        .fb-placeholder {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .placeholder-icon-wrapper {
          width: 120px;
          height: 120px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
          margin-bottom: 2rem;
          color: #cbd5e1;
          animation: messagePop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.2);
        }

        .fb-placeholder h2 { font-weight: 800; font-size: 1.75rem; margin-bottom: 0.5rem; }
        .muted { color: #64748b; }

        .role-snippet { font-size: 12px; color: #94a3b8; font-weight: 500; }

        /* Image Inspection Overlay */
        .chat-image.selectable {
          cursor: pointer;
          transition: transform 0.3s;
          max-width: 100%;
          max-height: 250px;
          object-fit: cover;
          border-radius: 12px;
        }
        .chat-image.selectable:hover { transform: scale(0.98); }

        .image-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          animation: messagePop 0.2s ease-out;
        }

        .overlay-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 32px;
          color: white;
        }

        .overlay-filename { font-weight: 600; font-size: 1.1rem; }

        .overlay-actions { display: flex; align-items: center; gap: 20px; }

        .overlay-download-btn {
          color: white;
          text-decoration: none;
          background: rgba(255, 255, 255, 0.1);
          padding: 8px 24px;
          border-radius: 30px;
          font-weight: 700;
          font-size: 0.9rem;
          transition: all 0.2s;
          border: 1px solid rgba(255,255,255,0.2);
        }

        .overlay-download-btn:hover { background: white; color: black; }

        .overlay-close-btn {
          background: rgba(255,255,255,0.1);
          border: none;
          color: white;
          width: 40px; height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .overlay-close-btn:hover { background: #ef4444; }

        .overlay-content-wrapper {
          flex: 1; display: flex; align-items: center; justify-content: center; padding: 40px;
          overflow: hidden;
          min-height: 0;
        }

        .overlay-image {
          max-width: 100%; max-height: 100%; object-fit: contain;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
      `}</style>
    </div>
  );
}
