import React, { useState, useEffect } from 'react';
import api from '../../services/api.js';
import { FaUserCog, FaPlus, FaTrash, FaEdit, FaExclamationTriangle, FaSearch } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingSpinner from '../../components/LoadingSpinner/LoadingSpinner.jsx';
import './AdminUsers.css';
import { successToast, errorToast } from '../../toast-config.js';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    role: 'viewer'
  });
  const [editUserId, setEditUserId] = useState(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const { user: currentUser } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredUsers, setFilteredUsers] = useState([]);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Filter users based on search query
    if (users.length > 0) {
      const filtered = users.filter(user => 
        user.username.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchQuery, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await api.get('/auth/users');
      setUsers(response.data.users);
      setFilteredUsers(response.data.users);
      setError(null);
    } catch (err) {
      console.error('Failed to load admin users', err);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', formData);
      successToast('User created successfully');
      setShowAddForm(false);
      setFormData({ username: '', password: '', email: '', role: 'viewer' });
      loadUsers();
    } catch (err) {
      console.error('Failed to create user', err);
      errorToast(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleOpenEditForm = (user) => {
    setFormData({
      username: user.username,
      email: user.email || '',
      role: user.role,
      password: ''
    });
    setEditUserId(user.username);
    setShowEditForm(true);
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    try {
      const dataToSubmit = { ...formData };
      if (!dataToSubmit.password) delete dataToSubmit.password;

      await api.put(`/auth/users/${editUserId}`, dataToSubmit);
      successToast('User updated successfully');
      setShowEditForm(false);
      setFormData({ username: '', password: '', email: '', role: 'viewer' });
      setEditUserId(null);
      loadUsers();
    } catch (err) {
      console.error('Failed to update user', err);
      errorToast(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = (username) => {
    if (username === currentUser.username) {
      errorToast('You cannot delete your own account');
      return;
    }

    setUserToDelete(username);
    setShowDeleteConfirmation(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      await api.delete(`/auth/users/${userToDelete}`);
      successToast('User deleted successfully');
      loadUsers();
      setShowDeleteConfirmation(false);
      setUserToDelete(null);
    } catch (err) {
      console.error('Failed to delete user', err);
      errorToast(err.response?.data?.error || 'Failed to delete user');
      setShowDeleteConfirmation(false);
    }
  };

  const cancelDeleteUser = () => {
    setShowDeleteConfirmation(false);
    setUserToDelete(null);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  if (loading) return <LoadingSpinner message="Loading admin users..." />;

  return (
    <div className="admin-users-container">
      <div className="admin-header">
        <h1><FaUserCog /> Admin User Management</h1>
        <button 
          className="add-user-button"
          onClick={() => setShowAddForm(true)}
        >
          <FaPlus /> Add New User
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="search-container">
        <input
          type="text"
          placeholder="Search by username"
          value={searchQuery}
          onChange={handleSearchChange}
          className="search-bar"
        />
        <button 
          className="search-button"
          disabled={!searchQuery}
        >
          <FaSearch /> Search
        </button>
      </div>

      <table className="admin-users-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Created At</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <tr key={user.username}>
                <td data-label="Username">{user.username}</td>
                <td data-label="Email">{user.email || 'N/A'}</td>
                <td data-label="Role">
                  <span className={`role-badge role-${user.role}`}>
                    {user.role}
                  </span>
                </td>
                <td data-label="Created At">{new Date(user.created_at).toLocaleString()}</td>
                <td className="actions-cell">
                  <button 
                    className="edit-button"
                    onClick={() => handleOpenEditForm(user)}
                  >
                    <FaEdit />
                  </button>
                  <button 
                    className="delete-button"
                    onClick={() => handleDeleteUser(user.username)}
                    disabled={user.username === currentUser.username}
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="5" className="no-results">
                {searchQuery ? `No users found matching "${searchQuery}"` : 'No users found'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {showAddForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add New User</h2>
            <form onSubmit={handleAddUser} className="user-form">
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Password:</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Role:</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="form-buttons">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Add User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditForm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Edit User</h2>
            <form onSubmit={handleEditUser} className="user-form">
              <div className="form-group">
                <label>Username:</label>
                <input
                  type="text"
                  value={formData.username}
                  disabled
                />
              </div>
              <div className="form-group">
                <label>Password (leave blank to keep current):</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                />
              </div>
              <div className="form-group">
                <label>Role:</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="form-buttons">
                <button 
                  type="button" 
                  className="cancel-button"
                  onClick={() => setShowEditForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Update User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteConfirmation && (
        <div className="delete-confirmation-overlay">
          <div className="delete-confirmation-modal">
            <div className="delete-icon-container">
              <FaExclamationTriangle className="delete-warning-icon" />
            </div>
            <h3>Delete User Account</h3>
            <p>Are you sure you want to delete the user <span className="highlight-username">{userToDelete}</span>?</p>
            <p className="warning-text">This action cannot be undone and will permanently remove the user account.</p>
            
            <div className="delete-confirmation-buttons">
              <button 
                className="cancel-delete-button"
                onClick={cancelDeleteUser}
              >
                Cancel
              </button>
              <button 
                className="confirm-delete-button"
                onClick={confirmDeleteUser}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
