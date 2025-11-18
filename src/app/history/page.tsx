'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import HistorySkeleton from '@/components/HistorySkeleton';
import Toast from '@/components/Toast';
import Link from 'next/link';
import Image from 'next/image';

const slugify = (str: string) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

interface HistoryItem {
  id: string;
  title: string;
  artists: string[];
  album: string;
  releaseDate: string | null;
  coverUrl: string | null;
  duration: number | null;
  searchedAt: string;
  spotifyId: string | null;
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/history');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchHistory();
    }
  }, [status]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/history');
      
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
      setHistory(data.history);
    } catch (err) {
      setError('Failed to load history');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      setDeletingId(id);
      const response = await fetch(`/api/history?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete');
      }

      // remove from local state
      setHistory(history.filter(item => item.id !== id));
      setToast({ message: 'Song removed from history', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to delete item', type: 'error' });
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm(`Are you sure you want to delete all ${history.length} items? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsClearing(true);
      const response = await fetch('/api/history/clear', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to clear history');
      }

      setHistory([]);
      setToast({ message: 'All history cleared', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to clear history', type: 'error' });
      console.error(err);
    } finally {
      setIsClearing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (status === 'loading' || (status === 'authenticated' && isLoading)) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-black pt-20 pb-12 px-4">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <div className="h-10 w-64 rounded mb-2 animate-pulse" style={{ backgroundColor: '#1F1F1F' }} />
              <div className="h-6 w-32 rounded animate-pulse" style={{ backgroundColor: '#1F1F1F' }} />
            </div>
            <HistorySkeleton />
          </div>
        </main>
      </>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <Header />
      <main className="min-h-screen bg-black pt-20 pb-12 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold mb-2" style={{ color: '#D1F577' }}>
                Your History
              </h1>
              <p className="text-lg" style={{ color: '#EEECFF', opacity: 0.7 }}>
                {history.length} {history.length === 1 ? 'song' : 'songs'} identified
              </p>
            </div>
            
            {history.length > 0 && (
              <button
                onClick={handleClearAll}
                disabled={isClearing}
                className="px-4 py-2 rounded font-medium transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-2"
                style={{ color: '#EF4444', backgroundColor: '#1F1F1F' }}
              >
                {isClearing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EF4444' }}></div>
                    Clearing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Clear All
                  </>
                )}
              </button>
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 rounded" style={{ backgroundColor: '#EF4444', color: 'white' }}>
              {error}
            </div>
          )}

          {history.length === 0 ? (
            <div className="text-center py-16">
              <svg className="w-24 h-24 mx-auto mb-4" style={{ color: '#4A52EB', opacity: 0.3 }} fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a3 3 0 016 0v2a3 3 0 11-6 0V9z" clipRule="evenodd"/>
              </svg>
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#EEECFF' }}>
                No history yet
              </h2>
              <p className="mb-6" style={{ color: '#EEECFF', opacity: 0.7 }}>
                Start identifying songs to build your history
              </p>
              <Link
                href="/"
                className="inline-block px-6 py-3 rounded font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: '#4A52EB' }}
              >
                Find a Song
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((item) => {
                const slug = slugify(item.title);
                const href = item.spotifyId ? `/song/${item.spotifyId}/${slug}` : null;
                
                const content = (
                  <>
                    <div className="flex-shrink-0">
                      {item.coverUrl ? (
                        <Image
                          src={item.coverUrl}
                          alt={item.album}
                          width={80}
                          height={80}
                          className="rounded object-cover"
                        />
                      ) : (
                        <div className="w-20 h-20 rounded flex items-center justify-center" style={{ backgroundColor: '#4A52EB' }}>
                          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="flex-grow min-w-0">
                      <h3 className="text-xl font-bold truncate mb-1" style={{ color: '#D1F577' }}>
                        {item.title}
                      </h3>
                      <p className="text-md truncate mb-1" style={{ color: '#F1F1F3' }}>
                        {item.artists.join(', ')}
                      </p>
                      <p className="text-sm truncate mb-2" style={{ color: '#EEECFF', opacity: 0.7 }}>
                        {item.album}
                        {item.duration && ` • ${formatDuration(item.duration)}`}
                      </p>
                      <p className="text-xs" style={{ color: '#EEECFF', opacity: 0.5 }}>
                        {formatDate(item.searchedAt)}
                      </p>
                    </div>
                  </>
                );

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-lg flex gap-4 items-start justify-between"
                    style={{ backgroundColor: '#1F1F1F' }}
                  >
                    {href ? (
                      <Link href={href} className="flex-grow flex gap-4 items-start min-w-0 transition-all hover:opacity-80">
                        {content}
                      </Link>
                    ) : (
                      <div className="flex-grow flex gap-4 items-start min-w-0">
                        {content}
                      </div>
                    )}

                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="flex-shrink-0 p-2 rounded transition-all hover:opacity-80 disabled:opacity-50 z-10"
                      style={{ color: '#EF4444' }}
                      title="Delete"
                    >
                      {deletingId === item.id ? (
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#EF4444' }}></div>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}