import { useAppStore } from '../store/useAppStore';
import { presentationApi } from '../api/presentation';

export function useDownload() {
  const { showToast } = useAppStore();

  const handleDownload = async (id: string, filename: string) => {
    showToast('DOWNLOAD — Streaming PPTX...');
    try {
      const blob = await presentationApi.downloadPresentation(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke the object URL to free up memory
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('Download failed:', err);
      showToast('DOWNLOAD_FAILED');
    }
  };

  return { handleDownload };
}
