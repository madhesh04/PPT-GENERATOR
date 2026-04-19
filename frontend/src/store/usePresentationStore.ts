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
  title: string;
  topics: string[];
  context: string;
  tone: string;
  theme: string;
  numSlides: number;
  forceProvider: string | null;
  includeImages: boolean;

  track: string;
  client: string;
  module: string;
  course: string;
  targetAudience: string;

  // Notes
  notesContent: string;

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
  setIncludeImages: (include: boolean) => void;
  
  setTrack: (track: string) => void;
  setClient: (client: string) => void;
  setModule: (mod: string) => void;
  setCourse: (course: string) => void;
  setTargetAudience: (aud: string) => void;
  setNotesContent: (content: string) => void;
  setResult: (res: GenerateResponse | null) => void;
  setSlides: (slides: SlideData[]) => void;
  setErrorMsg: (msg: string) => void;
  setLoading: (loading: boolean) => void;
  setGenSteps: (steps: GenStep[]) => void;
  
  resetCreation: () => void;
  generatePresentation: (onSuccess: () => void) => Promise<void>;
  generateLectureNotes: (payload: any, onSuccess: () => void) => Promise<void>;
  
  // New actions for slide management
  updateSlide: (index: number, updated: Partial<SlideData>) => void;
  regenerateSlide: (index: number) => Promise<void>;
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
  
  track: '',
  client: '',
  module: '',
  course: '',
  targetAudience: '',

  notesContent: '',
  
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
  setTrack: (track) => set({ track }),
  setClient: (client) => set({ client }),
  setModule: (module) => set({ module }),
  setCourse: (course) => set({ course }),
  setTargetAudience: (targetAudience) => set({ targetAudience }),
  setNotesContent: (notesContent) => set({ notesContent }),
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
    track: '',
    client: '',
    module: '',
    course: '',
    targetAudience: '',
    notesContent: '',
    result: null,
    slides: [],
    errorMsg: '',
    loading: false,
    genSteps: DEFAULT_GEN_STEPS,
  }),

  generatePresentation: async (onSuccess) => {
    const { title, topics, numSlides, context, tone, theme, forceProvider, includeImages, track, client, module, course, targetAudience } = get();
    
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
            context: context + (targetAudience ? `\\nTarget Audience: ${targetAudience}` : ''),
            tone, theme, 
            force_provider: forceProvider,
            include_images: includeImages,
            type: "ppt",
            track: track || null,
            client: client || null,
            module: module || null,
            course: course || null
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
      
      set({ loading: false });
      onSuccess();
    } catch (err: any) {
      let msg = 'Generation failed';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        } else {
          msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        }
      }
      set({ errorMsg: msg, loading: false });
    }
  },

  generateLectureNotes: async (payload, onSuccess) => {
    set({ errorMsg: '', loading: true, notesContent: '' });
    
    // Notes pipeline has only 2 steps: Analyzing & LLM Creation
    const steps: GenStep[] = [
      { id: 1, label: 'ANALYZING_SYLLABUS', status: 'active', desc: 'Understanding unit and topics...' },
      { id: 2, label: 'DRAFTING_NOTES', status: 'pending', desc: '' }
    ];
    set({ genSteps: steps });
    
    try {
      await new Promise(r => setTimeout(r, 600));
      set({ genSteps: [
        { id: 1, label: 'ANALYZING_SYLLABUS', status: 'done', desc: 'Syllabus mapped.' },
        { id: 2, label: 'DRAFTING_NOTES', status: 'active', desc: 'Writing comprehensive markdown...' }
      ]});

      const response = await apiClient.post('/generate-notes', payload);
      
      set({ genSteps: [
        { id: 1, label: 'ANALYZING_SYLLABUS', status: 'done', desc: 'Syllabus mapped.' },
        { id: 2, label: 'DRAFTING_NOTES', status: 'done', desc: 'Document ready.' }
      ]});
      
      await new Promise(r => setTimeout(r, 400));
      set({ notesContent: response.data.content, loading: false });
      onSuccess();
    } catch (err: any) {
      let msg = 'Failed to generate lecture notes';
      if (err.response?.data?.detail) {
        const detail = err.response.data.detail;
        if (Array.isArray(detail)) {
          msg = detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
        } else {
          msg = typeof detail === 'string' ? detail : JSON.stringify(detail);
        }
      }
      set({ errorMsg: msg, loading: false });
    }
  },

  updateSlide: (index, updated) => {
    const { slides } = get();
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...updated };
    set({ slides: newSlides });
  },

  regenerateSlide: async (index) => {
    const { slides, context, tone } = get();
    if (!slides[index]) return;

    set({ loading: true, errorMsg: '' });
    try {
      const response = await apiClient.post('/regenerate-slide', {
        title: slides[index].title,
        context,
        tone,
        existing_titles: slides.map(s => s.title)
      });
      
      const newSlides = [...slides];
      newSlides[index] = response.data;
      set({ slides: newSlides, loading: false });
    } catch (err: any) {
      set({ errorMsg: 'Failed to regenerate slide', loading: false });
    }
  }
}));
