import { presentationApi } from '../api/presentation';
import { useToastStore } from '../components/ui/ToastContainer';

export function useDownload() {
  const { showToast } = useToastStore.getState();

  const handleDownload = async (id: string, filename: string) => {
    showToast('SKYNET // Downloading presentation...', 'info');
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
      showToast('DOWNLOAD_SUCCESS · Ready for Deployment', 'success');
    } catch (err) {
      console.error('Download failed:', err);
      showToast('CRITICAL_ERROR // Download interrupted', 'error');
    }
  };

  return { handleDownload };
}
