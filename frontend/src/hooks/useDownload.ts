import { presentationApi } from '../api/presentation';
import { useToastStore } from '../components/ui/ToastContainer';

export function useDownload() {
  const showToast = useToastStore((s) => s.showToast);

  const handleDownload = async (id: string, filename: string) => {
    try {
      const blob = await presentationApi.downloadPresentation(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      showToast('Download complete', 'success');
    } catch (err) {
      console.error('Download failed:', err);
      showToast('Download failed — try again', 'error');
    }
  };

  return { handleDownload };
}