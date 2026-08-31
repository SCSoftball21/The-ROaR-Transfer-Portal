import React, { useState, useEffect } from 'react';
import '../styles/dashboard-global.css';
import styles from '../styles/dashboard.module.css';

export default function Dashboard() {
  const [authState, setAuthState] = useState('login'); // 'login' | 'authenticated'
  const [currentUser, setCurrentUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [currentCandidateIndex, setCurrentCandidateIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    const username = e.target.username.value;
    const password = e.target.password.value;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setCurrentUser(data.username);
      setUserRole(data.role);
      setAuthState('authenticated');
      
      // Store in localStorage for session
      localStorage.setItem('dashboard_user', data.username);
      localStorage.setItem('dashboard_role', data.role);
      localStorage.setItem('dashboard_token', data.token);

      // Fetch candidates
      await fetchCandidates(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch candidates from Airtable
  const fetchCandidates = async (token) => {
    try {
      const response = await fetch('/api/candidates', {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch candidates');

      const data = await response.json();
      setCandidates(data.records || []);
    } catch (err) {
      setError(err.message);
    }
  };

  // Restore session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('dashboard_user');
    const savedRole = localStorage.getItem('dashboard_role');
    const savedToken = localStorage.getItem('dashboard_token');

    if (savedUser && savedRole && savedToken) {
      setCurrentUser(savedUser);
      setUserRole(savedRole);
      setAuthState('authenticated');
      fetchCandidates(savedToken);
    }
  }, []);

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('dashboard_user');
    localStorage.removeItem('dashboard_role');
    localStorage.removeItem('dashboard_token');
    setAuthState('login');
    setCurrentUser(null);
    setUserRole(null);
    setCandidates([]);
  };

  if (authState === 'login') {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1>ROaR Leadership Review</h1>
          <p>Transfer Portal Review Dashboard</p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleLogin}>
            <div className={styles.formGroup}>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="e.g., Darrow, Ali, Emmy..."
                required
                disabled={loading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter password"
                required
                disabled={loading}
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1>ROaR Leadership Review</h1>
          <div className={styles.userInfo}>
            <span>{currentUser} ({userRole})</span>
            <button onClick={handleLogout} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
        <div className={styles.loadingMessage}>
          {loading ? 'Loading candidates...' : 'No candidates found'}
        </div>
      </div>
    );
  }

  const currentCandidate = candidates[currentCandidateIndex];

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>ROaR Leadership Review</h1>
        <div className={styles.userInfo}>
          <span>{currentUser} ({userRole})</span>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Total Candidates</span>
          <span className={styles.statValue}>{candidates.length}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Current</span>
          <span className={styles.statValue}>{currentCandidateIndex + 1}</span>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.mainContent}>
        <CandidateCard
          candidate={currentCandidate}
          userRole={userRole}
          onUpdate={() => fetchCandidates(localStorage.getItem('dashboard_token'))}
        />
      </div>

      {/* Navigation */}
      <div className={styles.navigation}>
        <button
          onClick={() => setCurrentCandidateIndex(Math.max(0, currentCandidateIndex - 1))}
          disabled={currentCandidateIndex === 0}
          className={styles.navBtn}
        >
          ← Previous
        </button>

        <span className={styles.navCounter}>
          {currentCandidateIndex + 1} / {candidates.length}
        </span>

        <button
          onClick={() => setCurrentCandidateIndex(Math.min(candidates.length - 1, currentCandidateIndex + 1))}
          disabled={currentCandidateIndex === candidates.length - 1}
          className={styles.navBtn}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// Candidate Card Component
function CandidateCard({ candidate, userRole, onUpdate }) {
  return (
    <div className={styles.candidateCard}>
      {/* Basic Info */}
      <div className={styles.basicInfo}>
        <h2>{candidate.fields.Name}</h2>
        <p>{candidate.fields['S3 Seat Color']} Seat</p>
      </div>

      {/* Main Stats */}
      <div className={styles.statsSection}>
        <div className={styles.stat}>
          <span>Server & Alliance</span>
          <strong>{candidate.fields['Server and Alliance']}</strong>
        </div>
        <div className={styles.stat}>
          <span>Total Hero Power</span>
          <strong>{candidate.fields['Total Hero Power'] || '—'}</strong>
        </div>
      </div>

      {/* Squad Power */}
      <div className={styles.squadPower}>
        <h3>Squad Power</h3>
        <div className={styles.squadGrid}>
          <div>
            <span>S1</span>
            <strong>{candidate.fields['S1 Power_Initial Submission']}</strong>
          </div>
          <div>
            <span>S2</span>
            <strong>{candidate.fields['S2 Power_Initial Submission']}</strong>
          </div>
          <div>
            <span>S3</span>
            <strong>{candidate.fields['S3 Power_Initial Submission']}</strong>
          </div>
        </div>
        <small>Updated: {candidate.fields['Date Squad Power Updated']}</small>
      </div>

      {/* Other Info */}
      <div className={styles.otherInfo}>
        {candidate.fields.Saving && (
          <div>
            <span>Saving:</span>
            <strong>{candidate.fields.Saving}</strong>
          </div>
        )}

        {candidate.fields['Friend Group'] && candidate.fields['Friend Group'] !== 'N/A' && (
          <div>
            <span>Friend Group:</span>
            <strong>{candidate.fields['Friend Group']}</strong>
          </div>
        )}

        {candidate.fields.Languages && (
          <div>
            <span>Language:</span>
            <strong>{candidate.fields.Languages}</strong>
          </div>
        )}
      </div>

      {/* R4 Notes */}
      <div className={styles.notesSection}>
        <h3>R4 Notes</h3>
        {userRole === 'read-write' ? (
          <textarea
            defaultValue={candidate.fields['R4 Notes'] || ''}
            placeholder="Add notes here..."
            className={styles.notesInput}
          />
        ) : (
          <p className={styles.notesView}>{candidate.fields['R4 Notes'] || '(No notes yet)'}</p>
        )}
      </div>
    </div>
  );
}
