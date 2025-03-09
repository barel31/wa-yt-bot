// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
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

// Define a mapping of resolution labels to quality IDs.
const qualityOptions: { [key: string]: string } = {
  '1080p': '137',
  '720p': '136',
  '480p': '135',
  '360p': '134',
  '240p': '133',
  '144p': '160',
};

const App: React.FC = () => {
  const [url, setUrl] = useState<string>('');
  const [format, setFormat] = useState<'mp3' | 'mp4'>('mp3');
  const [videoQuality, setVideoQuality] = useState<string>('137'); // default quality ID for mp4
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [error, setError] = useState<string>('');
  const [pollInterval, setPollInterval] = useState<number | null>(null);
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const simulatedTimerRef = useRef<number | null>(null);

  // Clear polling and simulation intervals on unmount
  useEffect(() => {
    return () => {
      if (pollInterval !== null) clearInterval(pollInterval);
      if (simulatedTimerRef.current !== null) clearInterval(simulatedTimerRef.current);
    };
  }, [pollInterval]);

  // Set up simulated progress for MP4 downloads if job is active.
  useEffect(() => {
    if (jobId && format === 'mp4') {
      // Clear any existing timer.
      if (simulatedTimerRef.current !== null) clearInterval(simulatedTimerRef.current);
      simulatedTimerRef.current = window.setInterval(() => {
        // Increment progress gradually until 90%.
        setProgress((prev) => {
          if (prev < 90) {
            return prev + 1;
          }
          return prev;
        });
      }, 1000); // increment 1% per second
    } else {
      if (simulatedTimerRef.current !== null) {
        clearInterval(simulatedTimerRef.current);
        simulatedTimerRef.current = null;
      }
    }
  }, [jobId, format]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setResult(null);
    setProgress(0);
    setStatusText('ממתין להתחלת העיבוד...');
    setIsCancelled(false);
    try {
      const payload: { url: string; format: 'mp3' | 'mp4'; quality?: string } = { url, format };
      if (format === 'mp4') {
        payload.quality = videoQuality;
      }
      const response = await axios.post<{ jobId: string }>(`${API_URL}/api/download`, payload);
      const newJobId = response.data.jobId;
      if (!newJobId) {
        setError('לא קיבלנו מזהה משימה');
        return;
      }
      setJobId(newJobId);
      const intervalId = window.setInterval(() => pollStatus(newJobId), 5000);
      setPollInterval(intervalId);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Error starting download');
      } else {
        setError('Error starting download');
      }
    }
  };

  const pollStatus = async (currentJobId: string) => {
    if (!currentJobId || isCancelled) return;
    try {
      const { data } = await axios.get<JobStatus>(`${API_URL}/api/status/${currentJobId}`);
      // If backend provides progress, override simulated progress.
      if (data.progress && data.progress > progress) {
        setProgress(data.progress);
      }
      setStatusText(data.statusText);
      if (data.status === 'finished') {
        if (pollInterval !== null) clearInterval(pollInterval);
        if (simulatedTimerRef.current !== null) clearInterval(simulatedTimerRef.current);
        setResult(data.result);
        setJobId(null);
      } else if (data.status === 'error' || data.status === 'cancelled') {
        if (pollInterval !== null) clearInterval(pollInterval);
        if (simulatedTimerRef.current !== null) clearInterval(simulatedTimerRef.current);
        setError(data.error || 'Download cancelled');
        setJobId(null);
      }
    } catch (err: unknown) {
      setError(`Error polling job status: ${err}`);
      if (pollInterval !== null) clearInterval(pollInterval);
    }
  };

  const handleCancel = async () => {
    if (!jobId) return;
    setIsCancelled(true);
    try {
      await axios.post(`${API_URL}/api/cancel/${jobId}`);
      if (pollInterval !== null) clearInterval(pollInterval);
      if (simulatedTimerRef.current !== null) clearInterval(simulatedTimerRef.current);
      setStatusText('הורדה בוטלה על ידי המשתמש.');
      setJobId(null);
    } catch (err: unknown) {
      setError(`Error cancelling download: ${err}`);
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
        {format === 'mp4' && (
          <select value={videoQuality} onChange={(e) => setVideoQuality(e.target.value)}>
            {Object.entries(qualityOptions).map(([label, qualityId]) => (
              <option key={qualityId} value={qualityId}>
                {label}
              </option>
            ))}
          </select>
        )}
        <button type="submit" disabled={!!jobId}>
          התחל הורדה
        </button>
      </form>
      {jobId && (
        <div className="status">
          <div className="progress-bar">
            <div className="progress" style={{ width: `${progress}%` }}>
              {progress > 0 && <p className="progress-percentage">{progress}%</p>}
            </div>
          </div>
          {statusText && <p>{statusText}</p>}
          {jobId && statusText !== 'הורדה הושלמה. מכין את הקובץ...' && !isCancelled && (
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
              <video controls style={{ width: '100%' }}>
                <source src={result.link} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          ) : (
            <audio controls style={{ width: '100%' }}>
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
