import React, { useState, useRef } from 'react';
import './ShareWithUserModal.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tlink-production-backend.onrender.com/api';

interface User {
  id: string;
  email: string;
  name?: string;
  company_name?: string;
  role?: string;
}

interface ShareWithUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
}

const ShareWithUserModal: React.FC<ShareWithUserModalProps> = ({ isOpen, onClose, users }) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sendProgress, setSendProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isSendToAll = selectedUserId === 'all';
  const selectedUser = selectedUserId && selectedUserId !== 'all' ? users.find(u => u.id === selectedUserId) : null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      // Limit file size to 10MB
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedUserId) {
      setError('Please select a user');
      return;
    }
    
    if (!subject.trim()) {
      setError('Please enter a subject');
      return;
    }
    
    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    setIsSending(true);
    setError('');
    setSendProgress('');

    try {
      if (isSendToAll) {
        // Send to all users
        const recipients = users.map(u => ({ email: u.email, name: u.name || u.email }));
        setSendProgress(`Sending to ${recipients.length} users...`);

        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('recipients', JSON.stringify(recipients));
        formData.append('subject', subject);
        formData.append('message', message);
        formData.append('sendToAll', 'true');

        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/admin/share-file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to send emails');
        }

        const result = await response.json();
        setSendProgress(`Sent to ${result.successCount || recipients.length} of ${recipients.length} users`);
      } else {
        // Send to single user
        if (!selectedUser) {
          setError('Please select a user');
          return;
        }

        const formData = new FormData();
        if (file) formData.append('file', file);
        formData.append('recipientEmail', selectedUser.email);
        formData.append('recipientName', selectedUser.name || selectedUser.email);
        formData.append('subject', subject);
        formData.append('message', message);

        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${API_BASE_URL}/admin/share-file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to send email');
        }
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClose = () => {
    setSelectedUserId(null);
    setFile(null);
    setSubject('');
    setMessage('');
    setSuccess(false);
    setError('');
    setSendProgress('');
    onClose();
  };

  const removeFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="share-modal-overlay" onClick={handleClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>
            <span className="header-icon">📤</span>
            Share File with User
          </h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        {success ? (
          <div className="success-state">
            <div className="success-icon-large">✓</div>
            <h3>{file ? 'File Shared' : 'Email Sent'} Successfully!</h3>
            <p>{isSendToAll ? sendProgress : `Email sent to ${selectedUser?.email}`}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="share-form">
            {error && (
              <div className="error-banner">
                <span>⚠️</span> {error}
              </div>
            )}

            {/* User Selection */}
            <div className="form-group">
              <label htmlFor="userSelect">
                Select User <span className="required">*</span>
              </label>
              <select
                id="userSelect"
                value={selectedUserId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedUserId(val || null);
                }}
                required
              >
                <option value="">-- Choose a user --</option>
                <option value="all" style={{ fontWeight: 'bold', backgroundColor: '#f0fdf4' }}>📨 Send to ALL Users ({users.length})</option>
                <optgroup label="Individual Users">
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                      {user.company_name ? ` (${user.company_name})` : ''}
                      {user.role ? ` - ${user.role}` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
              {isSendToAll && (
                <div className="selected-user-info send-all-info">
                  <span>📨 Email will be sent to <strong>{users.length} users</strong></span>
                </div>
              )}
              {selectedUser && (
                <div className="selected-user-info">
                  <span className="user-email">📧 {selectedUser.email}</span>
                </div>
              )}
            </div>

            {/* File Upload */}
            <div className="form-group">
              <label>
                Attach File <span className="optional-label">(optional)</span>
              </label>
              <div className="file-upload-area">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="file-input-hidden"
                  accept=".pdf,.doc,.docx,.md,.txt,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                />
                {!file ? (
                  <div 
                    className="file-dropzone"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <span className="upload-icon">📁</span>
                    <span className="upload-text">Click to select a file</span>
                    <span className="upload-hint">PDF, DOC, Excel, Images (max 10MB)</span>
                  </div>
                ) : (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <div className="file-details">
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                    <button type="button" className="remove-file-btn" onClick={removeFile}>×</button>
                  </div>
                )}
              </div>
            </div>

            {/* Subject */}
            <div className="form-group">
              <label htmlFor="subject">
                Subject <span className="required">*</span>
              </label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g., Quick Review Questionnaire"
                required
              />
            </div>

            {/* Message */}
            <div className="form-group">
              <label htmlFor="message">
                Message <span className="required">*</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Explain what this file is for and any instructions for the recipient..."
                rows={4}
                required
              />
            </div>

            {/* Actions */}
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={handleClose}>
                Cancel
              </button>
              <button type="submit" className="btn-send" disabled={isSending}>
                {isSending ? (
                  <>
                    <span className="spinner"></span>
                    {sendProgress || 'Sending...'}
                  </>
                ) : (
                  <>
                    <span>✉️</span>
                    {isSendToAll ? `Send to All (${users.length})` : 'Send Email'}
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ShareWithUserModal;
