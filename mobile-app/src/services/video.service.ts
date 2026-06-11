import api from './api';

export interface Video {
  id: string;
  title: string;
  duration: string;
  location: string;
  type: 'vertical' | 'horizontal';
  description: string;
  url: string;
  thumbnail: string;
}

export const videoService = {
  getVideos: async (): Promise<Video[]> => {
    const response = await api.get<{ success: boolean; videos?: Video[] }>(
      '/videos'
    );
    return response.data.videos ?? [];
  },
};

export default videoService;
