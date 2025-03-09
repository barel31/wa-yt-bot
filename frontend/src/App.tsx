// src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

interface DownloadResult {
  title: string;
  link: string;
}

interface JobStatus {
  status: string;
  progress: number;
  statusText: string;
  result: DownloadResult | null;
  error: string | null;
}

const API_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const App: React.FC = () => {
  const [url, setUrl] = useState<string>('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string>('');
  const [pollInterval, setPollInterval] = useState<number | null>(null);

  // Clear polling interval on component unmount
  useEffect(() => {
    return () => {
      if (pollInterval !== null) clearInterval(pollInterval);
    };
  }, [pollInterval]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setProgress(0);
    setStatusText('ממתין להתחלת העיבוד...');
    try {
      const response = await axios.post<{ jobId: string }>(`${API_URL}/api/download`, { url, format });
      const newJobId = response.data.jobId;
      if (!newJobId) {
        setError('לא קיבלנו מזהה משימה');
        return;
      }
      setJobId(newJobId);
      // Start polling for status every 5 seconds.
      const interval = window.setInterval(() => pollStatus(newJobId), 5000);
      setPollInterval(interval);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error starting download');
      } else {
        setError('Error starting download');
      }
    }
  };

  const pollStatus = async (currentJobId: string) => {
    if (!currentJobId) return; // Defensive check
    try {
      const { data } = await axios.get<JobStatus>(`${API_URL}/api/status/${currentJobId}`);
      setProgress(data.progress);
      setStatusText(data.statusText);
      if (data.status === 'finished') {
        if (pollInterval !== null) clearInterval(pollInterval);
        setResult(data.result);
      } else if (data.status === 'error' || data.status === 'cancelled') {
        if (pollInterval !== null) clearInterval(pollInterval);
        setError(data.error || 'Download cancelled');
      }
    } catch (err: unknown) {
      setError(`Error polling job status ${err}`);
      if (pollInterval !== null) clearInterval(pollInterval);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await axios.post(`${API_URL}/api/cancel/${jobId}`);
      if (pollInterval !== null) clearInterval(pollInterval);
      setStatusText('הורדה בוטלה על ידי המשתמש.');
    } catch (err: unknown) {
      setError(`Error cancelling download ${err}`);
    }
  };

  return (
    <div className="App">
      <h1>⬇️ הורד סרטונים מיוטיוב 🎥</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="הזן קישור YouTube"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <select value={format} onChange={(e) => setFormat(e.target.value as 'mp3' | 'mp4')}>
          <option value="mp3">MP3 (אודיו)</option>
          <option value="mp4">MP4 (וידאו)</option>
        </select>
        <button type="submit">התחל הורדה</button>
      </form>
      {jobId && (
        <div className="status">
          {/* <p>{statusText}</p> */}
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }}>
              {!!progress && <p className='progress-percentage'>{progress}%</p>}
            </div>
          </div>
          {statusText && statusText !== 'ההורדה הושלמה. מכין את הקובץ...' && (
            <button onClick={handleCancel}>בטל הורדה</button>
          )}
        </div>
      )}
      {result && (
        <div className="result">
          <h2>הורדה הושלמה!</h2>
          <p>{result.title}</p>
          {format === 'mp4' ? (
            <div className="video-container">
              <video controls>
                <source src={result.link} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <audio controls>
              <source src={result.link} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          )}
          <a href={result.link} download>
            לחץ כאן להורדה ישירה
          </a>
        </div>
      )}
      {error && <p className="error">שגיאה: {error}</p>}
    </div>
  );
};

export default App;
