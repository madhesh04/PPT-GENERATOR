# 🪐 SkyNet — Frontend (React + Vanish UI)

The frontend of **SkyNet PPT Generator** is a high-performance React application built with TypeScript and Vite. It features a custom-engineered UI framework called **Vanish**, focused on glassmorphism, mechanical aesthetics, and professional presentation workflows.

## 🧬 Core Features
- **Live Preview System**: High-fidelity, static-frame presentation preview with real-time editing and navigation controls.
- **Skynet Access Protocol**: Identity-based login supporting **Employee ID** authentication and role-aware navigation.
- **Vanish Design Language**: High-contrast UI with mechanical animations, glassmorphism, and hardware-accelerated effects.
- **Role-Aware Dashboards**: Tailored experiences for `USER` and `ADMIN` roles, including analytical KPI tiles for administrators.
- **Integrated Editor**: On-the-fly slide editing, regeneration of specific slides, and dynamic image swapping.

## 🛡️ Authentication & RBAC
- **Shared Identity**: Authentication is delegated to the external Timesheet database to maintain a single source of truth for user accounts.
- **Managed Access**: User registration is disabled; account creation and role assignments are handled via the centralized administration system.
- **Session Security**: Secure state management with automatic logout and token expiration handling.

## 🛠️ Internal Architecture
- **Creator Engine**: `CreatorView.tsx` manages the complex state of slide generation, previewing, and exporting.
- **UI Components**: Standardized, reusable components in `src/components/ui/` ensure visual consistency.
- **State Management**: Orchestrated via custom hooks and stores for robust authentication and application flow.
- **Styling**: Powered by Vanilla CSS for maximum flexibility and precise animation control.

## 🚀 Development & Build
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

---
© 2026 iamneo | **SkyNet**
