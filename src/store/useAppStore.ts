import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Home / Gallery filters
  searchQuery: string;
  selectedCategory: string;
  selectedTags: string[];
  filterPolygonsRange: [number, number] | null;
  filterDateRange: [Date | null, Date | null]; // Start, End
  
  isUploadModalOpen: boolean;
  isSettingsModalOpen: boolean;

  // Viewer settings (can be global preference or current view state)
  viewerDoubleSide: boolean;
  viewerWireframe: boolean;
  
  // Viewer background settings
  viewerBackgroundType: 'solid' | 'gradient' | 'hdri';
  viewerSolidColor: string;
  viewerGradientColor1: string;
  viewerGradientColor2: string;
  viewerHdriPreset: string;
  viewerHdriBlur: number;
  
  // Theme
  darkMode: boolean;

  // Loading states
  isLoading: boolean;
  loadingMessage: string;
  isSyncing: boolean; // Sincronización con servidor

  // Actions
  setSearchQuery: (query: string) => void;
  setSelectedCategory: (category: string) => void;
  setSelectedTags: (tags: string[]) => void;
  setFilterPolygonsRange: (range: [number, number] | null) => void;
  setFilterDateRange: (range: [Date | null, Date | null]) => void;
  
  setUploadModalOpen: (isOpen: boolean) => void;
  setSettingsModalOpen: (isOpen: boolean) => void;
  setViewerDoubleSide: (enabled: boolean) => void;
  setViewerWireframe: (enabled: boolean) => void;
  setViewerBackgroundType: (type: 'solid' | 'gradient' | 'hdri') => void;
  setViewerSolidColor: (color: string) => void;
  setViewerGradientColor1: (color: string) => void;
  setViewerGradientColor2: (color: string) => void;
  setViewerHdriPreset: (preset: string) => void;
  setViewerHdriBlur: (blur: number) => void;
  toggleDarkMode: () => void;
  resetFilters: () => void;
  
  setLoading: (isLoading: boolean, message?: string) => void;
  setSyncing: (isSyncing: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      searchQuery: '',
      selectedCategory: 'all',
      selectedTags: [],
      filterPolygonsRange: null,
      filterDateRange: [null, null],
      isUploadModalOpen: false,
      isSettingsModalOpen: false,
      viewerDoubleSide: false,
      viewerWireframe: false,
      viewerBackgroundType: 'gradient',
      viewerSolidColor: '#ffffff',
      viewerGradientColor1: '#303745',
      viewerGradientColor2: '#ffffff',
      viewerHdriPreset: 'city',
      viewerHdriBlur: 0,
      darkMode: false,
      
      isLoading: false,
      loadingMessage: '',
      isSyncing: false,

      setSearchQuery: (query) => set({ searchQuery: query }),
      setSelectedCategory: (category) => set({ selectedCategory: category }),
      setSelectedTags: (tags) => set({ selectedTags: tags }),
      setFilterPolygonsRange: (range) => set({ filterPolygonsRange: range }),
      setFilterDateRange: (range) => set({ filterDateRange: range }),

      setUploadModalOpen: (isOpen) => set({ isUploadModalOpen: isOpen }),
      setSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),
      setViewerDoubleSide: (enabled) => set({ viewerDoubleSide: enabled }),
      setViewerWireframe: (enabled) => set({ viewerWireframe: enabled }),
      setViewerBackgroundType: (type) => set({ viewerBackgroundType: type }),
      setViewerSolidColor: (color) => set({ viewerSolidColor: color }),
      setViewerGradientColor1: (color) => set({ viewerGradientColor1: color }),
      setViewerGradientColor2: (color) => set({ viewerGradientColor2: color }),
      setViewerHdriPreset: (preset) => set({ viewerHdriPreset: preset }),
      setViewerHdriBlur: (blur) => set({ viewerHdriBlur: blur }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      resetFilters: () => set({ 
        searchQuery: '', 
        selectedCategory: 'all', 
        selectedTags: [],
        filterPolygonsRange: null,
        filterDateRange: [null, null]
      }),
      
      setLoading: (isLoading, message = '') => set({ isLoading, loadingMessage: message }),
      setSyncing: (isSyncing) => set({ isSyncing }),
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({ 
        darkMode: state.darkMode, 
        viewerDoubleSide: state.viewerDoubleSide,
        viewerWireframe: state.viewerWireframe,
        viewerBackgroundType: state.viewerBackgroundType,
        viewerSolidColor: state.viewerSolidColor,
        viewerGradientColor1: state.viewerGradientColor1,
        viewerGradientColor2: state.viewerGradientColor2,
        viewerHdriPreset: state.viewerHdriPreset,
        viewerHdriBlur: state.viewerHdriBlur,
      }), // Only persist preferences
    }
  )
);

