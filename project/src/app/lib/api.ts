import type { Room, Video, User, Collection, UserStats, StreamSchedule } from './types';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

/**
 * Helper to get the token from cookies or localStorage
 */
const getAuthToken = () => {
  if (typeof document === 'undefined') return null;
  const matches = document.cookie.match(new RegExp('(?:^|; )cowatch_auth=([^;]*)'));
  return matches ? decodeURIComponent(matches[1]) : null;
};

/**
 * Generic fetch wrapper with auth
 */
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && token !== 'true') {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    credentials: options.credentials || 'include',
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let detail = 'API request failed';
    try {
      const errorJson = JSON.parse(errorBody);
      detail = errorJson.detail || detail;
    } catch {
      detail = errorBody || detail;
    }
    const errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
    throw new Error(errorMessage);
  }

  return response.json();
}

export const api = {
  // Authentication
  async googleLogin(idToken: string): Promise<{ access_token: string; user: User }> {
    return request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token: idToken }),
    });
  },

  async getCurrentUser(): Promise<User | null> {
    try {
      return await request('/auth/me');
    } catch {
      return null;
    }
  },

  async onboardUser(data: { display_name: string; age?: number; genres: string[]; theme: string }): Promise<User> {
    return request('/user/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateProfile(updates: Partial<User>): Promise<User> {
    return request('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  // User Stats
  async getUserStats(): Promise<UserStats> {
    return request('/user/stats');
  },

  // Video endpoints
  async getVideos(): Promise<Video[]> {
    return request('/videos', { credentials: 'include' });
  },

  async getVideo(id: string): Promise<Video> {
    return request(`/videos/${id}`);
  },

  async getVideoStatus(id: string): Promise<{ video_id: string; status: string }> {
    return request(`/videos/${id}/status`);
  },

  async uploadVideo(
    file: File,
    title: string,
    description: string = '',
    collectionId?: string,
    onProgress?: (event: ProgressEvent) => void
  ): Promise<Video> {
    return new Promise((resolve, reject) => {
      const token = getAuthToken();
      const xhr = new XMLHttpRequest();
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', title);
      formData.append('description', description);
      if (collectionId) {
        formData.append('collection_id', collectionId);
      }

      xhr.open('POST', `${BASE_URL}/videos/upload`);
      
      if (token && token !== 'true') {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      
      xhr.withCredentials = true;

      if (onProgress && xhr.upload) {
        xhr.upload.addEventListener('progress', onProgress);
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            resolve(xhr.responseText as any);
          }
        } else {
          let detail = 'API request failed';
          try {
            const errorJson = JSON.parse(xhr.responseText);
            detail = errorJson.detail || detail;
          } catch {
            detail = xhr.responseText || detail;
          }
          reject(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)));
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.send(formData);
    });
  },

  async deleteVideo(id: string): Promise<void> {
    return request(`/videos/${id}`, {
      method: 'DELETE',
    });
  },

  async bulkDeleteVideos(videoIds: string[]): Promise<any> {
    return request('/videos/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ video_ids: videoIds }),
    });
  },

  // Collection endpoints
  async getCollections(): Promise<Collection[]> {
    return request('/collections', { credentials: 'include' });
  },

  async getCollection(id: string): Promise<Collection> {
    return request(`/collections/${id}`);
  },

  async createCollection(name: string, description: string = ''): Promise<Collection> {
    return request('/collections/', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
  },

  async deleteCollection(id: number): Promise<void> {
    return request(`/collections/${id}`, {
      method: 'DELETE',
    });
  },

  async addVideoToCollection(collectionId: number, videoId: string): Promise<void> {
    return request(`/collections/${collectionId}/videos/${videoId}`, {
      method: 'POST',
    });
  },

  // Room endpoints
  async createRoom(name: string, videoId?: string, hostId?: string, videoUrl?: string, collectionId?: number): Promise<any> {
    return request('/rooms/create', {
      method: 'POST',
      body: JSON.stringify({
        title: name,
        video_id: videoId || undefined,
        host_id: hostId,
        video_url: videoUrl || undefined,
        collection_id: collectionId || undefined
      }),
    });
  },

  async joinRoom(roomId: string, userId: string, name: string): Promise<any> {
    return request('/rooms/join', {
      method: 'POST',
      body: JSON.stringify({
        room_id: roomId,
        user_id: userId,
        name: name
      }),
    });
  },

  async getRoom(roomId: string): Promise<Room> {
    return request(`/rooms/${roomId}`);
  },

  async getActiveRooms(): Promise<any[]> {
    return request('/rooms/active');
  },

  async disbandRoom(roomId: string): Promise<void> {
    return request(`/rooms/${roomId}`, {
      method: 'DELETE',
    });
  },

  async getLiveKitToken(room: string, username: string, userId?: string): Promise<{ token: string; url: string }> {
    return request('/livekit/token', {
      method: 'POST',
      body: JSON.stringify({ room, username, user_id: userId }),
    });
  },

  /**
   * Constructs the full URL for a stream asset by prepending the backend origin.
   */
  getStreamUrl(streamPath: string): string {
    if (!streamPath) return '';
    if (streamPath.startsWith('http')) return streamPath;
    const origin = BASE_URL.replace('/api', '');
    return `${origin}${streamPath}`;
  }
};
