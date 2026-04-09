import { create } from 'zustand';
import apiClient from '../api/apiClient';

export interface SlideData {
  title: string;
  content: string[];
  code?: string | null;
  language?: string | null;
  notes?: string;
  image_query?: string | null;
  image_base64?: string | null;
}

export interface GenerateResponse {
  title: string;
  slides: SlideData[];
  theme: string;
  token: string;
  filename: string;
  model_used?: string;
  provider?: string;
}

interface PresentationState {
  // Config
  title: string;
  topics: string[];
  context: string;
  tone: string;
  theme: string;
  numSlides: number;
  forceProvider: string | null;

  // Pipeline
  loading: boolean;
  errorMsg: string;
  genSteps: any[];
  result: GenerateResponse | null;
  slides: SlideData[];

  // Actions
  setTitle: (title: string) => void;
  setTopics: (topics: string[]) => void;
  setContext: (context: string) => void;
  setTone: (tone: string) => void;
  setTheme: (theme: string) => void;
  setNumSlides: (num: number) => void;
  setForceProvider: (prov: string | null) => void;
  setResult: (res: GenerateResponse | null) => void;
  setSlides: (slides: SlideData[]) => void;
  setErrorMsg: (msg: string) => void;
  setLoading: (loading: boolean) => void;
  setGenSteps: (steps: any[]) => void;
  
  resetCreation: () => void;
}

export const usePresentationStore = create<PresentationState>((set) => ({
  title: '',
  topics: [],
  context: '',
  tone: 'professional',
  theme: 'neon',
  numSlides: 5,
  forceProvider: null,
  
  loading: false,
  errorMsg: '',
  genSteps: [
    { id: 1, label: 'ANALYSING_TOPICS', status: 'pending', desc: '' },
    { id: 2, label: 'WRITING_CONTENT', status: 'pending', desc: '' },
    { id: 3, label: 'FETCHING_VISUALS', status: 'pending', desc: '' },
    { id: 4, label: 'BUILDING_PPTX', status: 'pending', desc: '' }
  ],
  result: null,
  slides: [],

  setTitle: (title) => set({ title }),
  setTopics: (topics) => set({ topics }),
  setContext: (context) => set({ context }),
  setTone: (tone) => set({ tone }),
  setTheme: (theme) => set({ theme }),
  setNumSlides: (num) => set({ numSlides: num }),
  setForceProvider: (forceProvider) => set({ forceProvider }),
  setResult: (result) => set({ result }),
  setSlides: (slides) => set({ slides }),
  setErrorMsg: (errorMsg) => set({ errorMsg }),
  setLoading: (loading) => set({ loading }),
  setGenSteps: (genSteps) => set({ genSteps }),

  resetCreation: () => set({
    title: '',
    topics: [],
    context: '',
    tone: 'professional',
    theme: 'neon',
    numSlides: 5,
    forceProvider: null,
    result: null,
    slides: [],
    errorMsg: '',
    loading: false
  })
}));
