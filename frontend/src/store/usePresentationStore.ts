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

// Typed interface for generation pipeline steps
export interface GenStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  desc: string;
}

const DEFAULT_GEN_STEPS: GenStep[] = [
  { id: 1, label: 'ANALYSING_TOPICS', status: 'pending', desc: '' },
  { id: 2, label: 'WRITING_CONTENT', status: 'pending', desc: '' },
  { id: 3, label: 'FETCHING_VISUALS', status: 'pending', desc: '' },
  { id: 4, label: 'BUILDING_PPTX', status: 'pending', desc: '' },
];

interface PresentationState {
  // Config
  title: string;
  topics: string[];
  context: string;
  tone: string;
  theme: string;
  numSlides: number;
  forceProvider: string | null;
  includeImages: bool;

  // Pipeline
  loading: boolean;
  errorMsg: string;
  genSteps: GenStep[];
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
  setIncludeImages: (include: bool) => void;
  setResult: (res: GenerateResponse | null) => void;
  setSlides: (slides: SlideData[]) => void;
  setErrorMsg: (msg: string) => void;
  setLoading: (loading: boolean) => void;
  setGenSteps: (steps: GenStep[]) => void;
  
  resetCreation: () => void;
  // token parameter removed — apiClient interceptor handles Authorization header automatically
  generatePresentation: (onSuccess: () => void) => Promise<void>;
}

export const usePresentationStore = create<PresentationState>((set, get) => ({
  title: '',
  topics: [],
  context: '',
  tone: 'professional',
  theme: 'neon',
  numSlides: 5,
  forceProvider: null,
  includeImages: true,
  
  loading: false,
  errorMsg: '',
  genSteps: DEFAULT_GEN_STEPS,
  result: null,
  slides: [],

  setTitle: (title) => set({ title }),
  setTopics: (topics) => set({ topics }),
  setContext: (context) => set({ context }),
  setTone: (tone) => set({ tone }),
  setTheme: (theme) => set({ theme }),
  setNumSlides: (numSlides) => set({ numSlides }),
  setForceProvider: (forceProvider) => set({ forceProvider }),
  setIncludeImages: (includeImages) => set({ includeImages }),
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
    includeImages: true,
    result: null,
    slides: [],
    errorMsg: '',
    loading: false,
    genSteps: DEFAULT_GEN_STEPS,
  }),

  generatePresentation: async (onSuccess) => {
    const { title, topics, numSlides, context, tone, theme, forceProvider, includeImages } = get();
    
    if (!title.trim()) { set({ errorMsg: 'ERROR_001 — Presentation title is required' }); return; }
    if (!topics.length) { set({ errorMsg: 'ERROR_002 — At least one topic is required' }); return; }
    
    set({ errorMsg: '', loading: true });
    
    const sDetails = [
      'Understanding structure and topic distribution…',
      'Generating slide content with LLM…',
      'Sourcing images via Pollinations / Unsplash…',
      'Assembling branded PPTX file…'
    ];

    try {
      for (let i = 0; i < 4; i++) {
        set(state => ({
          genSteps: state.genSteps.map((st, idx) => 
            idx === i ? { ...st, status: 'active', desc: sDetails[i] } : st
          )
        }));
        
        await new Promise(r => setTimeout(r, 600));

        if (i === 2 && !includeImages) {
          set(state => ({
            genSteps: state.genSteps.map((st, idx) => 
              idx === i ? { ...st, status: 'done', desc: 'SKIPPED — Visuals disabled by policy' } : st
            )
          }));
          continue;
        }

        if (i === 1) {
          const params = { 
            title, topics, num_slides: numSlides, 
            context, tone, theme, 
            force_provider: forceProvider,
            include_images: includeImages
          };
          // apiClient interceptor automatically attaches Authorization: Bearer <token>
          const response = await apiClient.post('/generate', params);
          const data = response.data;
          set({ result: data, slides: data.slides });
        }

        set(state => ({
          genSteps: state.genSteps.map((st, idx) => 
            idx === i ? { ...st, status: 'done', desc: sDetails[i] } : st
          )
        }));
      }
      
      onSuccess();
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Generation failed';
      set({ errorMsg: msg, loading: false });
    }
  }
}));
